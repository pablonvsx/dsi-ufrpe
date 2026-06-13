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
import { getCollaboratorMeasurementsByWaterBody } from '@/services/firestore/measurements';
import { useAuth } from '@/contexts/auth-context';
import TechnicalBottomNav from '@/components/technicalbottomnavbar';

import stateData from '@/assets/map_layers/pe_aquasense.json';
import municipiosData from '@/assets/map_layers/municipios_pe.json';

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY          = '#004d48';
const TEAL_MED         = '#0d6e52';
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

const SHEET_COLLAPSED = SCREEN_H * 0.55;
const SHEET_EXPANDED  = SCREEN_H * 0.88;

const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataHoraAtual(): string {
  const agora = new Date();
  const dia    = String(agora.getDate()).padStart(2, '0');
  const mes    = String(agora.getMonth() + 1).padStart(2, '0');
  const ano    = agora.getFullYear();
  const horas  = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} · ${horas}:${minutos}`;
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

// ─── Stat item ────────────────────────────────────────────────────────────────

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

// ─── Filter Modal ─────────────────────────────────────────────────────────────

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
    { key: 'all',       label: 'Todos',     color: PRIMARY,        bg: '#e8f5f0',        borderColor: PRIMARY        },
    { key: 'critical',  label: 'Críticos',  color: STATUS_RED,     bg: STATUS_RED_BG,    borderColor: STATUS_RED     },
    { key: 'attention', label: 'Atenção',   color: STATUS_YELLOW,  bg: STATUS_YELLOW_BG, borderColor: STATUS_YELLOW  },
    { key: 'normal',    label: 'Normais',   color: STATUS_GREEN,   bg: STATUS_GREEN_BG,  borderColor: STATUS_GREEN   },
    { key: 'nodata',    label: 'Sem dados', color: STATUS_GRAY,    bg: STATUS_GRAY_BG,   borderColor: STATUS_GRAY    },
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

// ─── Indicador item ───────────────────────────────────────────────────────────

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
  totalMedicoes,
  totalAnaliseTecnica,
  loadingResumo,
  sheetHeight,
  isExpanded,
  panHandlers,
  fontFamily,
  onNovaAnalise,
  onVerDetalhes,
  onVerHistorico,
}: {
  corpo: CorpoHidrico;
  resumo: ResumoObservacoes | null;
  totalMedicoes: number;
  totalAnaliseTecnica: number;
  loadingResumo: boolean;
  sheetHeight: Animated.Value;
  isExpanded: boolean;
  panHandlers: any;
  fontFamily?: string;
  onNovaAnalise: () => void;
  onVerDetalhes: () => void;
  onVerHistorico: () => void;
}) {
  const status = statusFromCorpo(corpo);
  const cfg    = statusConfig(status);

  const obs       = resumo?.totalObservacoes ?? 0;
  const medicoes  = totalMedicoes;
  const denuncias = (corpo as any).denunciasRecentes ?? 0;

  const situacaoAtual   = (corpo as any).situacaoAtual   ?? null;
  const indicadores     = (corpo as any).indicadores     ?? null;
  const estadoTecnico   = (corpo as any).estadoTecnico   ?? null;
  const riscoAmbiental  = (corpo as any).riscoAmbiental  ?? null;

  // Estado técnico — campos individuais com fallback para "—"
  const etStatus     = estadoTecnico?.status             ?? '—';
  const etPrioridade = estadoTecnico?.prioridade         ?? '—';
  const etUltima     = estadoTecnico?.ultimaAnalise      ?? '—';
  const etProxima    = estadoTecnico?.proximaRevisao     ?? '—';

  const corIndicador = (val: string) => {
    const v = val.toLowerCase();
    if (v === 'forte' || v === 'presente' || v === 'escura' || v === 'visível') return STATUS_RED;
    if (v === 'moderado' || v === 'moderada' || v === 'leve')                   return STATUS_YELLOW;
    return STATUS_GREEN;
  };

  const riscoConfig = () => {
    if (!riscoAmbiental) return null;
    const r = riscoAmbiental.toLowerCase();
    if (r === 'elevado') return { label: 'Elevado', color: STATUS_RED,    bg: STATUS_RED_BG    };
    if (r === 'médio' || r === 'medio') return { label: 'Médio', color: STATUS_YELLOW, bg: STATUS_YELLOW_BG };
    return { label: 'Baixo', color: STATUS_GREEN, bg: STATUS_GREEN_BG };
  };
  const risco = riscoConfig();

  const dataAtualizada = formatarDataHoraAtual();

  // Hora atual formatada para "Hoje, HH:MM"
  const horaAtual = `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`;

  return (
    <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
      {/* Drag handle */}
      <View style={styles.dragHandleWrapper} {...panHandlers}>
        <View style={styles.dragHandle} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={8}
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
                {[corpo.municipio, (corpo as any).estado].filter(Boolean).join(' - ') || 'Pernambuco'}
              </Text>
            </View>
            <Text style={[styles.bsAtualizacao, { fontFamily }]}>
              Última atualização: Hoje, {horaAtual}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color }]}>
            <Text style={styles.statusBadgeText}>{cfg.label}</Text>
          </View>
        </View>

        {/* ── Alerta crítico ──────────────────────────────────────────── */}
        {status === 'critical' && (
          <View style={styles.alertaBanner}>
            <Ionicons name="warning" size={16} color={STATUS_RED} />
            <Text style={[styles.alertaText, { fontFamily }]}>Risco elevado de contaminação</Text>
          </View>
        )}

        {/* ── Resumo operacional ───────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>
          Resumo operacional <Text style={styles.bsSectionSub}>(últimos 7 dias)</Text>
        </Text>

        <View style={styles.statsRow}>
          {loadingResumo ? (
            <ActivityIndicator color={TEAL_MED} size="small" style={{ flex: 1, paddingVertical: 12 }} />
          ) : (
            <>
              <StatItem
                icon="chatbubble-outline"
                value={obs}
                label={'Observações'}
                iconColor={TEAL_MED}
                iconBg="#e6f5ef"
              />
              <StatItem
                icon="flask-outline"
                value={medicoes}
                label={'Medições\nsimples'}
                iconColor="#2563c7"
                iconBg="#e8f0ff"
              />
              <StatItem
                icon="warning-outline"
                value={denuncias}
                label={'Denúncias\nrecentes'}
                iconColor={STATUS_YELLOW}
                iconBg={STATUS_YELLOW_BG}
              />
              <StatItem
                icon="document-text-outline"
                value={totalAnaliseTecnica}
                label={'Análise\ntécnica'}
                iconColor={PRIMARY}
                iconBg="#e8f5f0"
              />
            </>
          )}
        </View>

        {/* ── Situação atual ───────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Situação atual</Text>
        <View style={styles.bsSituacaoBox}>
          <Text style={[styles.bsSituacaoText, { fontFamily }]}>
            {situacaoAtual ?? 'Nenhum dado disponível'}
          </Text>
        </View>

        {/* ── Estado técnico ───────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Estado técnico</Text>
        <View style={styles.estadoTecnicoBox}>
          <View style={styles.estadoRow}>
            <Text style={[styles.estadoLabel, { fontFamily }]}>Status</Text>
            {etStatus !== '—' ? (
              <View style={styles.statusPillYellow}>
                <Text style={styles.statusPillText}>{etStatus}</Text>
              </View>
            ) : (
              <Text style={[styles.estadoValor, { fontFamily, color: TEXT_MUTED }]}>—</Text>
            )}
          </View>
          <View style={styles.estadoDivider} />
          <View style={styles.estadoRow}>
            <Text style={[styles.estadoLabel, { fontFamily }]}>Prioridade</Text>
            <Text style={[
              styles.estadoValor,
              { fontFamily },
              etPrioridade === 'Alta' && { color: STATUS_RED },
              etPrioridade === 'Média' && { color: STATUS_YELLOW },
              etPrioridade === 'Baixa' && { color: STATUS_GREEN },
              etPrioridade === '—' && { color: TEXT_MUTED },
            ]}>
              {etPrioridade}
            </Text>
          </View>
          <View style={styles.estadoDivider} />
          <View style={styles.estadoRow}>
            <Text style={[styles.estadoLabel, { fontFamily }]}>Última análise</Text>
            <Text style={[styles.estadoValor, { fontFamily, color: etUltima === '—' ? TEXT_MUTED : TEXT_DARK }]}>{etUltima}</Text>
          </View>
          <View style={styles.estadoDivider} />
          <View style={styles.estadoRow}>
            <Text style={[styles.estadoLabel, { fontFamily }]}>Próxima revisão sugerida</Text>
            <Text style={[styles.estadoValor, { fontFamily, color: etProxima === '—' ? TEXT_MUTED : TEXT_DARK }]}>{etProxima}</Text>
          </View>
        </View>

        {/* ── Risco ambiental ──────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Risco ambiental</Text>
        {risco ? (
          <View style={[styles.riscoBadge, { backgroundColor: risco.bg }]}>
            <Ionicons name="alert-circle" size={16} color={risco.color} />
            <Text style={[styles.riscoText, { color: risco.color, fontFamily }]}>{risco.label}</Text>
          </View>
        ) : (
          <View style={[styles.riscoBadge, { backgroundColor: STATUS_GRAY_BG }]}>
            <Text style={[styles.riscoText, { color: TEXT_MUTED, fontFamily }]}>Nenhum dado disponível</Text>
          </View>
        )}

        {/* ── Principais indicadores ───────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Principais indicadores</Text>
        {indicadores ? (
          <View style={styles.indicadoresGrid}>
            {indicadores.odor    && <IndicadorItem label="Odor"        valor={indicadores.odor}    cor={corIndicador(indicadores.odor)}    />}
            {indicadores.corAgua && <IndicadorItem label="Cor da água" valor={indicadores.corAgua} cor={corIndicador(indicadores.corAgua)} />}
            {indicadores.espuma  && <IndicadorItem label="Espuma"      valor={indicadores.espuma}  cor={corIndicador(indicadores.espuma)}  />}
            {indicadores.lixo    && <IndicadorItem label="Lixo"        valor={indicadores.lixo}    cor={corIndicador(indicadores.lixo)}    />}
          </View>
        ) : (
          <View style={styles.indicadoresGrid}>
            {(['Odor', 'Cor da água', 'Espuma', 'Lixo'] as const).map((lbl) => (
              <View key={lbl} style={styles.indicadorItem}>
                <Text style={styles.indicadorLabel}>{lbl}</Text>
                <Text style={[styles.indicadorValor, { color: TEXT_MUTED }]}>—</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Ações rápidas ────────────────────────────────────────────── */}
        <Text style={[styles.bsSectionTitle, { fontFamily }]}>Ações rápidas</Text>
        <View style={styles.acoesRow}>
          <TouchableOpacity style={styles.acaoCard} onPress={onVerDetalhes} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={22} color={PRIMARY} />
            <Text style={[styles.acaoLabel, { fontFamily }]}>Ver detalhes{'\n'}completos</Text>
            <Ionicons name="arrow-forward" size={14} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.acaoCard} onPress={onNovaAnalise} activeOpacity={0.8}>
            <Ionicons name="flask-outline" size={22} color={PRIMARY} />
            <Text style={[styles.acaoLabel, { fontFamily }]}>Nova análise{'\n'}técnica</Text>
            <Ionicons name="arrow-forward" size={14} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.acaoCard} onPress={onVerHistorico} activeOpacity={0.8}>
            <Ionicons name="time-outline" size={22} color={PRIMARY} />
            <Text style={[styles.acaoLabel, { fontFamily }]}>Ver histórico{'\n'}de registros</Text>
            <Ionicons name="arrow-forward" size={14} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* ── Análise técnica ──────────────────────────────────────────── */}
        <TouchableOpacity style={styles.bsBtnPrimary} onPress={onNovaAnalise} activeOpacity={0.85}>
          <Ionicons name="flask-outline" size={14} color="#fff" />
          <Text style={[styles.bsBtnPrimaryText, { fontFamily }]}>Nova análise técnica</Text>
          <Ionicons name="arrow-forward" size={13} color="#fff" />
        </TouchableOpacity>

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

  const [tipoMapa, setTipoMapa]               = useState<MapTypeKey>('satellite');
  const [showFilterModal, setShowFilterModal]   = useState(false);
  const [showLegendModal, setShowLegendModal]   = useState(false);
  const [showLayersModal, setShowLayersModal]   = useState(false);
  const [statusFilter, setStatusFilter]         = useState<StatusFilterKey>('all');

  const [visibilidade, setVisibilidade] = useState({
    municipios:     true,
    corposHidricos: true,
    pendentes:      true,
    pontosDeUso:    true,
  });

  const [corposValidados,  setCorposValidados]  = useState<CorpoHidrico[]>([]);
  const [corposPendentes,  setCorposPendentes]  = useState<CorpoHidrico[]>([]);
  const [pontosDeUso,      setPontosDeUso]      = useState<PontoDeUso[]>([]);
  const [loadingData,      setLoadingData]      = useState(true);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<CorpoHidrico[]>([]);

  const [selectedCorpo,       setSelectedCorpo]       = useState<CorpoHidrico | null>(null);
  const [resumo,               setResumo]               = useState<ResumoObservacoes | null>(null);
  const [totalMedicoes,        setTotalMedicoes]        = useState(0);
  const [totalAnaliseTecnica,  setTotalAnaliseTecnica]  = useState(0);
  const [loadingResumo,        setLoadingResumo]        = useState(false);
  const [detalheVisible,       setDetalheVisible]       = useState(false);

  const sheetHeight      = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightValue = useRef(SHEET_COLLAPSED);
  const lastGestureDy    = useRef(0);
  const isExpandedRef    = useRef(false);
  const [sheetIsExpanded, setSheetIsExpanded] = useState(false);
  const focusHandled     = useRef(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    sheetHeight.addListener(({ value }) => { sheetHeightValue.current = value; });
    return () => sheetHeight.removeAllListeners();
  }, []);

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
        const clamped = Math.max(SHEET_COLLAPSED * 0.5, Math.min(SHEET_EXPANDED, newVal));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_: any, { dy, vy }: any) => {
        const midPoint = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
        const goExpand = sheetHeightValue.current > midPoint || vy < -0.5;
        snapSheet(goExpand);
      },
    })
  ).current;

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

  const abrirDetalhes = useCallback(async (corpo: CorpoHidrico) => {
    setSelectedCorpo(corpo);
    setResumo(null);
    setTotalMedicoes(0);
    setTotalAnaliseTecnica(0);
    sheetHeight.setValue(SHEET_COLLAPSED);
    isExpandedRef.current = false;
    setSheetIsExpanded(false);
    setDetalheVisible(true);

    if (corpo.id) {
      setLastWaterBody(corpo.id);
      setLoadingResumo(true);
      try {
        // Busca observações, medições simples e análises técnicas em paralelo
        const [obs, medicoes, analisesSnap] = await Promise.all([
          buscarObservacoesPorCorpo(corpo.id),
          // getCollaboratorMeasurementsByWaterBody busca na coleção correta de medições
          getCollaboratorMeasurementsByWaterBody(corpo.id),
          // Busca análises técnicas na coleção 'analisesTecnicas' filtrada pelo corpo
          getDocs(query(
            collection(db, 'analisesTecnicas'),
            where('corpoHidricoId', '==', corpo.id)
          )),
        ]);
        setResumo(calcularResumoObservacoes(obs));
        setTotalMedicoes(medicoes.length);
        setTotalAnaliseTecnica(analisesSnap.size);
      } catch {
        setResumo(calcularResumoObservacoes([]));
        setTotalMedicoes(0);
        setTotalAnaliseTecnica(0);
      } finally {
        setLoadingResumo(false);
      }
    }
  }, [setLastWaterBody]);

  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 1000);
  };

  function applyStatusFilter(corpos: CorpoHidrico[]) {
    if (statusFilter === 'all') return corpos;
    return corpos.filter((c) => statusFromCorpo(c) === statusFilter);
  }

  const corposVisiveis    = applyStatusFilter(visibilidade.corposHidricos ? corposValidados : []);
  const pendentesVisiveis = applyStatusFilter(visibilidade.pendentes      ? corposPendentes : []);

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
              {/* Espaço vazio à esquerda para balancear o layout */}
              <View style={{ width: 36 }} />

              {/* Título centralizado */}
              <View style={styles.headerCenter}>
                <Text style={[styles.pageTitle, { fontFamily: questrial }]}>
                  Mapa de monitoramento
                </Text>
                <Text style={[styles.pageSubtitle, { fontFamily: questrial }]}>
                  Visão operacional dos corpos hídricos
                </Text>
              </View>

              {/* Logo AquaSense no canto superior direito (onde ficava o sino) */}
              <Image
                source={require('@/assets/images/aquasense.png')}
                style={styles.headerLogoRight}
                resizeMode="contain"
              />
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

        {/* ══ MAPA ═══════════════════════════════════════════════════════ */}
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
          onPress={() => {
            if (searchFocused) { Keyboard.dismiss(); setSearchFocused(false); }
          }}
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
          <TouchableOpacity
            style={styles.sidebarBtn}
            onPress={() => setShowLayersModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="layers-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Camadas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarBtn}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Filtros</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarBtn}
            onPress={() => setShowLegendModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Legenda</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sidebarBtn, { borderBottomWidth: 0 }]}
            onPress={goToMyLocation}
            activeOpacity={0.8}
          >
            <Ionicons name="locate-outline" size={22} color={TEXT_DARK} />
            <Text style={[styles.sidebarLabel, { fontFamily: questrial }]}>Localizar</Text>
          </TouchableOpacity>
        </View>

        {/* ══ BOTTOM SHEET ═══════════════════════════════════════════════ */}
        {detalheVisible && selectedCorpo && (
          <BottomSheet
            corpo={selectedCorpo}
            resumo={resumo}
            totalMedicoes={totalMedicoes}
            totalAnaliseTecnica={totalAnaliseTecnica}
            loadingResumo={loadingResumo}
            sheetHeight={sheetHeight}
            isExpanded={sheetIsExpanded}
            panHandlers={panResponder.panHandlers}
            fontFamily={questrial}
            onNovaAnalise={() => {
              router.push({ pathname: '/new_analysis', params: { corpoId: selectedCorpo.id } } as any);
            }}
            onVerDetalhes={() => {
              router.push({ pathname: '/water_body_details', params: { id: selectedCorpo.id } } as any);
            }}
            onVerHistorico={() => {
              router.push({ pathname: '/water_body_history', params: { id: selectedCorpo.id } } as any);
            }}
          />
        )}

        {/* ══ NAVBAR TÉCNICA ═════════════════════════════════════════════ */}
        <TechnicalBottomNav active="analises" fontFamily={questrial} />
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
  headerGradient: {
    zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  headerSafe: { paddingBottom: 10 },

  // Título + logo no canto direito — sem hambúrguer, sem sino, sem "TÉCNICO"
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  headerCenter: { flex: 1, alignItems: 'flex-start' },
  pageTitle:    { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  pageSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Logo no canto superior direito (onde ficava o sino)
  headerLogoRight: { width: 90, height: 28 },

  searchRow:        {
    flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10,
  },
  searchBox:        {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12,
    paddingHorizontal: 12, height: 42,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  searchBoxFocused: { shadowOpacity: 0.18, elevation: 5 },
  searchInput:      { flex: 1, fontSize: 13, color: TEXT_DARK, paddingVertical: 0 },
  filterBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12, paddingHorizontal: 14, height: 42,
  },
  filterBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  mapTypeRow:        { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 2 },
  mapTypeBtn:        {
    flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  mapTypeBtnActive:  { backgroundColor: '#fff', borderColor: '#fff' },
  mapTypeText:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  mapTypeTextActive: { color: PRIMARY, fontWeight: '700' },

  // ── Search dropdown ───────────────────────────────────────────────────────
  searchDropdown: {
    position: 'absolute', left: 0, right: 0, zIndex: 100,
    marginTop: Platform.OS === 'ios' ? 195 : 175,
    backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 16,
    maxHeight: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, overflow: 'hidden',
  },
  searchDropdownItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  searchDropdownIcon:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchDropdownName:  { fontSize: 14, color: '#333', fontWeight: '600' },
  searchDropdownSub:   { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  pendentePill:        { backgroundColor: STATUS_YELLOW_BG, borderWidth: 1, borderColor: '#ffe082', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  pendentePillText:    { fontSize: 10, color: STATUS_YELLOW, fontWeight: '700' },

  // ── Map ───────────────────────────────────────────────────────────────────
  mapa: { flex: 1 },
  customMarker: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: {
    position: 'absolute', left: 12, top: 16,
    backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
    overflow: 'hidden', zIndex: 5,
  },
  sidebarBtn:   { alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', minWidth: 58 },
  sidebarLabel: { fontSize: 9, color: TEXT_DARK, marginTop: 3, fontWeight: '600', textAlign: 'center' },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 12, zIndex: 20,
  },
  dragHandleWrapper: { alignItems: 'center', paddingVertical: 10 },
  dragHandle:        { width: 36, height: 4, backgroundColor: '#dde5e2', borderRadius: 2 },

  bsHeaderRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bsIconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bsNome:       { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  bsLocRow:     { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  bsLoc:        { fontSize: 12, color: TEXT_MUTED },
  bsAtualizacao:{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 },

  statusBadge:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginLeft: 6 },
  statusBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },

  alertaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: STATUS_RED_BG, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#f5c6c6',
  },
  alertaText: { flex: 1, fontSize: 13, color: STATUS_RED, fontWeight: '600' },

  bsSectionTitle: {
    fontSize: 11, fontWeight: '700', color: TEXT_MUTED,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, marginTop: 10,
  },
  bsSectionSub: { fontSize: 11, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  // Stats row — 4 colunas
  statsRow:       {
    flexDirection: 'row', backgroundColor: '#f8faf8', borderRadius: 14,
    padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  statItem:       { flex: 1, alignItems: 'center', gap: 2 },
  statIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue:      { fontSize: 18, fontWeight: '700', color: TEXT_DARK, lineHeight: 22 },
  statLabel:      { fontSize: 9, color: TEXT_MUTED, textAlign: 'center', lineHeight: 12 },

  bsSituacaoBox:  {
    backgroundColor: '#f8faf8', borderRadius: 12, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  bsSituacaoText: { fontSize: 13, color: TEXT_DARK, lineHeight: 19 },

  // ── Estado técnico ────────────────────────────────────────────────────────
  estadoTecnicoBox: {
    backgroundColor: '#f8faf8', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginBottom: 6,
    overflow: 'hidden',
  },
  estadoRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  estadoDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 14 },
  estadoLabel:   { fontSize: 13, color: TEXT_MUTED },
  estadoValor:   { fontSize: 13, color: TEXT_DARK, fontWeight: '600' },
  statusPillYellow: {
    backgroundColor: STATUS_YELLOW_BG, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#ffe082',
  },
  statusPillText: { fontSize: 12, color: STATUS_YELLOW, fontWeight: '700' },

  // ── Risco ambiental ───────────────────────────────────────────────────────
  riscoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 6,
  },
  riscoText: { fontSize: 14, fontWeight: '700' },

  // ── Indicadores ───────────────────────────────────────────────────────────
  indicadoresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  indicadorItem:   {
    flex: 1, minWidth: '44%', backgroundColor: '#f8faf8', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', alignItems: 'center',
  },
  indicadorLabel:  { fontSize: 11, color: TEXT_MUTED, marginBottom: 4, fontWeight: '600' },
  indicadorValor:  { fontSize: 16, fontWeight: '700' },

  // ── Ações rápidas ─────────────────────────────────────────────────────────
  acoesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  acaoCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8faf8', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 4,
  },
  acaoLabel: { fontSize: 11, color: TEXT_DARK, textAlign: 'center', fontWeight: '600', lineHeight: 15 },

  // ── Botão principal ───────────────────────────────────────────────────────
  bsBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginBottom: 8,
  },
  bsBtnPrimaryText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  bsTimestamp: { fontSize: 10, color: TEXT_MUTED, textAlign: 'center', marginTop: 4 },

  // ── Modais ────────────────────────────────────────────────────────────────
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard:          {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    width: '100%', maxWidth: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 16,
  },
  menuBottom: {
    backgroundColor: 'rgba(255,255,255,0.98)', width: '100%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '60%', elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
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
});