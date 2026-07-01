import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, ScrollView, Modal,
  StatusBar, Platform, Animated, Dimensions, TextInput, FlatList,
  Keyboard, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';

import { db } from '@/config/firebase';
import { CorpoHidrico, PontoDeUso } from '@/types/water_bodies';
import {
  buscarObservacoesPorCorpo,
  calcularResumoObservacoes,
  ResumoObservacoes,
} from '@/services/firestore/observations';
import { useAuth } from '@/contexts/auth-context';

import stateData from '@/assets/map_layers/pe_aquasense.json';
import municipiosData from '@/assets/map_layers/municipios_pe.json';
import TechnicalBottomNav, { TechNavTab } from '@/components/technicalbottomnavbar';

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY          = '#004d48';
const TEAL_MED         = '#0d6e52';
const TEAL_DARK        = '#0a3d32';
const TEXT_DARK        = '#1a2e26';
const TEXT_MUTED       = '#6b7a7a';
const BORDER_LIGHT     = '#e0f2f1';
const STATUS_RED       = '#d32f2f';
const STATUS_RED_BG    = '#fdecea';
const STATUS_YELLOW    = '#f59e0b';
const STATUS_YELLOW_BG = '#fff8e1';
const STATUS_GREEN     = '#2e7d32';
const STATUS_GREEN_BG  = '#e8f5e9';
const STATUS_GRAY      = '#757575';
const STATUS_GRAY_BG   = '#f5f5f5';

const { height: SCREEN_H } = Dimensions.get('window');

// Bottom-sheet snap points
const NAV_HEIGHT      = Platform.OS === 'ios' ? 84 : 70;
const SHEET_COLLAPSED = SCREEN_H * 0.38;
const SHEET_EXPANDED  = SCREEN_H * 0.82;
const SHEET_CLOSE_THRESHOLD = SHEET_COLLAPSED * 0.6; // abaixo disso, soltar o dedo fecha o sheet

const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

// ─── Helpers de data/hora ─────────────────────────────────────────────────────

function formatarDataHoraAtual(): string {
  const agora = new Date();
  const dia    = String(agora.getDate()).padStart(2, '0');
  const mes    = String(agora.getMonth() + 1).padStart(2, '0');
  const ano    = agora.getFullYear();
  const horas  = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} · ${horas}:${minutos}`;
}

// ─── Dados mockados realistas ─────────────────────────────────────────────────

const MOCK_DADOS: Record<string, {
  situacaoAtual: string;
  estadoTecnico: string;
  prioridade: string;
  ultimaAnalise: string;
  proximaRevisao: string;
  riscoAmbiental: string;
  indicadores: { odor: string; corAgua: string; espuma: string; lixo: string };
}> = {};

function getMockDados(corpoId?: string) {
  if (corpoId && MOCK_DADOS[corpoId]) return MOCK_DADOS[corpoId];
  return {
    situacaoAtual:  'Odor forte recorrente, presença de lixo nas margens, água escura e espuma frequente.',
    estadoTecnico:  'Aguardando análise',
    prioridade:     'Alta',
    ultimaAnalise:  '08/05/2025 · 18:42',
    proximaRevisao: 'Em até 5 dias',
    riscoAmbiental: 'Elevado',
    indicadores: { odor: 'Forte', corAgua: 'Escura', espuma: 'Visível', lixo: 'Presente' },
  };
}

// ─── Map type options ─────────────────────────────────────────────────────────

type MapTypeKey = 'satellite' | 'standard' | 'hybrid' | 'terrain';

const MAP_TYPE_OPTIONS: { key: MapTypeKey; label: string }[] = [
  { key: 'satellite', label: 'Satélite' },
  { key: 'standard',  label: 'Mapa'     },
  { key: 'hybrid',    label: 'Híbrido'  },
  { key: 'terrain',   label: 'Terreno'  },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusFromCorpo(corpo: CorpoHidrico): 'critical' | 'attention' | 'normal' | 'nodata' {
  const q = (corpo as any).qualidadeStatus ?? (corpo as any).status ?? '';
  if (q === 'critico' || q === 'critical') return 'critical';
  if (q === 'atencao' || q === 'attention') return 'attention';
  if (q === 'normal') return 'normal';
  if (!corpo.cadastroValido) return 'attention';
  return 'nodata';
}

function statusConfig(s: 'critical' | 'attention' | 'normal' | 'nodata') {
  switch (s) {
    case 'critical':
      return { label: 'CRÍTICO',   color: STATUS_RED,    bg: STATUS_RED_BG,    markerBg: '#d32f2f', icon: 'water' as const };
    case 'attention':
      return { label: 'ATENÇÃO',   color: STATUS_YELLOW, bg: STATUS_YELLOW_BG, markerBg: '#f59e0b', icon: 'warning-outline' as const };
    case 'normal':
      return { label: 'NORMAL',    color: STATUS_GREEN,  bg: STATUS_GREEN_BG,  markerBg: '#2e7d32', icon: 'water' as const };
    default:
      return { label: 'SEM DADOS', color: STATUS_GRAY,   bg: STATUS_GRAY_BG,   markerBg: '#757575', icon: 'remove-circle-outline' as const };
  }
}

// ─── Stat item (bottom sheet) ─────────────────────────────────────────────────

function StatItem({
  icon, value, label, iconColor, iconBg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Filter Modal (mobile-friendly chips) ─────────────────────────────────────

type StatusFilterKey = 'all' | 'critical' | 'attention' | 'normal' | 'nodata';

function FilterModal({
  visible, onClose, activeStatus, onApply,
}: {
  visible: boolean;
  onClose: () => void;
  activeStatus: StatusFilterKey;
  onApply: (s: StatusFilterKey, types: Record<string, boolean>) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterKey>(activeStatus);
  const [checkedTypes, setCheckedTypes] = useState({
    observacoes: true,
    medicoes:    true,
    denuncias:   true,
    analises:    true,
  });

  const statusOptions: {
    key: StatusFilterKey;
    label: string;
    color: string;
    bg: string;
    borderColor: string;
  }[] = [
    { key: 'all',       label: 'Todos',    color: PRIMARY,        bg: '#e8f5f0',        borderColor: PRIMARY        },
    { key: 'critical',  label: 'Críticos', color: STATUS_RED,     bg: STATUS_RED_BG,    borderColor: STATUS_RED     },
    { key: 'attention', label: 'Atenção',  color: STATUS_YELLOW,  bg: STATUS_YELLOW_BG, borderColor: STATUS_YELLOW  },
    { key: 'normal',    label: 'Normais',  color: STATUS_GREEN,   bg: STATUS_GREEN_BG,  borderColor: STATUS_GREEN   },
    { key: 'nodata',    label: 'Sem dados',color: STATUS_GRAY,    bg: STATUS_GRAY_BG,   borderColor: STATUS_GRAY    },
  ];

  const typeOptions: {
    key: keyof typeof checkedTypes;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: 'observacoes', label: 'Observações',       icon: 'eye-outline'          },
    { key: 'medicoes',    label: 'Medições simples',  icon: 'flask-outline'         },
    { key: 'denuncias',   label: 'Denúncias',         icon: 'warning-outline'       },
    { key: 'analises',    label: 'Análises técnicas', icon: 'document-text-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros do mapa</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSectionTitle}>Exibir no mapa</Text>
          <View style={styles.chipsRow}>
            {statusOptions.map((opt) => {
              const isActive = selectedStatus === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.chip,
                    { borderColor: opt.borderColor },
                    isActive && { backgroundColor: opt.bg },
                  ]}
                  onPress={() => setSelectedStatus(opt.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.chipDot, { backgroundColor: opt.color }]} />
                  <Text style={[styles.chipText, { color: isActive ? opt.color : TEXT_MUTED, fontWeight: isActive ? '700' : '500' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalDivider} />

          <Text style={styles.modalSectionTitle}>Filtrar por tipo de registro</Text>
          {typeOptions.map((opt) => {
            const isChecked = checkedTypes[opt.key];
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.typeCard, isChecked && styles.typeCardChecked]}
                onPress={() => setCheckedTypes((p) => ({ ...p, [opt.key]: !p[opt.key] }))}
                activeOpacity={0.75}
              >
                <View style={[styles.typeCardIcon, isChecked && styles.typeCardIconChecked]}>
                  <Ionicons name={opt.icon} size={18} color={isChecked ? '#fff' : TEXT_MUTED} />
                </View>
                <Text style={[styles.typeCardText, isChecked && styles.typeCardTextChecked]}>
                  {opt.label}
                </Text>
                {isChecked && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => { onApply(selectedStatus, checkedTypes); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Legend Modal ─────────────────────────────────────────────────────────────

function LegendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items: {
    status: 'critical' | 'attention' | 'normal' | 'nodata';
    titulo: string;
    descricao: string;
  }[] = [
    { status: 'critical',  titulo: 'Crítico',   descricao: 'Risco elevado de contaminação ou impacto ambiental.'  },
    { status: 'attention', titulo: 'Atenção',   descricao: 'Condições que requerem atenção e monitoramento.'      },
    { status: 'normal',    titulo: 'Normal',    descricao: 'Condições dentro dos padrões considerados adequados.' },
    { status: 'nodata',    titulo: 'Sem dados', descricao: 'Não há dados suficientes para classificação.'         },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Legenda de status</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
          </View>
          {items.map((item) => {
            const cfg = statusConfig(item.status);
            return (
              <View key={item.status} style={styles.legendRow}>
                <View style={[styles.legendIconCircle, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendTitle}>{item.titulo}</Text>
                  <Text style={styles.legendDesc}>{item.descricao}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

// ─── Indicador item (expanded sheet) ─────────────────────────────────────────

function IndicadorItem({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <View style={styles.indicadorItem}>
      <Text style={styles.indicadorLabel}>{label}</Text>
      <Text style={[styles.indicadorValor, { color: cor }]}>{valor}</Text>
    </View>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  corpo,
  resumo,
  loadingResumo,
  sheetHeight,
  isExpanded,
  panHandlers,
  fontFamily,
  onNovaAnalise,
  onVerHistorico,
  onClose,
}: {
  corpo: CorpoHidrico;
  resumo: ResumoObservacoes | null;
  loadingResumo: boolean;
  sheetHeight: Animated.Value;
  isExpanded: boolean;
  panHandlers: any;
  fontFamily?: string;
  onNovaAnalise: () => void;
  onVerHistorico: () => void;
  onClose: () => void;
}) {
  const status = statusFromCorpo(corpo);
  const cfg    = statusConfig(status);
  const mock   = getMockDados(corpo.id);

  const obs       = resumo?.totalObservacoes ?? 12;
  const medicoes  = (resumo as any)?.totalMedicoes ?? 3;
  const denuncias = (corpo as any).denunciasRecentes ?? 4;
  const analises  = (corpo as any).analisesTecnicas  ?? 1;

  const situacaoAtual  = (corpo as any).situacaoAtual  ?? mock.situacaoAtual;
  const estadoTecnico  = (corpo as any).estadoTecnico  ?? mock.estadoTecnico;
  const prioridade     = (corpo as any).prioridade     ?? mock.prioridade;
  const ultimaAnalise  = (corpo as any).ultimaAnalise  ?? mock.ultimaAnalise;
  const proximaRevisao = (corpo as any).proximaRevisao ?? mock.proximaRevisao;
  const riscoAmbiental = (corpo as any).riscoAmbiental ?? mock.riscoAmbiental;
  const indicadores    = (corpo as any).indicadores    ?? mock.indicadores;
  const dataAtualizada = formatarDataHoraAtual();

  const prioridadeColor =
    prioridade === 'Alta' || prioridade === 'alta'   ? STATUS_RED    :
    prioridade === 'Média' || prioridade === 'media' ? STATUS_YELLOW :
    STATUS_GREEN;

  const corIndicador = (val: string) => {
    const v = val.toLowerCase();
    if (v === 'forte' || v === 'presente' || v === 'escura' || v === 'visível') return STATUS_RED;
    if (v === 'moderado' || v === 'moderada' || v === 'leve')                   return STATUS_YELLOW;
    return STATUS_GREEN;
  };

  return (
    <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
      {/* Drag handle */}
      <View style={styles.dragHandleWrapper} {...panHandlers}>
        <View style={styles.dragHandle} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
        scrollEventThrottle={8}
        style={{ flex: 1 }}
        bounces={false}
      >
        {/* ── Cabeçalho ──────────────────────────────────────────────── */}
        <View style={styles.bsHeaderRow}>
          <View style={[styles.bsIconCircle, { backgroundColor: cfg.bg }]}>
            <Ionicons name="water" size={20} color={cfg.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.bsNome, { fontFamily }]} numberOfLines={1}>{corpo.nome}</Text>
            <View style={styles.bsLocRow}>
              <Ionicons name="location-outline" size={11} color={TEXT_MUTED} />
              <Text style={[styles.bsLoc, { fontFamily }]}>
                {[corpo.municipio, (corpo as any).estado].filter(Boolean).join(' - ') || 'Olinda - PE'}
              </Text>
            </View>
            <Text style={[styles.bsAtualizacao, { fontFamily }]}>
              Última atualização: Hoje, {new Date().getHours().toString().padStart(2,'0')}:{new Date().getMinutes().toString().padStart(2,'0')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color }]}>
            <Text style={styles.statusBadgeText}>{cfg.label}</Text>
          </View>
          <TouchableOpacity style={styles.bsCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* ── Alerta crítico ──────────────────────────────────────────── */}
        {status === 'critical' && (
          <TouchableOpacity style={styles.alertaBanner} activeOpacity={0.8}>
            <Ionicons name="warning" size={16} color={STATUS_RED} />
            <Text style={[styles.alertaText, { fontFamily }]}>Risco elevado de contaminação</Text>
            <Ionicons name="chevron-forward" size={14} color={STATUS_RED} />
          </TouchableOpacity>
        )}

        {/* ── Resumo operacional ──────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>
          Resumo operacional <Text style={styles.bsSectionSub}>(últimos 7 dias)</Text>
        </Text>

        <View style={styles.statsRow}>
          {loadingResumo ? (
            <ActivityIndicator color={TEAL_MED} size="small" style={{ flex: 1, paddingVertical: 12 }} />
          ) : (
            <>
              <StatItem icon="chatbubble-outline"    value={obs}       label={'Observações'}        iconColor={TEAL_MED}      iconBg="#e6f5ef"          />
              <StatItem icon="flask-outline"         value={medicoes}  label={'Medições\nsimples'}   iconColor="#2563c7"        iconBg="#e8f0ff"          />
              <StatItem icon="warning-outline"       value={denuncias} label={'Denúncias\nrecentes'} iconColor={STATUS_YELLOW} iconBg={STATUS_YELLOW_BG} />
              <StatItem icon="document-text-outline" value={analises}  label={'Análise\ntécnica'}    iconColor={TEAL_MED}      iconBg="#e6f5ef"          />
            </>
          )}
        </View>

        {/* ── Situação atual ──────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Situação atual</Text>
        <View style={styles.bsSituacaoBox}>
          <Text style={[styles.bsSituacaoText, { fontFamily }]} numberOfLines={isExpanded ? undefined : 3}>
            {situacaoAtual}
          </Text>
        </View>

        {/* ── Estado técnico ──────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Estado técnico</Text>
        <View style={styles.bsEstadoGrid}>
          <View style={styles.bsEstadoRow}>
            <Text style={[styles.bsEstadoLabel, { fontFamily }]}>Status</Text>
            <View style={[styles.estadoBadge, { backgroundColor: STATUS_YELLOW_BG }]}>
              <Text style={[styles.estadoBadgeText, { color: STATUS_YELLOW, fontFamily }]}>{estadoTecnico}</Text>
            </View>
          </View>
          <View style={styles.bsEstadoRow}>
            <Text style={[styles.bsEstadoLabel, { fontFamily }]}>Prioridade</Text>
            <Text style={[styles.bsEstadoVal, { color: prioridadeColor, fontWeight: '700', fontFamily }]}>
              {prioridade}
            </Text>
          </View>
          <View style={styles.bsEstadoRow}>
            <Text style={[styles.bsEstadoLabel, { fontFamily }]}>Última análise</Text>
            <Text style={[styles.bsEstadoVal, { fontFamily }]}>{ultimaAnalise}</Text>
          </View>
          <View style={[styles.bsEstadoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.bsEstadoLabel, { fontFamily }]}>Próxima revisão sugerida</Text>
            <Text style={[styles.bsEstadoVal, { fontFamily }]}>{proximaRevisao}</Text>
          </View>
        </View>

        {/* ── Seção expandida (risco + indicadores só quando expandido) ── */}
        {isExpanded && (
          <>
            <Text style={[styles.bsSectionTitle, { fontFamily }]}>Risco ambiental</Text>
            <View style={styles.riscoBadgeRow}>
              <View style={[styles.riscoBadge, { backgroundColor: STATUS_RED_BG, borderColor: '#f5c6c6' }]}>
                <Ionicons name="alert-circle" size={16} color={STATUS_RED} />
                <Text style={[styles.riscoBadgeText, { color: STATUS_RED, fontFamily }]}>{riscoAmbiental}</Text>
              </View>
            </View>

            <Text style={[styles.bsSectionTitle, { fontFamily }]}>Principais indicadores</Text>
            <View style={styles.indicadoresGrid}>
              <IndicadorItem label="Odor"        valor={indicadores.odor}    cor={corIndicador(indicadores.odor)}    />
              <IndicadorItem label="Cor da água" valor={indicadores.corAgua} cor={corIndicador(indicadores.corAgua)} />
              <IndicadorItem label="Espuma"      valor={indicadores.espuma}  cor={corIndicador(indicadores.espuma)}  />
              <IndicadorItem label="Lixo"        valor={indicadores.lixo}    cor={corIndicador(indicadores.lixo)}    />
            </View>
          </>
        )}

        {/* ── Botões de ação — sempre iguais, independente do estado ─── */}
        <View style={styles.bsBtnsSecRow}>
          <TouchableOpacity style={styles.bsBtnSec} onPress={onNovaAnalise} activeOpacity={0.85}>
            <Ionicons name="flask-outline" size={13} color={TEXT_DARK} />
            <Text style={[styles.bsBtnSecText, { fontFamily }]}>Análise técnica</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bsBtnSec} onPress={onVerHistorico} activeOpacity={0.85}>
            <Ionicons name="time-outline" size={13} color={TEXT_DARK} />
            <Text style={[styles.bsBtnSecText, { fontFamily }]}>Ver histórico</Text>
          </TouchableOpacity>
        </View>

        {/* ── Timestamp ───────────────────────────────────────────────── */}
        <Text style={[styles.bsTimestamp, { fontFamily }]}>
          ⓘ Dados atualizados em: {dataAtualizada}
        </Text>

      </ScrollView>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MapaTecnico() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { setLastWaterBody } = useAuth();
  const { focusCorpoId } = useLocalSearchParams<{ focusCorpoId?: string }>();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  // ── Map state ──────────────────────────────────────────────────────────────
  const [tipoMapa, setTipoMapa]               = useState<MapTypeKey>('satellite');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [showLayersModal, setShowLayersModal] = useState(false);
  const [statusFilter, setStatusFilter]       = useState<StatusFilterKey>('all');

  const [visibilidade, setVisibilidade] = useState({
    municipios:     true,
    corposHidricos: true,
    pendentes:      true,
    pontosDeUso:    true,
  });

  // ── Data ───────────────────────────────────────────────────────────────────
  const [corposValidados,  setCorposValidados]  = useState<CorpoHidrico[]>([]);
  const [corposPendentes,  setCorposPendentes]  = useState<CorpoHidrico[]>([]);
  const [pontosDeUso,      setPontosDeUso]      = useState<PontoDeUso[]>([]);
  const [loadingData,      setLoadingData]      = useState(true);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<CorpoHidrico[]>([]);

  // ── Selected body ──────────────────────────────────────────────────────────
  const [selectedCorpo,   setSelectedCorpo]   = useState<CorpoHidrico | null>(null);
  const [resumo,          setResumo]          = useState<ResumoObservacoes | null>(null);
  const [loadingResumo,   setLoadingResumo]   = useState(false);
  const [detalheVisible,  setDetalheVisible]  = useState(false);

  // ── Bottom sheet animation ─────────────────────────────────────────────────
  const sheetHeight      = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightValue = useRef(SHEET_COLLAPSED);
  const lastGestureDy    = useRef(0);
  const isExpandedRef    = useRef(false);
  const [sheetIsExpanded, setSheetIsExpanded] = useState(false);
  const focusHandled     = useRef(false);

  // Header entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Sheet listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    sheetHeight.addListener(({ value }) => { sheetHeightValue.current = value; });
    return () => sheetHeight.removeAllListeners();
  }, []);

  const fecharSheet = useCallback(() => {
    isExpandedRef.current = false;
    setSheetIsExpanded(false);
    Animated.timing(sheetHeight, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setDetalheVisible(false);
      setSelectedCorpo(null);
    });
  }, [sheetHeight]);

  const snapSheet = (toExpanded: boolean) => {
    const toValue = toExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED;
    isExpandedRef.current = toExpanded;
    setSheetIsExpanded(toExpanded);
    Animated.spring(sheetHeight, { toValue, useNativeDriver: false, bounciness: 4 }).start();
  };

  const panResponder = useRef(
    require('react-native').PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: any, { dy }: any) => Math.abs(dy) > 5,
      onPanResponderGrant: () => { lastGestureDy.current = 0; },
      onPanResponderMove: (_: any, { dy }: any) => {
        const newVal = sheetHeightValue.current - (dy - lastGestureDy.current);
        lastGestureDy.current = dy;
        const clamped = Math.max(0, Math.min(SHEET_EXPANDED, newVal));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_: any, { dy, vy }: any) => {
        // Arrastou bastante pra baixo (ou soltou rápido pra baixo) → fecha o sheet
        if (sheetHeightValue.current < SHEET_CLOSE_THRESHOLD || vy > 1.2) {
          fecharSheet();
          return;
        }
        const midPoint = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
        const goExpand = sheetHeightValue.current > midPoint || vy < -0.5;
        snapSheet(goExpand);
      },
    })
  ).current;

  // ── Localização inicial ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude, longitude: loc.coords.longitude,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }, 1000);
      } catch { /* silencioso */ }
    })();
  }, []);

  // ── Carrega dados do Firestore ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        const [validSnap, pendSnap, pontosSnap] = await Promise.all([
          getDocs(query(collection(db, 'corposHidricos'), where('cadastroValido', '==', true))),
          getDocs(query(collection(db, 'corposHidricos'), where('cadastroValido', '==', false))),
          getDocs(query(collection(db, 'pontosDeUso'),    where('cadastroValido', '==', true))),
        ]);

        const hasCoords = (item: any) =>
          typeof item.latitude === 'number' && typeof item.longitude === 'number';

        const validados = validSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CorpoHidrico))
          .filter(hasCoords);
        const pendentes = pendSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CorpoHidrico))
          .filter(hasCoords);

        setCorposValidados(validados);
        setCorposPendentes(pendentes);
        setPontosDeUso(
          pontosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PontoDeUso)).filter(hasCoords)
        );

        if (focusCorpoId && !focusHandled.current) {
          focusHandled.current = true;
          const alvo = [...validados, ...pendentes].find((c) => c.id === focusCorpoId);
          if (alvo) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: alvo.latitude, longitude: alvo.longitude,
                latitudeDelta: 0.04, longitudeDelta: 0.04,
              }, 900);
              abrirDetalhes(alvo);
            }, 600);
          }
        }
      } catch (e) {
        console.log('[MapaTecnico] Erro ao carregar dados:', e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [focusCorpoId]);

  // ── Busca ──────────────────────────────────────────────────────────────────
  const todosCorpos = [...corposValidados, ...corposPendentes];

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); return; }
    setSearchResults(
      todosCorpos
        .filter((c) =>
          (c.nome ?? '').toLowerCase().includes(q) ||
          (c.municipio ?? '').toLowerCase().includes(q)
        )
        .slice(0, 8)
    );
  }, [searchQuery, corposValidados, corposPendentes]);

  function handleSelectSearchResult(corpo: CorpoHidrico) {
    Keyboard.dismiss();
    setSearchQuery('');
    setSearchFocused(false);
    setSearchResults([]);
    mapRef.current?.animateToRegion({
      latitude: corpo.latitude, longitude: corpo.longitude,
      latitudeDelta: 0.04, longitudeDelta: 0.04,
    }, 900);
    abrirDetalhes(corpo);
  }

  // ── Abre bottom sheet ──────────────────────────────────────────────────────
  const abrirDetalhes = useCallback(async (corpo: CorpoHidrico) => {
    setSelectedCorpo(corpo);
    setResumo(null);
    sheetHeight.setValue(SHEET_COLLAPSED);
    isExpandedRef.current = false;
    setSheetIsExpanded(false);
    setDetalheVisible(true);

    if (corpo.id) {
      setLastWaterBody(corpo.id);
      setLoadingResumo(true);
      try {
        const obs = await buscarObservacoesPorCorpo(corpo.id);
        setResumo(calcularResumoObservacoes(obs));
      } catch {
        setResumo(calcularResumoObservacoes([]));
      } finally {
        setLoadingResumo(false);
      }
    }
  }, [setLastWaterBody]);

  // ── Ir para minha localização ──────────────────────────────────────────────
  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 1000);
  };

  // ── Filtragem de marcadores ────────────────────────────────────────────────
  function applyStatusFilter(corpos: CorpoHidrico[]) {
    if (statusFilter === 'all') return corpos;
    return corpos.filter((c) => statusFromCorpo(c) === statusFilter);
  }

  const corposVisiveis    = applyStatusFilter(visibilidade.corposHidricos ? corposValidados : []);
  const pendentesVisiveis = applyStatusFilter(visibilidade.pendentes      ? corposPendentes : []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={['#0d5c47', '#0d4a3e', '#0a3d32']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <Animated.View
              style={[styles.headerTopRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              {/* Espaçador esquerdo para equilibrar os ícones da direita */}
              <View style={styles.headerSide} />

              {/* Centro: logo + label lado a lado */}
              <View style={styles.headerCenter}>
                <Image
                  source={require('@/assets/images/aquasense.png')}
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
                <Text style={[styles.headerRole, { fontFamily: questrial }]}>TÉCNICO</Text>
              </View>

              {/* Ícones à direita */}
              <View style={[styles.headerSide, styles.headerIcons]}>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
                  <Ionicons name="notifications-outline" size={21} color="#e8f5f0" />
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>3</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Título */}
            <Animated.View
              style={[styles.headerTitleBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <Text style={[styles.pageTitle, { fontFamily: questrial }]}>
                Mapa de monitoramento
              </Text>
              <Text style={[styles.pageSubtitle, { fontFamily: questrial }]}>
                Visão operacional dos corpos hídricos
              </Text>
            </Animated.View>

            {/* Search + Filtros */}
            <Animated.View
              style={[styles.searchRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
                <Ionicons name="search" size={16} color="#8aa8a0" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { fontFamily: questrial }]}
                  placeholder="Buscar corpo hídrico, local ou endereço..."
                  placeholderTextColor="#8aa8a0"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => { setTimeout(() => setSearchFocused(false), 150); }}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={16} color={TEXT_MUTED} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setShowFilterModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="options-outline" size={15} color="#fff" />
                <Text style={[styles.filterBtnText, { fontFamily: questrial }]}>Filtros</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Alternância de tipo de mapa */}
            <Animated.View
              style={[styles.mapTypeRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              {MAP_TYPE_OPTIONS.map((v) => (
                <TouchableOpacity
                  key={v.key}
                  style={[styles.mapTypeBtn, tipoMapa === v.key && styles.mapTypeBtnActive]}
                  onPress={() => setTipoMapa(v.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.mapTypeText,
                      { fontFamily: questrial },
                      tipoMapa === v.key && styles.mapTypeTextActive,
                    ]}
                  >
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ DROPDOWN DE BUSCA ══════════════════════════════════════════ */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id ?? item.nome}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const s   = statusFromCorpo(item);
                const cfg = statusConfig(s);
                return (
                  <TouchableOpacity
                    style={styles.searchDropdownItem}
                    onPress={() => handleSelectSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.searchDropdownIcon, { backgroundColor: cfg.markerBg }]}>
                      <Ionicons name="water" size={13} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchDropdownName, { fontFamily: questrial }]} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      {item.municipio ? (
                        <Text style={[styles.searchDropdownSub, { fontFamily: questrial }]}>
                          {item.municipio}
                        </Text>
                      ) : null}
                    </View>
                    {!item.cadastroValido && (
                      <View style={styles.pendentePill}>
                        <Text style={[styles.pendentePillText, { fontFamily: questrial }]}>Pendente</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: BORDER_LIGHT, marginHorizontal: 12 }} />
              )}
            />
          </View>
        )}

        {/* ══ MAPA REAL ══════════════════════════════════════════════════ */}
        <MapView
          ref={mapRef}
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          initialRegion={REGIAO_INICIAL}
          mapType={tipoMapa}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          rotateEnabled
        >
          {visibilidade.municipios && (
            <Geojson
              geojson={municipiosData as any}
              strokeColor={tipoMapa === 'standard' || tipoMapa === 'terrain' ? '#FF8C00' : '#FFFFFF'}
              fillColor="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )}

          <Geojson
            geojson={stateData as any}
            fillColor="rgba(255,0,0,0)"
            strokeColor="#FF0000"
            strokeWidth={3}
          />

          {corposVisiveis.map((item) => {
            const s   = statusFromCorpo(item);
            const cfg = statusConfig(s);
            return (
              <Marker
                key={`ch-${item.id}`}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                onPress={() => abrirDetalhes(item)}
              >
                <View style={[styles.customMarker, { backgroundColor: cfg.markerBg }]}>
                  <Ionicons name={cfg.icon} size={15} color="#fff" />
                </View>
              </Marker>
            );
          })}

          {pendentesVisiveis.map((item) => (
            <Marker
              key={`pend-${item.id}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              onPress={() => abrirDetalhes(item)}
            >
              <View style={[styles.customMarker, { backgroundColor: STATUS_YELLOW }]}>
                <Ionicons name="time-outline" size={14} color="#fff" />
              </View>
            </Marker>
          ))}

          {visibilidade.pontosDeUso && pontosDeUso.map((item) => (
            <Marker
              key={`pu-${item.id}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            >
              <View style={[styles.customMarker, { backgroundColor: '#2e7d32' }]}>
                <Ionicons name="location" size={15} color="#fff" />
              </View>
            </Marker>
          ))}
        </MapView>

        {/* ══ SIDEBAR ════════════════════════════════════════════════════ */}
        <View style={styles.sidebar}>
          <TouchableOpacity style={styles.sidebarBtn} onPress={() => setShowLayersModal(true)} activeOpacity={0.8}>
            <Ionicons name="layers-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Camadas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtn} onPress={() => setShowLegendModal(true)} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Legenda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sidebarBtn, { borderBottomWidth: 0 }]} onPress={goToMyLocation} activeOpacity={0.8}>
            <Ionicons name="locate-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Localizar</Text>
          </TouchableOpacity>
        </View>

        {/* ══ BOTTOM SHEET ═══════════════════════════════════════════════ */}
        {detalheVisible && selectedCorpo && (
          <BottomSheet
            corpo={selectedCorpo}
            resumo={resumo}
            loadingResumo={loadingResumo}
            sheetHeight={sheetHeight}
            isExpanded={sheetIsExpanded}
            panHandlers={panResponder.panHandlers}
            fontFamily={questrial}
            onNovaAnalise={() => {
              router.push({
                pathname: '/analyses_union',
                params: { corpoId: selectedCorpo.id },
              } as any);
            }}
            onVerHistorico={() => {
              router.push({
                pathname: '/history_technician',
                params: { corpoId: selectedCorpo.id },
              } as any);
            }}
            onClose={fecharSheet}
          />
        )}

        {/* ══ BOTTOM NAV ═════════════════════════════════════════════════ */}
        <TechnicalBottomNav active="mapa" fontFamily={questrial} />
      </View>

      {/* ══ MODAIS ════════════════════════════════════════════════════════ */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        activeStatus={statusFilter}
        onApply={(s) => setStatusFilter(s)}
      />

      <LegendModal
        visible={showLegendModal}
        onClose={() => setShowLegendModal(false)}
      />

      <Modal visible={showLayersModal} transparent animationType="slide" onRequestClose={() => setShowLayersModal(false)}>
        <View style={styles.modalOverlayBottom}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowLayersModal(false)} />
          <View style={styles.menuBottom}>
            <View style={styles.menuHeader}>
              <Text style={[styles.modalTitle, { fontFamily: questrial }]}>Camadas do mapa</Text>
              <TouchableOpacity onPress={() => setShowLayersModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>
            <View style={styles.menuDivider} />
            {(Object.keys(visibilidade) as (keyof typeof visibilidade)[]).map((key) => {
              const labels: Record<keyof typeof visibilidade, string> = {
                municipios:     'MUNICÍPIOS',
                corposHidricos: 'CORPOS HÍDRICOS',
                pendentes:      'PENDENTES',
                pontosDeUso:    'PONTOS DE USO',
              };
              const on = visibilidade[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.toggleRow}
                  onPress={() => setVisibilidade((p) => ({ ...p, [key]: !p[key] }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleLabel, { fontFamily: questrial }]}>{labels[key]}</Text>
                  <View style={[styles.toggle, on && styles.toggleAtivo]}>
                    <View style={[styles.toggleCircle, on && styles.toggleCircleAtivo]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7f5' },

  // ── Header ────────────────────────────────────────────────────────────────
  headerGradient: { zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  headerSafe:     { paddingBottom: 10 },

  headerTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, marginBottom: 10 },

  // Espaçador: ocupa flex:1 dos dois lados → força o centro a ficar no meio
  headerSide:   { flex: 1 },
  headerIcons:  { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },

  // Logo + "TÉCNICO" lado a lado, centralizados
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo:   { height: 26, width: 120 },
  headerRole:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, fontWeight: '600' },

  iconBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge:     { position: 'absolute', top: -3, right: -3, backgroundColor: '#e53935', borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#0d4a3e' },
  notifBadgeText: { fontSize: 8, color: '#fff', fontWeight: '700' },

  headerTitleBlock: { paddingHorizontal: 18, marginBottom: 12 },
  pageTitle:        { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  pageSubtitle:     { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  searchRow:        { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  searchBox:        { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, paddingHorizontal: 12, height: 42, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  searchBoxFocused: { shadowOpacity: 0.18, elevation: 5 },
  searchInput:      { flex: 1, fontSize: 13, color: TEXT_DARK, paddingVertical: 0 },
  filterBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 12, paddingHorizontal: 14, height: 42 },
  filterBtnText:    { fontSize: 13, color: '#fff', fontWeight: '600' },

  mapTypeRow:        { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 2 },
  mapTypeBtn:        { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  mapTypeBtnActive:  { backgroundColor: '#fff', borderColor: '#fff' },
  mapTypeText:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  mapTypeTextActive: { color: PRIMARY, fontWeight: '700' },

  // ── Search dropdown ───────────────────────────────────────────────────────
  searchDropdown:     { position: 'absolute', left: 0, right: 0, zIndex: 100, marginTop: Platform.OS === 'ios' ? 210 : 190, backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 16, maxHeight: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, overflow: 'hidden' },
  searchDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  searchDropdownIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchDropdownName: { fontSize: 14, color: '#333', fontWeight: '600' },
  searchDropdownSub:  { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  pendentePill:       { backgroundColor: STATUS_YELLOW_BG, borderWidth: 1, borderColor: '#ffe082', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  pendentePillText:   { fontSize: 10, color: STATUS_YELLOW, fontWeight: '700' },

  // ── Map ───────────────────────────────────────────────────────────────────
  mapa:         { flex: 1 },
  customMarker: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5 },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar:      { position: 'absolute', left: 12, top: '35%', backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, overflow: 'hidden', zIndex: 5, transform: [{ translateY: -80 }] },
  sidebarBtn:   { alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', minWidth: 58 },
  sidebarLabel: { fontSize: 9, color: TEXT_DARK, marginTop: 3, fontWeight: '600', textAlign: 'center' },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  bottomSheet:       { position: 'absolute', bottom: NAV_HEIGHT, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10, zIndex: 10, overflow: 'hidden' },
  dragHandleWrapper: { alignItems: 'center', paddingVertical: 10 },
  dragHandle:        { width: 36, height: 4, backgroundColor: '#dde5e2', borderRadius: 2 },

  bsHeaderRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bsIconCircle:  { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bsNome:        { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  bsLocRow:      { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  bsLoc:         { fontSize: 12, color: TEXT_MUTED },
  bsAtualizacao: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },

  statusBadge:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginLeft: 6 },
  statusBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },

  bsCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f4f2', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  alertaBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: STATUS_RED_BG, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f5c6c6' },
  alertaText:   { flex: 1, fontSize: 13, color: STATUS_RED, fontWeight: '600' },

  bsSectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  bsSectionSub:   { fontSize: 11, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  statsRow:       { flexDirection: 'row', backgroundColor: '#f8faf8', borderRadius: 14, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statItem:       { flex: 1, alignItems: 'center', gap: 2 },
  statIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue:      { fontSize: 20, fontWeight: '700', color: TEXT_DARK, lineHeight: 24 },
  statLabel:      { fontSize: 9, color: TEXT_MUTED, textAlign: 'center', lineHeight: 12 },

  bsSituacaoBox:  { backgroundColor: '#f8faf8', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  bsSituacaoText: { fontSize: 13, color: TEXT_DARK, lineHeight: 19 },

  bsEstadoGrid:   { backgroundColor: '#f8faf8', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  bsEstadoRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  bsEstadoLabel:  { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  bsEstadoVal:    { fontSize: 13, color: TEXT_DARK, textAlign: 'right', flex: 1 },
  estadoBadge:    { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  estadoBadgeText:{ fontSize: 12, fontWeight: '600' },

  riscoBadgeRow: { marginBottom: 10 },
  riscoBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  riscoBadgeText:{ fontSize: 13, fontWeight: '700' },

  indicadoresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  indicadorItem:   { flex: 1, minWidth: '44%', backgroundColor: '#f8faf8', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
  indicadorLabel:  { fontSize: 11, color: TEXT_MUTED, marginBottom: 4, fontWeight: '600' },
  indicadorValor:  { fontSize: 16, fontWeight: '700' },

  bsBtnsSecRow: { flexDirection: 'row', gap: 8 },
  bsBtnSec:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f0f4f2', borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#dde8e4' },
  bsBtnSecText: { fontSize: 12, color: TEXT_DARK, fontWeight: '600' },

  bsTimestamp: { fontSize: 10, color: TEXT_MUTED, textAlign: 'center', marginTop: 4 },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 16 },
  menuBottom:         { backgroundColor: 'rgba(255,255,255,0.98)', width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%', elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  menuHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  menuDivider:        { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 16 },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:         { fontSize: 17, fontWeight: '700', color: TEXT_DARK },
  modalSectionTitle:  { fontSize: 13, fontWeight: '700', color: TEXT_DARK, marginBottom: 10 },
  modalDivider:       { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, borderWidth: 1.5, backgroundColor: '#f8f8f8' },
  chipDot:  { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13 },

  typeCard:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#f8faf8', marginBottom: 8, borderWidth: 1.5, borderColor: '#f0f0f0' },
  typeCardChecked:     { backgroundColor: '#e8f5ef', borderColor: '#b2dbc8' },
  typeCardIcon:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center' },
  typeCardIconChecked: { backgroundColor: PRIMARY },
  typeCardText:        { flex: 1, fontSize: 14, color: TEXT_MUTED, fontWeight: '500' },
  typeCardTextChecked: { color: TEXT_DARK, fontWeight: '600' },

  applyBtn:     { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  legendRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  legendIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  legendTitle:      { fontSize: 14, fontWeight: '700', color: TEXT_DARK, marginBottom: 2 },
  legendDesc:       { fontSize: 12, color: TEXT_MUTED, lineHeight: 16 },

  toggleRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, backgroundColor: '#f9fafa', marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  toggleLabel:       { fontSize: 14, fontWeight: '600', color: '#333' },
  toggle:            { width: 48, height: 26, backgroundColor: '#ddd', borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleAtivo:       { backgroundColor: PRIMARY },
  toggleCircle:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleCircleAtivo: { alignSelf: 'flex-end' },

  // ── Bottom nav (estilos removidos — usa TechnicalBottomNav) ─────────────────

  menuBtn:            { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  acoesRapidasRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  acaoCard:           { flex: 1, backgroundColor: '#f0f7f4', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#d0e8e0' },
  acaoCardIcon:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e6f5ef', alignItems: 'center', justifyContent: 'center' },
  acaoCardText:       { fontSize: 10, color: TEXT_DARK, fontWeight: '600', textAlign: 'center', lineHeight: 14 },
  bsActionsCollapsed: { marginBottom: 8, gap: 8 },
  bsBtnPrimary:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14 },
  bsBtnPrimaryText:   { fontSize: 14, color: '#fff', fontWeight: '700' },
});