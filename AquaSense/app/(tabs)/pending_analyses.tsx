import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import {
  getPendingAnalyses,
  getDoneAnalyses,
  TechnicalAnalysisItem,
} from '@/services/firestore/technicalAnalyses';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#2D6A5A';
const ORANGE       = '#E87D3E';
const AMBER        = '#C49A00';
const BG           = '#F4F7F5';
const CARD         = '#FFFFFF';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TabKey    = 'pendentes' | 'criticas' | 'historico';
// Tipo unificado de aba de navegação — igual ao home_technician
type NavTabKey = 'home' | 'analises' | 'mapa' | 'profile';
type StatusType   = 'CRÍTICO' | 'ATENÇÃO' | 'PENDENTE';
type AnalysisType = 'medicao' | 'observacao';

export interface MetricData {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    highlight?: boolean;
    highlightColor?: string;
}

export interface AnalysisItem {
    id: string;
    bodyName: string;
    type: AnalysisType;
    collaborator: string;
    status: StatusType;
    tab: TabKey;
    date: string;
    time: string;
    location: string;
    metrics?: MetricData[];
    observation?: string;
}

// ─── Mapeamento Firestore → AnalysisItem ─────────────────────────────────────

function mapStatus(item: TechnicalAnalysisItem): StatusType {
  if (item.classificacao === 'critica' || item.nivelRisco === 'critico') return 'CRÍTICO';
  if (item.classificacao === 'atencao' || item.nivelRisco === 'alto')    return 'ATENÇÃO';
  return 'PENDENTE';
}

function mapTab(item: TechnicalAnalysisItem, isDone: boolean): TabKey {
  if (isDone) return 'historico';
  if (item.classificacao === 'critica' || item.nivelRisco === 'critico') return 'criticas';
  return 'pendentes';
}

function toAnalysisItem(item: TechnicalAnalysisItem, isDone: boolean): AnalysisItem {
  const d = item.dataCriacao;
  return {
    id:           item.id,
    bodyName:     item.corpoHidricoNome,
    type:         item.origem === 'medicao' ? 'medicao' : 'observacao',
    collaborator: item.colaboradorNome,
    status:       isDone ? 'PENDENTE' : mapStatus(item),
    tab:          mapTab(item, isDone),
    date:         d.toLocaleDateString('pt-BR'),
    time:         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    location:     item.cidade ?? item.municipio ?? 'Não informado',
    metrics: item.origem === 'medicao' && item.parametros?.length
      ? item.parametros.map(p => ({
          label:          p.label,
          value:          p.value,
          icon:           p.icon as any,
          highlight:      p.severity === 'critico' || p.severity === 'atencao',
          highlightColor: p.severity === 'critico' ? '#E87D3E' : p.severity === 'atencao' ? '#C49A00' : undefined,
        }))
      : undefined,
    observation: item.descricao,
  };
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

// ─── Card de análise ──────────────────────────────────────────────────────────
interface AnalysisCardProps {
    item: AnalysisItem;
    onAnalyze: (id: string) => void;
}
const AnalysisCard: React.FC<AnalysisCardProps> = ({ item, onAnalyze }) => {
    const leftBorderColor =
        item.status === 'CRÍTICO' ? ORANGE :
        item.status === 'ATENÇÃO' ? AMBER  : 'transparent';

    const iconName: keyof typeof Ionicons.glyphMap =
        item.type === 'observacao' ? 'document-text-outline' : 'flask-outline';

    const iconBg =
        item.status === 'CRÍTICO' ? '#FFF0E6' :
        item.status === 'ATENÇÃO' ? '#FFFCE6' : '#EAF4F1';

    const iconColor =
        item.status === 'CRÍTICO' ? ORANGE :
        item.status === 'ATENÇÃO' ? AMBER  : PRIMARY_MID;

    return (
        <View style={[styles.card, { borderLeftColor: leftBorderColor }]}>
            {/* Top row */}
            <View style={styles.cardTop}>
                <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.cardName}>{item.bodyName}</Text>
                    <Text style={styles.cardMeta}>
                        {item.type === 'medicao' ? 'Medição simples' : 'Observação'}
                        {' · '}
                        <Text style={{ color: PRIMARY_MID, fontWeight: '600' }}>
                            {item.collaborator}
                        </Text>
                    </Text>
                </View>
                <StatusBadge status={item.status} />
            </View>

            {/* Métricas */}
            {item.type === 'medicao' && item.metrics && (
                <View style={styles.metricsRow}>
                    {item.metrics.map((m, idx) => (
                        <View key={idx} style={styles.metric}>
                            <View style={styles.metricLabel}>
                                <Ionicons
                                    name={m.icon}
                                    size={11}
                                    color={m.highlight ? m.highlightColor : PRIMARY_MID}
                                />
                                <Text style={styles.metricLabelText}>{m.label}</Text>
                            </View>
                            <Text style={[
                                styles.metricValue,
                                m.highlight && { color: m.highlightColor },
                            ]}>
                                {m.value}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Observação */}
            {item.type === 'observacao' && item.observation && (
                <View style={styles.obsBox}>
                    <Ionicons name="chatbubble-outline" size={14} color={PRIMARY_MID} style={{ marginTop: 1 }} />
                    <Text style={styles.obsText}>{item.observation}</Text>
                </View>
            )}

            {/* Footer */}
            <View style={styles.cardFooter}>
                <View style={styles.footerMeta}>
                    <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.footerText}>{item.date}, {item.time}</Text>
                    </View>
                    <View style={styles.footerItem}>
                        <Ionicons name="person-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.footerText}>{item.collaborator}</Text>
                    </View>
                    <View style={styles.footerItem}>
                        <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.footerText}>{item.location}</Text>
                    </View>
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

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function PendingAnalyses() {
    const router   = useRouter();
    const { user } = useAuth();

    const [activeTab,    setActiveTab]    = useState<TabKey>('pendentes');
    const [activeNavTab, setActiveNavTab] = useState<NavTabKey>('analises');
    const [searchQuery,  setSearchQuery]  = useState('');
    const [loading,      setLoading]      = useState(true);
    const [data,         setData]         = useState<AnalysisItem[]>([]);

    // ── Carregar dados do Firestore ───────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            try {
                setLoading(true);
                const [pendentes, historico] = await Promise.all([
                    getPendingAnalyses(50),
                    getDoneAnalyses(50),
                ]);
                const mapped = [
                    ...pendentes.map(i => toAnalysisItem(i, false)),
                    ...historico.map(i => toAnalysisItem(i, true)),
                ];
                // Deduplicar por id (um item pode aparecer em múltiplas queries)
                const unique = Array.from(new Map(mapped.map(i => [i.id, i])).values());
                setData(unique);
            } catch (err) {
                console.error('[AquaSense] pending_analyses fetch:', err);
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.uid]);

    // ── Filtrar por aba e busca ───────────────────────────────────────────────
    const filteredData = data.filter(item => {
        const matchesTab =
            activeTab === 'pendentes' ? item.tab === 'pendentes' :
            activeTab === 'criticas'  ? item.tab === 'criticas'  :
            item.tab === 'historico';

        if (!matchesTab) return false;
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase();
        return (
            item.bodyName.toLowerCase().includes(q)     ||
            item.collaborator.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q)
        );
    });

    const countByTab = (tab: TabKey) => data.filter(i => i.tab === tab).length;

    const tabCounts: Record<TabKey, number> = {
        pendentes: countByTab('pendentes'),
        criticas:  countByTab('criticas'),
        historico: countByTab('historico'),
    };

    // ── Navegação ─────────────────────────────────────────────────────────────
    const handleAnalyze = useCallback((id: string) => {
        router.push({ pathname: '/(tabs)/analysis_detail', params: { id } } as any);
    }, [router]);

    const handleNavTab = useCallback((tab: NavTabKey) => {
        setActiveNavTab(tab);
        if (tab === 'home') {
            router.replace('/(tabs)/home_technician' as any);
        } else if (tab === 'mapa') {
            router.replace('/(tabs)/map' as any);
        } else if (tab === 'profile') {
            router.replace('/(tabs)/profile' as any);
        }
        // 'analises' não navega — já estamos aqui
    }, [router]);

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
                <View style={styles.headerLogoCircle}>
                    <Ionicons name="leaf-outline" size={20} color="#fff" />
                </View>
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
                <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
                    <Ionicons name="options-outline" size={15} color={PRIMARY_MID} />
                    <Text style={styles.filterBtnText}>Filtros</Text>
                </TouchableOpacity>
            </View>

            {/* ── Abas ── */}
            <View style={styles.tabsRow}>
                {(
                    [
                        { key: 'pendentes', label: 'Pendentes' },
                        { key: 'criticas',  label: 'Críticas'  },
                        { key: 'historico', label: 'Histórico' },
                    ] as { key: TabKey; label: string }[]
                ).map(tab => {
                    const isActive = activeTab === tab.key;
                    const badgeBg =
                        tab.key === 'criticas'  ? '#FFF0E6' :
                        tab.key === 'historico' ? '#F0F0F0' :
                        isActive ? PRIMARY : '#e8f5e9';
                    const badgeColor =
                        tab.key === 'criticas'  ? ORANGE :
                        tab.key === 'historico' ? '#666'  :
                        isActive ? '#fff' : PRIMARY_MID;

                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
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
            {loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <AnalysisCard item={item} onAnalyze={handleAnalyze} />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="checkmark-circle-outline" size={48} color={PRIMARY_MID} />
                            <Text style={styles.emptyTitle}>Nenhuma análise encontrada</Text>
                            <Text style={styles.emptyDesc}>
                                {searchQuery
                                    ? 'Tente outros termos de busca.'
                                    : 'Não há registros nesta categoria.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ── Tab bar (unificada) ── */}
            <View style={styles.tabBar}>
                {(
                    [
                        { key: 'home',     icon: 'home-outline',          label: 'Home'     },
                        { key: 'analises', icon: 'document-text-outline', label: 'Análises' },
                    ] as { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[]
                ).map(t => {
                    const isActive = activeNavTab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={styles.navTabItem}
                            onPress={() => handleNavTab(t.key)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={isActive ? t.icon.replace('-outline', '') as any : t.icon}
                                size={23}
                                color={isActive ? PRIMARY : '#aaa'}
                            />
                            <Text style={[styles.navTabLabel, isActive && styles.navTabLabelActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    style={styles.tabAddBtn}
                    onPress={() => router.push('/(tabs)/register_observation' as any)}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>

                {(
                    [
                        { key: 'mapa',    icon: 'map-outline',    label: 'Mapa'   },
                        { key: 'profile', icon: 'person-outline', label: 'Perfil' },
                    ] as { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[]
                ).map(t => {
                    const isActive = activeNavTab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={styles.navTabItem}
                            onPress={() => handleNavTab(t.key)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={isActive ? t.icon.replace('-outline', '') as any : t.icon}
                                size={23}
                                color={isActive ? PRIMARY : '#aaa'}
                            />
                            <Text style={[styles.navTabLabel, isActive && styles.navTabLabelActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
    headerLogoCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    searchBar: {
        backgroundColor: CARD,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_LIGHT,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
    },
    searchInput:    { flex: 1, fontSize: 13, color: '#1a1a1a' },
    filterBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
    filterBtnText:  { fontSize: 13, color: PRIMARY_MID, fontWeight: '600' },

    tabsRow: {
        flexDirection: 'row',
        backgroundColor: CARD,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_LIGHT,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginRight: 16,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive:      { borderBottomColor: PRIMARY },
    tabText:        { fontSize: 13, fontWeight: '600', color: '#888' },
    tabTextActive:  { color: PRIMARY },
    tabBadge:       { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
    tabBadgeText:   { fontSize: 11, fontWeight: '700' },

    loadingState:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:    { padding: 16, paddingBottom: 90, gap: 12 },

    card: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 14,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    iconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardName:   { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
    cardMeta:   { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },

    badge:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
    badgeText:  { fontSize: 11, fontWeight: '700' },

    metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    metric:     { flex: 1, minWidth: 64, backgroundColor: SURFACE, borderRadius: 8, padding: 8 },
    metricLabel:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
    metricLabelText: { fontSize: 10, color: TEXT_MUTED },
    metricValue:     { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

    obsBox:  { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 10, padding: 10, gap: 8, marginBottom: 10, alignItems: 'flex-start' },
    obsText: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19 },

    cardFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER_LIGHT, gap: 8 },
    footerMeta:  { flex: 1, gap: 3 },
    footerItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText:  { fontSize: 11, color: TEXT_MUTED },
    analyzeBtn:  { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
    analyzeBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
    emptyDesc:  { fontSize: 13, color: TEXT_MUTED, textAlign: 'center' },

    // ── Tab bar (unificada) ──
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 0 : 10,
        paddingTop: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: BORDER_LIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 12,
    },
    navTabItem:        { alignItems: 'center', flex: 1, paddingVertical: 2 },
    navTabLabel:       { fontSize: 11, color: '#aaa', marginTop: 3 },
    navTabLabelActive: { color: PRIMARY, fontWeight: '600' },
    tabAddBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 8,
    },
});