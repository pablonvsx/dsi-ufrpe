import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    FlatList,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import {
    CriticalAnalysis,
    getCriticalAnalyses,
} from '@/services/firestore/critical_analyses';
import {
    TechnicalAnalysisItem,
    getPendingAnalyses,
    getDoneAnalyses,
} from '@/services/firestore/technicalAnalyses';

// CORREÇÃO 4+5: navbar reutilizável
import TechnicalBottomNav from '@/components/technicalbottomnavbar';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#2D6A5A';
const TEAL         = '#0a6b5e';
const ORANGE       = '#E87D3E';
const AMBER        = '#C49A00';
const RED          = '#e53935';
const BG           = '#F4F7F5';
const CARD         = '#FFFFFF';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TabKey    = 'pendentes' | 'criticas' | 'historico';
type StatusType = 'CRÍTICO' | 'ATENÇÃO' | 'PENDENTE';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function minutosAtras(date: Date) {
    const min = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (min < 1)  return 'Agora';
    if (min < 60) return `Há ${min} min`;
    const h = Math.floor(min / 60);
    return h === 1 ? 'Há 1 h' : `Há ${h} h`;
}

function formatarDataCurta(date: Date) {
    const hoje = new Date();
    const mesmoDia =
        date.getDate()     === hoje.getDate()     &&
        date.getMonth()    === hoje.getMonth()    &&
        date.getFullYear() === hoje.getFullYear();
    const hora = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return mesmoDia
        ? `Hoje, ${hora}`
        : `${date.toLocaleDateString('pt-BR')} · ${hora}`;
}

function origemLabel(origem: TechnicalAnalysisItem['origem'] | CriticalAnalysis['origem']) {
    if (origem === 'medicao')    return 'Medição simples';
    if (origem === 'observacao') return 'Observação';
    return 'Denúncia';
}

function resolveStatusType(item: TechnicalAnalysisItem): StatusType {
    const c = item.classificacao ?? item.nivelRisco ?? item.statusQualidade ?? '';
    if (c === 'critica' || c === 'critico') return 'CRÍTICO';
    if (c === 'atencao' || c === 'alto')    return 'ATENÇÃO';
    return 'PENDENTE';
}

/** Valida se o valor recebido via params é uma TabKey válida. */
function toTabKey(value: unknown): TabKey {
    if (value === 'pendentes' || value === 'criticas' || value === 'historico') {
        return value;
    }
    return 'pendentes';
}

// ─── Badge de status ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: StatusType }> = ({ status }) => {
    const config = {
        'CRÍTICO': { bg: '#FFF0E6', color: ORANGE,      border: '#F9C89E' },
        'ATENÇÃO': { bg: '#FFFCE6', color: AMBER,       border: '#F0E080' },
        'PENDENTE':{ bg: '#F0F4F3', color: PRIMARY_MID, border: '#C8E6E0' },
    }[status];
    return (
        <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
            <Text style={[styles.badgeText, { color: config.color }]}>{status}</Text>
        </View>
    );
};

// ─── Card pendente / histórico ────────────────────────────────────────────────
const PendingCard: React.FC<{
    item: TechnicalAnalysisItem;
    onAnalyze: (id: string) => void;
}> = ({ item, onAnalyze }) => {
    const statusType = resolveStatusType(item);

    const leftBorderColor =
        statusType === 'CRÍTICO' ? ORANGE :
        statusType === 'ATENÇÃO' ? AMBER  : 'transparent';

    const iconName: keyof typeof Ionicons.glyphMap =
        item.origem === 'observacao' ? 'document-text-outline' :
        item.origem === 'denuncia'   ? 'alert-circle-outline'  : 'flask-outline';

    const iconBg =
        statusType === 'CRÍTICO' ? '#FFF0E6' :
        statusType === 'ATENÇÃO' ? '#FFFCE6' : '#EAF4F1';

    const iconColor =
        statusType === 'CRÍTICO' ? ORANGE :
        statusType === 'ATENÇÃO' ? AMBER  : PRIMARY_MID;

    return (
        <View style={[styles.card, { borderLeftColor: leftBorderColor }]}>
            <View style={styles.cardTop}>
                <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.cardName}>{item.corpoHidricoNome}</Text>
                    <Text style={styles.cardMeta}>
                        {origemLabel(item.origem)}
                        {' · '}
                        <Text style={{ color: PRIMARY_MID, fontWeight: '600' }}>{item.colaboradorNome}</Text>
                    </Text>
                </View>
                <StatusBadge status={statusType} />
            </View>

            {item.origem === 'medicao' && item.parametros && item.parametros.length > 0 && (
                <View style={styles.metricsRow}>
                    {item.parametros.slice(0, 4).map((p, idx) => (
                        <View key={idx} style={styles.metric}>
                            <View style={styles.metricLabel}>
                                <Ionicons
                                    name={(p.icon as keyof typeof Ionicons.glyphMap) ?? 'analytics-outline'}
                                    size={11}
                                    color={p.severity === 'critico' ? RED : PRIMARY_MID}
                                />
                                <Text style={styles.metricLabelText}>{p.label}</Text>
                            </View>
                            <Text style={[
                                styles.metricValue,
                                p.severity === 'critico' && { color: RED },
                            ]}>
                                {p.value}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {item.descricao && item.origem !== 'medicao' && (
                <View style={styles.obsBox}>
                    <Ionicons name="chatbubble-outline" size={14} color={PRIMARY_MID} style={{ marginTop: 1 }} />
                    <Text style={styles.obsText}>{item.descricao}</Text>
                </View>
            )}

            <View style={styles.cardFooter}>
                <View style={styles.footerMeta}>
                    <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.footerText}>{formatarDataCurta(item.dataCriacao)}</Text>
                    </View>
                    <View style={styles.footerItem}>
                        <Ionicons name="person-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.footerText}>{item.colaboradorNome}</Text>
                    </View>
                    {(item.cidade || item.estado) && (
                        <View style={styles.footerItem}>
                            <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.footerText}>
                                {[item.cidade, item.estado].filter(Boolean).join(' - ')}
                            </Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.analyzeBtn}
                    onPress={() => onAnalyze(item.id)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.analyzeBtnText}>Analisar</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── Card crítico ─────────────────────────────────────────────────────────────
const CriticalCard: React.FC<{ item: CriticalAnalysis; onAnalyze: (id: string) => void }> = ({ item, onAnalyze }) => {
    const isCritical  = item.status === 'critico';
    const accent      = isCritical ? RED : ORANGE;
    const statusLabel = isCritical ? 'CRÍTICO' : 'ATENÇÃO ALTA';

    const iconName: keyof typeof Ionicons.glyphMap =
        item.origem === 'observacao' ? 'document-text-outline' :
        item.origem === 'denuncia'   ? 'alert-circle-outline'  : 'flask-outline';

    return (
        <View style={styles.criticalCardWrapper}>
            <View style={[styles.criticalAccent, { backgroundColor: accent }]} />
            <View style={styles.criticalCard}>
                <View style={styles.cardTop}>
                    <View style={[styles.iconCircle, {
                        backgroundColor: isCritical ? '#fdecea' : '#fff3df',
                        width: 48, height: 48, borderRadius: 24,
                    }]}>
                        <Ionicons name={iconName} size={24} color={accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.cardName} numberOfLines={1}>{item.corpoHidricoNome}</Text>
                        <View style={styles.originRow}>
                            <Text style={styles.cardMeta}>{origemLabel(item.origem)}</Text>
                            <Text style={styles.dotSep}>·</Text>
                            <Text style={[styles.cardMeta, { color: PRIMARY_MID, fontWeight: '600' }]} numberOfLines={1}>
                                {item.colaboradorNome}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.badge, {
                        backgroundColor: isCritical ? '#fdecea' : '#fff3df',
                        borderColor: isCritical ? '#f9c8c0' : '#F9C89E',
                    }]}>
                        <Text style={[styles.badgeText, { color: accent }]}>{statusLabel}</Text>
                    </View>
                </View>

                {item.parametros.length > 0 && (
                    <View style={styles.paramsGrid}>
                        {item.parametros.slice(0, 4).map((p, i) => (
                            <View key={i} style={styles.paramBox}>
                                <Ionicons
                                    name={(p.icon as keyof typeof Ionicons.glyphMap) ?? 'analytics-outline'}
                                    size={22}
                                    color={p.severity === 'critico' ? RED : TEAL}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.paramLabel}>{p.label}</Text>
                                    <Text style={[styles.paramValue, { color: p.severity === 'critico' ? RED : PRIMARY }]}>
                                        {p.value}
                                    </Text>
                                    {p.hint ? (
                                        <Text style={[styles.paramHint, { color: p.severity === 'critico' ? RED : ORANGE }]} numberOfLines={1}>
                                            {p.hint}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {item.descricao && item.origem !== 'medicao' && (
                    <View style={styles.obsBox}>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={PRIMARY_MID} style={{ marginTop: 1 }} />
                        <Text style={styles.obsText} numberOfLines={2}>{item.descricao}</Text>
                    </View>
                )}

                {item.alertas.length > 0 && (
                    <View style={styles.alertChipsRow}>
                        {item.alertas.slice(0, 2).map((alerta, i) => (
                            <View key={i} style={styles.alertChip}>
                                <Ionicons name="warning-outline" size={13} color={RED} />
                                <Text style={styles.alertChipText}>{alerta}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.cardFooter}>
                    <View style={styles.footerMeta}>
                        <View style={styles.footerItem}>
                            <Ionicons name="calendar-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.footerText}>{formatarDataCurta(item.dataCriacao)}</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Ionicons name="person-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.footerText}>{item.colaboradorNome}</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.footerText}>
                                {[item.cidade, item.estado].filter(Boolean).join(' - ') || '—'}
                            </Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Ionicons name="time-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.footerText}>{minutosAtras(item.dataCriacao)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.analyzeBtn, { backgroundColor: accent }]}
                        onPress={() => onAnalyze(item.id)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.analyzeBtnText}>Analisar</Text>
                        <Ionicons name="arrow-forward" size={13} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function AnalysesScreen() {
    const router   = useRouter();
    const { user } = useAuth();

    /**
     * CORREÇÃO 2+3: lê o parâmetro "tab" enviado pela Home.
     * Se a Home navegar com { tab: 'criticas' }, a aba Críticas abre diretamente.
     * Fallback para 'pendentes' quando o parâmetro estiver ausente ou inválido.
     */
    const params    = useLocalSearchParams<{ tab?: string }>();
    
    const [activeTab,   setActiveTab]   = useState<TabKey>(toTabKey(params.tab));
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setActiveTab(toTabKey(params.tab));
    }, [params.tab]);

    // ── Pendentes ─────────────────────────────────────────────────────────────
    const [pendingLoading, setPendingLoading] = useState(true);
    const [pendingData,    setPendingData]    = useState<TechnicalAnalysisItem[]>([]);

    // ── Histórico ─────────────────────────────────────────────────────────────
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData,    setHistoryData]    = useState<TechnicalAnalysisItem[]>([]);

    // ── Críticas ──────────────────────────────────────────────────────────────
    const [criticalLoading, setCriticalLoading] = useState(true);
    const [criticalData,    setCriticalData]    = useState<CriticalAnalysis[]>([]);

    // Carrega pendentes ao montar
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                setPendingLoading(true);
                const data = await getPendingAnalyses(50);
                setPendingData(data);
            } catch (err) {
                console.error('[AnalysesScreen] Erro ao buscar pendentes:', err);
            } finally {
                setPendingLoading(false);
            }
        })();
    }, [user]);

    // Carrega histórico ao mudar para aba histórico (lazy)
    useEffect(() => {
        if (activeTab !== 'historico' || historyData.length > 0) return;
        (async () => {
            try {
                setHistoryLoading(true);
                const data = await getDoneAnalyses(50);
                setHistoryData(data);
            } catch (err) {
                console.error('[AnalysesScreen] Erro ao buscar histórico:', err);
            } finally {
                setHistoryLoading(false);
            }
        })();
    }, [activeTab]);

    // Carrega críticas ao montar
    useEffect(() => {
        (async () => {
            try {
                setCriticalLoading(true);
                const dados = await getCriticalAnalyses(50);
                setCriticalData(dados);
            } catch (err) {
                console.error('[AnalysesScreen] Erro ao buscar críticas:', err);
                setCriticalData([]);
            } finally {
                setCriticalLoading(false);
            }
        })();
    }, []);

    // ── Contadores ────────────────────────────────────────────────────────────
    const tabCounts: Record<TabKey, number> = {
        pendentes: pendingData.length,
        criticas:  criticalData.length,
        historico: historyData.length,
    };

    // ── Filtros de busca ──────────────────────────────────────────────────────
    const filteredPending = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return pendingData;
        return pendingData.filter(i =>
            i.corpoHidricoNome.toLowerCase().includes(q)  ||
            i.colaboradorNome.toLowerCase().includes(q)   ||
            origemLabel(i.origem).toLowerCase().includes(q) ||
            (i.cidade ?? '').toLowerCase().includes(q)
        );
    }, [pendingData, searchQuery]);

    const filteredHistory = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return historyData;
        return historyData.filter(i =>
            i.corpoHidricoNome.toLowerCase().includes(q)  ||
            i.colaboradorNome.toLowerCase().includes(q)   ||
            origemLabel(i.origem).toLowerCase().includes(q) ||
            (i.cidade ?? '').toLowerCase().includes(q)
        );
    }, [historyData, searchQuery]);

    const filteredCritical = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return criticalData;
        return criticalData.filter(i =>
            i.corpoHidricoNome.toLowerCase().includes(q)     ||
            i.colaboradorNome.toLowerCase().includes(q)      ||
            origemLabel(i.origem).toLowerCase().includes(q)  ||
            (i.cidade ?? '').toLowerCase().includes(q)
        );
    }, [criticalData, searchQuery]);

    // ── Navegação ─────────────────────────────────────────────────────────────
    const handleAnalyze = useCallback((id: string) => {
        router.push({ pathname: '/(tabs)/analysis_detail', params: { id } } as any);
    }, [router]);

    // ── Lista ─────────────────────────────────────────────────────────────────
    const isLoading =
        activeTab === 'criticas'  ? criticalLoading  :
        activeTab === 'historico' ? historyLoading   : pendingLoading;

    const listData: (TechnicalAnalysisItem | CriticalAnalysis)[] =
        activeTab === 'criticas'  ? filteredCritical :
        activeTab === 'historico' ? filteredHistory  : filteredPending;

    const renderItem = useCallback(({ item }: { item: TechnicalAnalysisItem | CriticalAnalysis }) => {
        if (activeTab === 'criticas') {
            return <CriticalCard item={item as CriticalAnalysis} onAnalyze={handleAnalyze} />;
        }
        return <PendingCard item={item as TechnicalAnalysisItem} onAnalyze={handleAnalyze} />;
    }, [activeTab, handleAnalyze]);

    const emptyDesc = searchQuery
        ? 'Tente outros termos de busca.'
        : activeTab === 'criticas'
            ? 'Nenhuma análise crítica no momento.'
            : activeTab === 'historico'
                ? 'Nenhuma análise concluída ainda.'
                : 'Nenhuma contribuição pendente de avaliação.';

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* ── Header ── */}
            <LinearGradient
                colors={[PRIMARY, '#006b62']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Análises Técnicas</Text>
                    <Text style={styles.headerSub}>Registros aguardando avaliação técnica</Text>
                </View>
                <Image
                    source={require('@/assets/images/aquasense.png')}
                    style={styles.headerLogo}
                    resizeMode="contain"
                />
            </LinearGradient>

            {/* ── Barra de busca ── */}
            <View style={styles.searchBar}>
                <View style={styles.searchInputWrapper}>
                    <Ionicons name="search-outline" size={16} color={TEXT_MUTED} style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por corpo hídrico, origem ou colaborador..."
                        placeholderTextColor="#aaa"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* ── Abas ── */}
            <View style={styles.tabsContainer}>
                {([
                    { key: 'pendentes', label: 'Pendentes' },
                    { key: 'criticas',  label: 'Críticas'  },
                    { key: 'historico', label: 'Histórico' },
                ] as { key: TabKey; label: string }[]).map(tab => {
                    const isActive = activeTab === tab.key;

                    const badgeBg =
                        tab.key === 'criticas'
                            ? (isActive ? ORANGE : '#FFF0E6')
                            : tab.key === 'historico'
                                ? (isActive ? 'rgba(255,255,255,0.25)' : '#E8EEEC')
                                : (isActive ? 'rgba(255,255,255,0.25)' : '#E2F0ED');

                    const badgeColor =
                        tab.key === 'criticas'
                            ? (isActive ? '#fff' : ORANGE)
                            : tab.key === 'historico'
                                ? (isActive ? '#fff' : '#888')
                                : (isActive ? '#fff' : PRIMARY_MID);

                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabPill, isActive && styles.tabPillActive]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                                {tab.label}
                            </Text>
                            <View style={[styles.tabBadge, { backgroundColor: badgeBg }]}>
                                <Text style={[styles.tabBadgeText, { color: badgeColor }]}>
                                    {tabCounts[tab.key]}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Lista ── */}
            {isLoading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            ) : (
                <FlatList
                    data={listData as any[]}
                    keyExtractor={item => (item as any).id ?? Math.random().toString()}
                    renderItem={renderItem as any}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="checkmark-circle-outline" size={48} color={PRIMARY_MID} />
                            <Text style={styles.emptyTitle}>Nenhuma análise encontrada</Text>
                            <Text style={styles.emptyDesc}>{emptyDesc}</Text>
                        </View>
                    }
                />
            )}

            {/* CORREÇÃO 4+5: navbar reutilizável com aba "analises" ativa */}
            <TechnicalBottomNav active="analises" />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '400',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
        letterSpacing: 0.1,
    },
    headerSub: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 1,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    headerLogo: {
        width: 36,
        height: 36,
    },

    // ── Search bar ──
    searchBar: {
        backgroundColor: CARD,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_LIGHT,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#1a1a1a',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    // ── Abas ──
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: CARD,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_LIGHT,
    },
    tabPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 22,
        gap: 5,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: BORDER_LIGHT,
    },
    tabPillActive: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },
    tabPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    tabPillTextActive: { color: '#fff' },
    tabBadge: {
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 22,
        alignItems: 'center',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:  { padding: 16, paddingBottom: 90, gap: 12 },

    // ── Card pendente/histórico ──
    card: {
        backgroundColor: CARD, borderRadius: 16, padding: 14,
        borderLeftWidth: 3, borderLeftColor: 'transparent',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    },
    cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    iconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardName: {
        fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 3,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    cardMeta: {
        fontSize: 12, color: TEXT_MUTED, lineHeight: 17,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    originRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dotSep:    { color: TEXT_MUTED, fontSize: 12 },

    badge:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
    badgeText: {
        fontSize: 11, fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    metric:     { flex: 1, minWidth: 64, backgroundColor: SURFACE, borderRadius: 8, padding: 8 },
    metricLabel:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
    metricLabelText: {
        fontSize: 10, color: TEXT_MUTED,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    metricValue: {
        fontSize: 15, fontWeight: '700', color: '#1a1a1a',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    obsBox:  { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 10, padding: 10, gap: 8, marginBottom: 10, alignItems: 'flex-start' },
    obsText: {
        flex: 1, fontSize: 13, color: '#444', lineHeight: 19,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    cardFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER_LIGHT, gap: 8,
    },
    footerMeta: { flex: 1, gap: 3 },
    footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: {
        fontSize: 11, color: TEXT_MUTED,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    analyzeBtn: {
        backgroundColor: PRIMARY, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', gap: 5,
    },
    analyzeBtnText: {
        fontSize: 13, color: '#fff', fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    // ── Card crítico ──
    criticalCardWrapper: { position: 'relative', marginBottom: 2 },
    criticalAccent: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16, zIndex: 2,
    },
    criticalCard: {
        backgroundColor: CARD, borderRadius: 16, padding: 14, paddingLeft: 18,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    },
    paramsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    paramBox: {
        width: '48%', backgroundColor: SURFACE, borderRadius: 10, padding: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderColor: BORDER_LIGHT,
    },
    paramLabel: {
        fontSize: 11, color: TEXT_MUTED,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    paramValue: {
        fontSize: 14, fontWeight: '700', marginTop: 1,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    paramHint: {
        fontSize: 10, marginTop: 1,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    alertChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    alertChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#fff2f0', borderRadius: 16,
        paddingHorizontal: 8, paddingVertical: 5,
    },
    alertChipText: {
        color: RED, fontSize: 11, fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },

    // ── Empty state ──
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: {
        fontSize: 16, fontWeight: '700', color: '#1a1a1a',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
    emptyDesc: {
        fontSize: 13, color: TEXT_MUTED, textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    },
});