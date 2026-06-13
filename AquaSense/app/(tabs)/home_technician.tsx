import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/auth-context';
import { getCriticalAnalyses } from '@/services/firestore/critical_analyses';

// ─── Paleta ────────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#0d6e52';
const ORANGE       = '#E87D3E';
const BG           = '#F4F7F5';
const CARD         = '#FFFFFF';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type NavTabKey = 'home' | 'mapa' | 'alertas' | 'profile';

export interface PendingAnalysisData {
    count: number;
    lastTitle: string;
    lastMinutesAgo: number;
    highPriority: boolean;
}

export interface CriticalAnalysisData {
    count: number;
    points: string[];
    updatedMinutesAgo: number;
}

export interface LastAnalysisData {
    name: string;
    date: string;
    validated: boolean;
}

// ─── Valores iniciais ──────────────────────────────────────────────────────────
const EMPTY_PENDING: PendingAnalysisData = {
    count: 0, lastTitle: '—', lastMinutesAgo: 0, highPriority: false,
};
const EMPTY_CRITICAL: CriticalAnalysisData = {
    count: 0, points: [], updatedMinutesAgo: 0,
};
const EMPTY_LAST_ANALYSIS: LastAnalysisData = {
    name: '—', date: '—', validated: false,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(date: Date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatDate(date: Date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/** Converte Firestore Timestamp, Date ou string em Date. */
function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Timestamp) return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    // Objeto com seconds (Timestamp serializado)
    if (typeof val === 'object' && 'seconds' in (val as any)) {
        return new Date((val as any).seconds * 1000);
    }
    return null;
}

/** Retorna o título de um documento de análise com múltiplos fallbacks. */
function extractTitle(d: Record<string, any>): string {
    return d.titulo ?? d.nome ?? d.tipo ?? d.tipoAnalise ?? 'Análise';
}

/** Retorna o nome do ponto de um documento com múltiplos fallbacks. */
function extractPoint(d: Record<string, any>): string {
    return (
        d.corpoHidricoNome ??
        d.pontoMonitorado ??
        d.local ??
        d.localidade ??
        d.nome ??
        d.titulo ??
        '—'
    );
}

/** Minutos atrás em relação a agora. */
function minutesAgo(date: Date | null): number {
    if (!date) return 0;
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
}

const REGIAO_INICIAL = {
    latitude: -8.28, longitude: -37.95, latitudeDelta: 4.5, longitudeDelta: 4.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVIÇOS FIRESTORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ANÁLISES PENDENTES
 * Busca em cascata: "analises" → "medicoesColaborador" → "observacoes"
 * Retorna todos os docs com status pendente/em_analise.
 */
async function fetchPendingAnalyses(uid: string): Promise<PendingAnalysisData> {
    const statusValues = ['pendente', 'em_analise', 'aguardando', 'aguardando_analise'];

    // Fonte 1: coleção "analises" (coleção canônica do técnico)
    // Tenta com e sem filtro por tecnicoId — ambas são válidas dependendo do modelo.
    const sources: Array<{ col: string; field?: string }> = [
        { col: 'analises' },
        { col: 'medicoesColaborador' },
        { col: 'observacoes' },
    ];

    let allDocs: Array<Record<string, any>> = [];

    for (const src of sources) {
        try {
            const snap = await getDocs(
                query(
                    collection(db, src.col),
                    where('status', 'in', statusValues),
                    orderBy('criadoEm', 'desc'),
                )
            );

            if (snap.size > 0) {
                console.log(`[HomeTecnico] Pendentes: ${snap.size} docs em "${src.col}"`);
                allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                break; // usa a primeira coleção com resultados
            } else {
                console.log(`[HomeTecnico] Pendentes: "${src.col}" retornou 0 docs`);
            }
        } catch (e: any) {
            // Índice ausente ou coleção inexistente — tenta sem orderBy
            console.warn(`[HomeTecnico] Pendentes "${src.col}" com orderBy falhou, tentando sem:`, e?.code ?? e?.message);
            try {
                const snap2 = await getDocs(
                    query(collection(db, src.col), where('status', 'in', statusValues))
                );
                if (snap2.size > 0) {
                    console.log(`[HomeTecnico] Pendentes (sem orderBy): ${snap2.size} em "${src.col}"`);
                    allDocs = (snap2.docs
                        .map(d => ({ id: d.id, ...d.data() } as Record<string, any>))
                        .sort((a, b) => {
                            const da = toDate(a['criadoEm'])?.getTime() ?? 0;
                            const db2 = toDate(b['criadoEm'])?.getTime() ?? 0;
                            return db2 - da;
                        }));
                    break;
                }
            } catch (e2) {
                console.warn(`[HomeTecnico] Pendentes "${src.col}" sem orderBy também falhou:`, e2);
            }
        }
    }

    if (allDocs.length === 0) {
        console.log('[HomeTecnico] Pendentes: nenhum resultado em nenhuma coleção');
        return EMPTY_PENDING;
    }

    const latest = allDocs[0];
    const latestDate = toDate(latest.criadoEm ?? latest.atualizadoEm);
    const prioridade = (latest.prioridade ?? latest.urgencia ?? '').toLowerCase();
    const isHighPriority = prioridade === 'alta' || prioridade === 'critica' || prioridade === 'urgente';

    return {
        count: allDocs.length,
        lastTitle: extractTitle(latest),
        lastMinutesAgo: minutesAgo(latestDate),
        highPriority: isHighPriority,
    };
}

/**
 * ANÁLISES CRÍTICAS
 * Delega inteiramente ao service getCriticalAnalyses() que já contém
 * toda a lógica real de classificação: pH, temperatura, turbidez,
 * odor, cor, lixo e tipo de denúncia.
 * Coleções consultadas: medicoesColaborador + observacoes + denuncias.
 */
async function fetchCriticalAnalyses(): Promise<CriticalAnalysisData> {
    try {
        const items = await getCriticalAnalyses(100);

        console.log(`[HomeTecnico] Críticas: ${items.length} registros encontrados`);

        if (items.length === 0) return EMPTY_CRITICAL;

        // Pontos únicos com base em corpoHidricoNome (máx 3 para exibição)
        const points = [
            ...new Set(
                items
                    .map(i => i.corpoHidricoNome)
                    .filter((n): n is string => !!n && n !== 'Corpo hídrico')
            ),
        ].slice(0, 3);

        // Fallback: se todos têm o nome genérico, usa mesmo assim
        const displayPoints = points.length > 0
            ? points
            : [...new Set(items.map(i => i.corpoHidricoNome).filter(Boolean))].slice(0, 3);

        // Data de atualização mais recente entre todos os registros
        const latestDate = items
            .map(i => i.dataCriacao)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

        console.log(`[HomeTecnico] Críticas pontos: ${displayPoints.join(', ')}`);

        return {
            count: items.length,
            points: displayPoints,
            updatedMinutesAgo: minutesAgo(latestDate),
        };
    } catch (error) {
        console.error('[HomeTecnico] Erro em fetchCriticalAnalyses:', error);
        return EMPTY_CRITICAL;
    }
}

/**
 * ÚLTIMA ANÁLISE REALIZADA
 * Busca a análise mais recente com status validada/concluída feita pelo técnico.
 *
 * Tenta por tecnicoId → analisadoPorId → usuarioId (graceful degradation).
 */
async function fetchLastAnalysis(uid: string): Promise<LastAnalysisData> {
    const doneStatuses = ['validada', 'concluida', 'concluído', 'aprovada', 'finalizada'];

    // Lista de tentativas: [coleção, campo de vínculo com uid]
    const attempts: Array<{ col: string; uidField: string }> = [
        { col: 'analises',            uidField: 'tecnicoId'       },
        { col: 'analises',            uidField: 'analisadoPorId'  },
        { col: 'analises',            uidField: 'responsavelId'   },
        { col: 'analises',            uidField: 'usuarioId'       },
        { col: 'medicoesColaborador', uidField: 'analisadoPorId'  },
        { col: 'medicoesColaborador', uidField: 'tecnicoId'       },
        { col: 'medicoesColaborador', uidField: 'usuarioId'       },
    ];

    for (const attempt of attempts) {
        // Tenta com orderBy+limit (requer índice composto)
        for (const useOrderBy of [true, false]) {
            try {
                const constraints: any[] = [
                    where(attempt.uidField, '==', uid),
                    where('status', 'in', doneStatuses),
                ];
                if (useOrderBy) {
                    constraints.push(orderBy('criadoEm', 'desc'));
                    constraints.push(limit(1));
                }

                const snap = await getDocs(query(collection(db, attempt.col), ...constraints));

                if (snap.size > 0) {
                    // Se veio sem orderBy, ordenar manualmente
                    const docs = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as Record<string, any>))
                        .sort((a, b) => {
                            const da = toDate(a.criadoEm ?? a.atualizadoEm)?.getTime() ?? 0;
                            const db2 = toDate(b.criadoEm ?? b.atualizadoEm)?.getTime() ?? 0;
                            return db2 - da;
                        });

                    const d = docs[0];
                    const docDate = toDate(d.criadoEm ?? d.atualizadoEm ?? d.dataAnalise ?? d.analisadoEm);
                    const isValidated =
                        d.validadoPeloGestor === true ||
                        d.status === 'validada' ||
                        d.status === 'aprovada';

                    const dateStr = docDate
                        ? `${formatDate(docDate)} • ${formatTime(docDate)}`
                        : '—';

                    console.log(
                        `[HomeTecnico] Última análise: "${extractTitle(d)}" | col: ${attempt.col} | campo: ${attempt.uidField} | status: ${d.status}`
                    );

                    return {
                        name: extractTitle(d),
                        date: dateStr,
                        validated: isValidated,
                    };
                }

                // Se chegou aqui com orderBy e tamanho 0, tenta sem orderBy na próxima iteração
                if (useOrderBy) continue;
                // Sem orderBy também 0 — vai para próximo attempt
                break;

            } catch (e: any) {
                if (useOrderBy) {
                    console.warn(
                        `[HomeTecnico] Última análise "${attempt.col}"/"${attempt.uidField}" com orderBy falhou (índice?), tentando sem:`,
                        e?.code ?? e?.message
                    );
                    continue; // tenta sem orderBy
                }
                console.warn(
                    `[HomeTecnico] Última análise "${attempt.col}"/"${attempt.uidField}":`,
                    e?.code ?? e?.message
                );
                break;
            }
        }
    }

    console.log('[HomeTecnico] Última análise: nenhum resultado em nenhuma tentativa');
    return EMPTY_LAST_ANALYSIS;
}

// ─── Header ────────────────────────────────────────────────────────────────────
interface HeaderProps { cityLabel: string; loading: boolean; fontFamily?: string; }
const Header: React.FC<HeaderProps> = ({ cityLabel, loading, fontFamily }) => (
    <LinearGradient
        colors={['#0d5c47', '#0d4a3e']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
    >
        <View style={styles.headerLeft}>
            <Ionicons name="location-outline" size={14} color="#7ecfb3" />
            <View style={{ marginLeft: 7 }}>
                <Text style={[styles.headerCity, { fontFamily }]}>
                    {loading ? 'Localizando...' : cityLabel}
                </Text>
                <Text style={[styles.headerTeam, { fontFamily }]}>Equipe Técnica</Text>
            </View>
        </View>
        <Image
            source={require('../../assets/images/aquasense.png')}
            style={styles.headerLogo}
            resizeMode="contain"
        />
    </LinearGradient>
);

// ─── TitleBlock ────────────────────────────────────────────────────────────────
interface TitleBlockProps { fontFamily?: string; }
const TitleBlock: React.FC<TitleBlockProps> = ({ fontFamily }) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);
    return (
        <LinearGradient
            colors={['#0d5c47', '#0d4a3e', '#0a3d32']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={styles.titleBlock}
        >
            <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.titleMain, { fontFamily }]}>Painel Técnico</Text>
                <Text style={[styles.titleSub, { fontFamily }]}>
                    Acompanhe e analise as demandas técnicas{'\n'}da sua equipe em tempo real.
                </Text>
            </View>
            <View style={styles.updatedBadge}>
                <View style={styles.updatedBadgeRow}>
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
                    <Text style={[styles.updatedTitle, { fontFamily }]}>Atualizado agora</Text>
                </View>
                <Text style={[styles.updatedDate, { fontFamily }]}>
                    {formatTime(now)} • {formatDate(now)}
                </Text>
            </View>
        </LinearGradient>
    );
};

// ─── Card: Análises pendentes ──────────────────────────────────────────────────
interface PendingCardProps { data: PendingAnalysisData; onPress: () => void; fontFamily?: string; loading?: boolean; }
const PendingCard: React.FC<PendingCardProps> = ({ data, onPress, fontFamily, loading }) => (
    <View style={styles.card}>
        <View style={styles.cardRow}>
            <View style={styles.iconCircleGreen}>
                <Ionicons name="document-text-outline" size={22} color={PRIMARY_MID} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.cardTitle, { fontFamily }]}>Análises pendentes</Text>
                <Text style={[styles.cardDesc, { fontFamily }]}>
                    Demandas aguardando{'\n'}sua análise técnica
                </Text>
            </View>
            <View style={styles.countRow}>
                {loading
                    ? <ActivityIndicator color={PRIMARY_MID} size="small" style={{ marginRight: 8 }} />
                    : <Text style={[styles.countNumber, { fontFamily }]}>{data.count}</Text>
                }
                <Ionicons name="chevron-forward" size={18} color="#1a1a1a" />
            </View>
        </View>

        <View style={styles.lastReceived}>
            <Ionicons name="time-outline" size={14} color={PRIMARY_MID} style={{ marginTop: 1, flexShrink: 0 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.lastReceivedLabel, { fontFamily }]}>Última recebida</Text>
                {loading
                    ? <ActivityIndicator color={PRIMARY_MID} size="small" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
                    : <>
                        <Text style={[styles.lastReceivedTitle, { fontFamily }]}>{data.lastTitle}</Text>
                        <Text style={[styles.lastReceivedTime, { fontFamily }]}>
                            {data.lastMinutesAgo === 0 ? 'Agora mesmo' : `Há ${data.lastMinutesAgo} minutos`}
                        </Text>
                    </>
                }
            </View>
            {!loading && data.highPriority && (
                <View style={styles.priorityBadge}>
                    <Text style={[styles.priorityText, { fontFamily }]}>Prioridade alta</Text>
                    <View style={styles.priorityDot} />
                </View>
            )}
        </View>

        <TouchableOpacity style={styles.cardFooterBtn} onPress={onPress} activeOpacity={0.7}>
            <Text style={[styles.cardFooterBtnText, { fontFamily }]}>Ver todas as análises pendentes</Text>
            <Ionicons name="arrow-forward" size={15} color={PRIMARY_MID} />
        </TouchableOpacity>
    </View>
);

// ─── Cards inferiores ──────────────────────────────────────────────────────────
interface BottomCardsProps {
    critical: CriticalAnalysisData;
    lastAnalysis: LastAnalysisData;
    onCriticalPress: () => void;
    onDetailsPress: () => void;
    fontFamily?: string;
    loadingCritical?: boolean;
    loadingLast?: boolean;
}
const BottomCards: React.FC<BottomCardsProps> = ({
    critical, lastAnalysis, onCriticalPress, onDetailsPress,
    fontFamily, loadingCritical, loadingLast,
}) => (
    <View style={styles.bottomRow}>
        {/* Análises críticas */}
        <View style={[styles.card, styles.bottomCard, styles.criticalCard]}>
            <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="warning-outline" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.cardTitle, { fontFamily }]}>Análises críticas</Text>
                    <Text style={[styles.cardDesc, { fontFamily }]}>Requerem atenção{'\n'}imediata</Text>
                </View>
            </View>
            <View style={[styles.countRow, { marginTop: 10 }]}>
                {loadingCritical
                    ? <ActivityIndicator color={ORANGE} size="small" style={{ marginRight: 8 }} />
                    : <Text style={[styles.countNumber, { color: ORANGE, fontFamily }]}>{critical.count}</Text>
                }
                <Ionicons name="chevron-forward" size={18} color="#1a1a1a" />
            </View>
            <View style={styles.criticalPoints}>
                <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                <View style={{ marginLeft: 4, flex: 1 }}>
                    <Text style={[styles.criticalPointsLabel, { fontFamily }]}>Principais pontos</Text>
                    {loadingCritical
                        ? <ActivityIndicator color={TEXT_MUTED} size="small" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
                        : <>
                            <Text style={[styles.criticalPointsNames, { fontFamily }]} numberOfLines={2}>
                                {critical.points.length > 0 ? critical.points.join(' • ') : '—'}
                            </Text>
                            <Text style={[styles.criticalPointsTime, { fontFamily }]}>
                                {critical.updatedMinutesAgo === 0
                                    ? 'Agora mesmo'
                                    : `Atualizado há ${critical.updatedMinutesAgo} min`}
                            </Text>
                        </>
                    }
                </View>
            </View>
            <TouchableOpacity style={styles.criticalFooter} onPress={onCriticalPress} activeOpacity={0.7}>
                <Text style={[styles.criticalFooterText, { fontFamily }]}>Ver análises críticas</Text>
                <Ionicons name="arrow-forward" size={13} color={ORANGE} />
            </TouchableOpacity>
        </View>

        {/* Última análise */}
        <View style={[styles.card, styles.bottomCard]}>
            <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#EAF4F1' }]}>
                    <Ionicons name="time-outline" size={20} color={PRIMARY_MID} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.cardTitle, { fontFamily }]}>Última análise{'\n'}realizada</Text>
                    <Text style={[styles.cardDesc, { fontFamily }]}>Acompanhe seu{'\n'}último trabalho</Text>
                </View>
            </View>
            {loadingLast
                ? <ActivityIndicator color={PRIMARY_MID} size="small" style={{ alignSelf: 'flex-start', marginTop: 12 }} />
                : <>
                    <Text style={[styles.lastAnalysisTitle, { fontFamily }]} numberOfLines={2}>
                        {lastAnalysis.name}
                    </Text>
                    <View style={styles.lastAnalysisDate}>
                        <Ionicons name="calendar-outline" size={13} color={TEXT_MUTED} />
                        <Text style={[styles.lastAnalysisDateText, { fontFamily }]}>{lastAnalysis.date}</Text>
                    </View>
                    {lastAnalysis.validated && (
                        <View style={styles.validatedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={PRIMARY_MID} />
                            <Text style={[styles.validatedText, { fontFamily }]}>Validada pelo gestor</Text>
                        </View>
                    )}
                </>
            }
            <TouchableOpacity style={styles.detailsBtn} onPress={onDetailsPress} activeOpacity={0.7}>
                <Text style={[styles.detailsBtnText, { fontFamily }]}>Ver detalhes</Text>
                <Ionicons name="arrow-forward" size={13} color={PRIMARY_MID} />
            </TouchableOpacity>
        </View>
    </View>
);

// ─── Mapa ──────────────────────────────────────────────────────────────────────
const MAP_LEGEND = [
    { color: '#E53935', label: 'Crítico (2)' },
    { color: ORANGE,    label: 'Atenção (3)' },
    { color: PRIMARY_MID, label: 'Normal (5)' },
    { color: '#9E9E9E', label: 'Sem dados (1)' },
];

interface MapSectionProps { onViewMap: () => void; fontFamily?: string; }
const MapSection: React.FC<MapSectionProps> = ({ onViewMap, fontFamily }) => (
    <View style={styles.mapSection}>
        <View style={styles.mapHeader}>
            <View>
                <Text style={[styles.mapTitle, { fontFamily }]}>Mapa técnico</Text>
                <Text style={[styles.mapSubtitle, { fontFamily }]}>Visão geral dos pontos monitorados</Text>
            </View>
            <TouchableOpacity style={styles.mapCompleteBtn} onPress={onViewMap} activeOpacity={0.7}>
                <Text style={[styles.mapCompleteBtnText, { fontFamily }]}>Ver mapa completo</Text>
                <Ionicons name="map-outline" size={14} color={PRIMARY_MID} />
            </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={onViewMap}>
            <View style={styles.mapContainer}>
                <MapView
                    style={StyleSheet.absoluteFill}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={REGIAO_INICIAL}
                    scrollEnabled={false} zoomEnabled={false}
                    rotateEnabled={false} pitchEnabled={false}
                    pointerEvents="none"
                />
                <View style={styles.mapLegend}>
                    {MAP_LEGEND.map(item => (
                        <View key={item.label} style={styles.mapLegendItem}>
                            <View style={[styles.mapLegendDot, { backgroundColor: item.color }]} />
                            <Text style={[styles.mapLegendText, { fontFamily }]}>{item.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </TouchableOpacity>
    </View>
);

// ─── Tab bar ───────────────────────────────────────────────────────────────────
interface TabBarProps { active: NavTabKey; onTab: (tab: NavTabKey) => void; onAdd: () => void; fontFamily?: string; }
const TabBar: React.FC<TabBarProps> = ({ active, onTab, onAdd, fontFamily }) => {
    const leftTabs:  { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
        { key: 'home', icon: 'home-outline', label: 'Home' },
        { key: 'mapa', icon: 'map-outline',  label: 'Mapa' },
    ];
    const rightTabs: { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
        { key: 'alertas', icon: 'notifications-outline', label: 'Alertas' },
        { key: 'profile', icon: 'person-outline',        label: 'Perfil'  },
    ];
    const renderTab = (t: typeof leftTabs[0]) => {
        const isActive = active === t.key;
        return (
            <TouchableOpacity key={t.key} style={styles.navTabItem} onPress={() => onTab(t.key)} activeOpacity={0.7}>
                <Ionicons
                    name={isActive ? t.icon.replace('-outline', '') as any : t.icon}
                    size={23} color={isActive ? PRIMARY : '#aaa'}
                />
                <Text style={[styles.navTabLabel, { fontFamily }, isActive && styles.navTabLabelActive]}>
                    {t.label}
                </Text>
            </TouchableOpacity>
        );
    };
    return (
        <View style={styles.tabBar}>
            {leftTabs.map(renderTab)}
            <TouchableOpacity style={styles.tabAddBtn} onPress={onAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
            {rightTabs.map(renderTab)}
        </View>
    );
};

// ─── Tela principal ────────────────────────────────────────────────────────────
export default function HomeTechnician() {
    const router   = useRouter();
    const { user, userProfile } = useAuth();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const fontFamily = fontsLoaded ? 'Questrial_400Regular' : undefined;

    const [activeTab, setActiveTab] = useState<NavTabKey>('home');
    useFocusEffect(useCallback(() => { setActiveTab('home'); }, []));

    const [cityLabel,       setCityLabel]       = useState('Carregando...');
    const [locationLoading, setLocationLoading] = useState(true);

    // ── Estado dos dados ───────────────────────────────────────────────────────
    const [pendingData,      setPendingData]      = useState<PendingAnalysisData>(EMPTY_PENDING);
    const [criticalData,     setCriticalData]     = useState<CriticalAnalysisData>(EMPTY_CRITICAL);
    const [lastAnalysisData, setLastAnalysisData] = useState<LastAnalysisData>(EMPTY_LAST_ANALYSIS);

    const [loadingPending,  setLoadingPending]  = useState(true);
    const [loadingCritical, setLoadingCritical] = useState(true);
    const [loadingLast,     setLoadingLast]     = useState(true);

    // Evita múltiplas buscas paralelas
    const fetchRef = useRef(false);

    // ── Localização ────────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') { setCityLabel('Sem localização'); return; }
                const loc = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync(loc.coords);
                if (place) {
                    const city  = place.city ?? place.subregion ?? '';
                    const state = place.region ?? '';
                    setCityLabel(`${city} - ${state}`);
                }
            } catch {
                setCityLabel('Localização indisponível');
            } finally {
                setLocationLoading(false);
            }
        })();
    }, []);

    // ── Busca de dados Firestore ───────────────────────────────────────────────
    // Usa userProfile?.uid (mesmo padrão do colaborador) com fallback para user?.uid
    useEffect(() => {
        const uid = (userProfile as any)?.uid ?? user?.uid;
        if (!uid) return;
        if (fetchRef.current) return;
        fetchRef.current = true;

        console.log('[HomeTecnico] Iniciando busca de dados para uid:', uid);

        // As três buscas são independentes — falha de uma não bloqueia as outras
        fetchPendingAnalyses(uid)
            .then(data => setPendingData(data))
            .catch(e => console.error('[HomeTecnico] Erro inesperado em pendentes:', e))
            .finally(() => setLoadingPending(false));

        fetchCriticalAnalyses()
            .then(data => setCriticalData(data))
            .catch(e => console.error('[HomeTecnico] Erro inesperado em críticas:', e))
            .finally(() => setLoadingCritical(false));

        fetchLastAnalysis(uid)
            .then(data => setLastAnalysisData(data))
            .catch(e => console.error('[HomeTecnico] Erro inesperado em última análise:', e))
            .finally(() => setLoadingLast(false));

    }, [(userProfile as any)?.uid ?? user?.uid]);

    // ── Navegação ──────────────────────────────────────────────────────────────
    const handleTab = useCallback((tab: NavTabKey) => {
        setActiveTab(tab);
        if (tab === 'mapa')    router.push('/(tabs)/map'     as any);
        if (tab === 'alertas') router.push('/alerts'         as any);
        if (tab === 'profile') router.replace('/(tabs)/profile' as any);
    }, [router]);

    const handleAdd      = useCallback(() => router.push('/(tabs)/register_observation' as any), [router]);
    const handlePending  = useCallback(() => router.replace('/(tabs)/pending_analyses'  as any), [router]);
    const handleCritical = useCallback(() => router.push('/(tabs)/critical_analyses'    as any), [router]);
    const handleDetails  = useCallback(() => router.push('/(tabs)/last_analysis'        as any), [router]);
    const handleViewMap  = useCallback(() => router.push('/(tabs)/map'                  as any), [router]);

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
                <ActivityIndicator color={PRIMARY} size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            <Header cityLabel={cityLabel} loading={locationLoading} fontFamily={fontFamily} />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <TitleBlock fontFamily={fontFamily} />

                <PendingCard
                    data={pendingData}
                    onPress={handlePending}
                    fontFamily={fontFamily}
                    loading={loadingPending}
                />

                <BottomCards
                    critical={criticalData}
                    lastAnalysis={lastAnalysisData}
                    onCriticalPress={handleCritical}
                    onDetailsPress={handleDetails}
                    fontFamily={fontFamily}
                    loadingCritical={loadingCritical}
                    loadingLast={loadingLast}
                />

                <MapSection onViewMap={handleViewMap} fontFamily={fontFamily} />

                <View style={{ height: 24 }} />
            </ScrollView>

            <TabBar active={activeTab} onTab={handleTab} onAdd={handleAdd} fontFamily={fontFamily} />
        </SafeAreaView>
    );
}

// ─── Styles (idêntico ao home_tecnico_fixed — nenhuma alteração de layout) ─────
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PRIMARY },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerCity: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
    headerTeam: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 1 },
    headerLogo: { width: 52, height: 52 },
    scroll:        { flex: 1, backgroundColor: BG },
    scrollContent: { paddingBottom: 16 },
    titleBlock: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30, gap: 12,
    },
    titleMain: { color: '#ffffff', fontSize: 28, fontWeight: '800', marginBottom: 6, lineHeight: 32 },
    titleSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19 },
    updatedBadge: {
        backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14,
        paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', minWidth: 130, gap: 4,
    },
    updatedBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    updatedTitle:    { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    updatedDate:     { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
    card: {
        backgroundColor: CARD, borderRadius: 16, marginHorizontal: 16, marginTop: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08,
        shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    },
    cardRow:   { flexDirection: 'row', alignItems: 'flex-start' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
    cardDesc:  { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },
    countRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
    countNumber: { fontSize: 38, fontWeight: '800', color: '#1a1a1a', lineHeight: 44 },
    iconCircleGreen: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#EAF4F1',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    iconCircle: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF4F1',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    lastReceived: {
        flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F5F9F8',
        borderRadius: 10, padding: 12, marginTop: 14, gap: 6,
        borderWidth: 1, borderColor: '#e8f2ee',
    },
    lastReceivedLabel: { fontSize: 11, color: '#aaa', marginBottom: 2 },
    lastReceivedTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
    lastReceivedTime:  { fontSize: 11, color: '#aaa', marginTop: 2 },
    priorityBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4ED',
        borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5,
        gap: 5, alignSelf: 'flex-start', flexShrink: 0,
    },
    priorityText: { fontSize: 11, color: ORANGE, fontWeight: '600' },
    priorityDot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
    cardFooterBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER_LIGHT,
    },
    cardFooterBtnText: { fontSize: 13, color: PRIMARY_MID, fontWeight: '600' },
    bottomRow:    { flexDirection: 'row', marginHorizontal: 16, gap: 12, marginTop: 16 },
    bottomCard:   { flex: 1, marginHorizontal: 0, marginTop: 0 },
    criticalCard: { borderLeftWidth: 3, borderLeftColor: ORANGE },
    criticalPoints: {
        flexDirection: 'row', backgroundColor: '#FFF8F4', borderRadius: 8,
        padding: 8, marginTop: 10, borderWidth: 1, borderColor: '#F5DDD0',
    },
    criticalPointsLabel: { fontSize: 10, color: '#aaa', marginBottom: 2 },
    criticalPointsNames: { fontSize: 11, fontWeight: '700', color: '#1a1a1a', lineHeight: 15 },
    criticalPointsTime:  { fontSize: 10, color: '#aaa', marginTop: 2 },
    criticalFooter: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER_LIGHT,
    },
    criticalFooterText: { fontSize: 12, color: ORANGE, fontWeight: '600' },
    lastAnalysisTitle: {
        fontSize: 16, fontWeight: '800', color: '#1a1a1a',
        marginTop: 10, marginBottom: 4, lineHeight: 21,
    },
    lastAnalysisDate: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    lastAnalysisDateText: { fontSize: 11, color: TEXT_MUTED },
    validatedBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF4F1',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 5,
        alignSelf: 'flex-start', marginBottom: 10,
    },
    validatedText: { fontSize: 11, color: PRIMARY_MID, fontWeight: '600' },
    detailsBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER_LIGHT,
    },
    detailsBtnText: { fontSize: 12, color: PRIMARY_MID, fontWeight: '600' },
    mapSection: { marginHorizontal: 16, marginTop: 24 },
    mapHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 12,
    },
    mapTitle:    { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
    mapSubtitle: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
    mapCompleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    mapCompleteBtnText: { fontSize: 12, color: PRIMARY_MID, fontWeight: '600' },
    mapContainer: {
        borderRadius: 14, overflow: 'hidden', height: 190,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    },
    mapLegend: {
        position: 'absolute', bottom: 10, right: 10,
        backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 8, gap: 5,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
    },
    mapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapLegendDot:  { width: 9, height: 9, borderRadius: 4.5 },
    mapLegendText: { fontSize: 11, color: '#1a1a1a', fontWeight: '500' },
    tabBar: {
        flexDirection: 'row', backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 0 : 8, paddingTop: 10, paddingHorizontal: 8,
        alignItems: 'center', justifyContent: 'space-around',
        borderTopWidth: 1, borderTopColor: BORDER_LIGHT,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
    },
    navTabItem:        { alignItems: 'center', flex: 1, paddingVertical: 2 },
    navTabLabel:       { fontSize: 11, color: '#aaa', marginTop: 3 },
    navTabLabelActive: { color: PRIMARY, fontWeight: '600' },
    tabAddBtn: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY,
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45, shadowRadius: 8, elevation: 8,
    },
});