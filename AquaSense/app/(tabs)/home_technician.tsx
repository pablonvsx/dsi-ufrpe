import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '@/contexts/auth-context';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#2D6A5A';
const ORANGE       = '#E87D3E';
const BG           = '#F4F7F5';
const CARD         = '#FFFFFF';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

// ─── Tipo unificado de aba de navegação ───────────────────────────────────────
type NavTabKey = 'home' | 'analises' | 'mapa' | 'profile';

// ─── Tipos de dados ───────────────────────────────────────────────────────────
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

// ─── Valores iniciais neutros ─────────────────────────────────────────────────
const EMPTY_PENDING: PendingAnalysisData = {
    count: 0,
    lastTitle: '—',
    lastMinutesAgo: 0,
    highPriority: false,
};

const EMPTY_CRITICAL: CriticalAnalysisData = {
    count: 0,
    points: [],
    updatedMinutesAgo: 0,
};

const EMPTY_LAST_ANALYSIS: LastAnalysisData = {
    name: '—',
    date: '—',
    validated: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatDate(date: Date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// ─── Região inicial do mapa ───────────────────────────────────────────────────
const REGIAO_INICIAL = {
    latitude: -8.28,
    longitude: -37.95,
    latitudeDelta: 4.5,
    longitudeDelta: 4.5,
};

// ─── Header ───────────────────────────────────────────────────────────────────
interface HeaderProps {
    cityLabel: string;
    loading: boolean;
}
const Header: React.FC<HeaderProps> = ({ cityLabel, loading }) => (
    <LinearGradient
        colors={[PRIMARY, '#006b62']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
    >
        <View style={styles.headerLeft}>
            <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.85)" />
            <View style={{ marginLeft: 6 }}>
                <Text style={styles.headerCity}>
                    {loading ? 'Localizando...' : cityLabel}
                </Text>
                <Text style={styles.headerTeam}>Equipe Técnica</Text>
            </View>
        </View>
        <View style={styles.headerLogoCircle}>
            <Ionicons name="leaf-outline" size={22} color="#fff" />
        </View>
    </LinearGradient>
);

// ─── TitleBlock ───────────────────────────────────────────────────────────────
const TitleBlock: React.FC = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    return (
        <LinearGradient colors={[PRIMARY, '#006b62']} style={styles.titleBlock}>
            <View style={{ flex: 1 }}>
                <Text style={styles.titleMain}>Painel Técnico</Text>
                <Text style={styles.titleSub}>
                    Acompanhe e analise as demandas técnicas{'\n'}da sua equipe em tempo real.
                </Text>
            </View>
            <View style={styles.updatedBadge}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.updatedTitle}>Atualizado agora</Text>
                <Text style={styles.updatedDate}>
                    {formatTime(now)} • {formatDate(now)}
                </Text>
            </View>
        </LinearGradient>
    );
};

// ─── Card: Análises pendentes ─────────────────────────────────────────────────
interface PendingCardProps {
    data: PendingAnalysisData;
    onPress: () => void;
}
const PendingCard: React.FC<PendingCardProps> = ({ data, onPress }) => (
    <View style={styles.card}>
        <View style={styles.cardRow}>
            <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={22} color={PRIMARY_MID} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cardTitle}>Análises pendentes</Text>
                <Text style={styles.cardDesc}>
                    Demandas aguardando{'\n'}sua análise técnica
                </Text>
            </View>
            <View style={styles.countRow}>
                <Text style={styles.countNumber}>{data.count}</Text>
                <Ionicons name="chevron-forward" size={18} color="#1a1a1a" />
            </View>
        </View>

        <View style={styles.lastReceived}>
            <Ionicons name="time-outline" size={14} color={PRIMARY_MID} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.lastReceivedLabel}>Última recebida</Text>
                <Text style={styles.lastReceivedTitle}>{data.lastTitle}</Text>
                <Text style={styles.lastReceivedTime}>Há {data.lastMinutesAgo} minutos</Text>
            </View>
            {data.highPriority && (
                <View style={styles.priorityBadge}>
                    <Text style={styles.priorityText}>Prioridade alta</Text>
                    <View style={styles.priorityDot} />
                </View>
            )}
        </View>

        <TouchableOpacity style={styles.cardFooterBtn} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.cardFooterBtnText}>Ver todas as análises pendentes</Text>
            <Ionicons name="arrow-forward" size={15} color={PRIMARY_MID} />
        </TouchableOpacity>
    </View>
);

// ─── Cards inferiores ─────────────────────────────────────────────────────────
interface BottomCardsProps {
    critical: CriticalAnalysisData;
    lastAnalysis: LastAnalysisData;
    onCriticalPress: () => void;
    onDetailsPress: () => void;
}
const BottomCards: React.FC<BottomCardsProps> = ({
    critical,
    lastAnalysis,
    onCriticalPress,
    onDetailsPress,
}) => (
    <View style={styles.bottomRow}>
        {/* Análises críticas */}
        <View style={[styles.card, styles.bottomCard, styles.criticalCard]}>
            <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="warning-outline" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cardTitle}>Análises críticas</Text>
                    <Text style={styles.cardDesc}>Requerem atenção{'\n'}imediata</Text>
                </View>
            </View>
            <View style={[styles.countRow, { marginTop: 10 }]}>
                <Text style={[styles.countNumber, { color: ORANGE }]}>{critical.count}</Text>
                <Ionicons name="chevron-forward" size={18} color="#1a1a1a" />
            </View>
            <View style={styles.criticalPoints}>
                <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                <View style={{ marginLeft: 4, flex: 1 }}>
                    <Text style={styles.criticalPointsLabel}>Principais pontos</Text>
                    <Text style={styles.criticalPointsNames} numberOfLines={2}>
                        {critical.points.join(' • ')}
                    </Text>
                    <Text style={styles.criticalPointsTime}>
                        Atualizado há {critical.updatedMinutesAgo} min
                    </Text>
                </View>
            </View>
            <TouchableOpacity style={styles.criticalFooter} onPress={onCriticalPress} activeOpacity={0.7}>
                <Text style={styles.criticalFooterText}>Ver análises críticas</Text>
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
                    <Text style={styles.cardTitle}>Última análise{'\n'}realizada</Text>
                    <Text style={styles.cardDesc}>Acompanhe seu{'\n'}último trabalho</Text>
                </View>
            </View>
            <Text style={styles.lastAnalysisTitle} numberOfLines={2}>
                {lastAnalysis.name}
            </Text>
            <View style={styles.lastAnalysisDate}>
                <Ionicons name="calendar-outline" size={13} color={TEXT_MUTED} />
                <Text style={styles.lastAnalysisDateText}>{lastAnalysis.date}</Text>
            </View>
            {lastAnalysis.validated && (
                <View style={styles.validatedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={PRIMARY_MID} />
                    <Text style={styles.validatedText}>Validada pelo gestor</Text>
                </View>
            )}
            <TouchableOpacity style={styles.detailsBtn} onPress={onDetailsPress} activeOpacity={0.7}>
                <Text style={styles.detailsBtnText}>Ver detalhes</Text>
                <Ionicons name="arrow-forward" size={13} color={PRIMARY_MID} />
            </TouchableOpacity>
        </View>
    </View>
);

// ─── Seção do mapa ────────────────────────────────────────────────────────────
interface MapSectionProps {
    onViewMap: () => void;
}
const MapSection: React.FC<MapSectionProps> = ({ onViewMap }) => (
    <View style={styles.mapSection}>
        <View style={styles.mapHeader}>
            <View>
                <Text style={styles.mapTitle}>Mapa técnico</Text>
                <Text style={styles.mapSubtitle}>Visão geral dos pontos monitorados</Text>
            </View>
            <TouchableOpacity style={styles.mapCompleteBtn} onPress={onViewMap} activeOpacity={0.7}>
                <Text style={styles.mapCompleteBtnText}>Ver mapa completo</Text>
                <Ionicons name="map-outline" size={14} color={PRIMARY_MID} />
            </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={onViewMap}>
            <View style={styles.mapContainer}>
                <MapView
                    style={StyleSheet.absoluteFill}
                    provider={PROVIDER_GOOGLE}
                    mapType="satellite"
                    initialRegion={REGIAO_INICIAL}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    pointerEvents="none"
                />
                <View style={styles.mapTapOverlay}>
                    <Ionicons name="expand-outline" size={16} color="rgba(0,77,72,0.7)" />
                    <Text style={styles.mapTapLabel}>Toque para abrir o mapa</Text>
                </View>
            </View>
        </TouchableOpacity>
    </View>
);

// ─── Tab bar (unificada) ──────────────────────────────────────────────────────
interface TabBarProps {
    active: NavTabKey;
    onTab: (tab: NavTabKey) => void;
    onAdd: () => void;
}
const TabBar: React.FC<TabBarProps> = ({ active, onTab, onAdd }) => {
    const leftTabs:  { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
        { key: 'home',     icon: 'home-outline',          label: 'Home'     },
        { key: 'analises', icon: 'document-text-outline', label: 'Análises' },
    ];
    const rightTabs: { key: NavTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
        { key: 'mapa',    icon: 'map-outline',    label: 'Mapa'   },
        { key: 'profile', icon: 'person-outline', label: 'Perfil' },
    ];

    const renderTab = (t: typeof leftTabs[0]) => {
        const isActive = active === t.key;
        return (
            <TouchableOpacity
                key={t.key}
                style={styles.navTabItem}
                onPress={() => onTab(t.key)}
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

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function HomeTechnician() {
    const router   = useRouter();
    const { user } = useAuth();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });

    const [activeTab, setActiveTab] = useState<NavTabKey>('home');
    useFocusEffect(
        useCallback(() => {
            setActiveTab('home');
        }, [])
    );

    const [cityLabel,       setCityLabel]       = useState('Carregando...');
    const [locationLoading, setLocationLoading] = useState(true);

    const [pendingData,      setPendingData]      = useState<PendingAnalysisData>(EMPTY_PENDING);
    const [criticalData,     setCriticalData]     = useState<CriticalAnalysisData>(EMPTY_CRITICAL);
    const [lastAnalysisData, setLastAnalysisData] = useState<LastAnalysisData>(EMPTY_LAST_ANALYSIS);

    // Descomente e adapte com seus serviços Firestore reais:
    // useEffect(() => {
    //     if (!user) return;
    //     const fetchData = async () => {
    //         try {
    //             const pending  = await getPendingAnalysesCount(user.uid);
    //             const critical = await getCriticalAnalyses(user.uid);
    //             const last     = await getLastAnalysis(user.uid);
    //             setPendingData(pending);
    //             setCriticalData(critical);
    //             setLastAnalysisData(last);
    //         } finally {
    //             setDataLoading(false);
    //         }
    //     };
    //     fetchData();
    // }, [user]);

    // ── Localização ───────────────────────────────────────────────────────────
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

    // ── Navegação ─────────────────────────────────────────────────────────────
    const handleTab = useCallback((tab: NavTabKey) => {
        setActiveTab(tab);
        if (tab === 'mapa') {
            router.push('/(tabs)/map' as any);
        } else if (tab === 'analises') {
            router.replace('/(tabs)/analyses_union' as any);
        } else if (tab === 'profile') {
            router.replace('/(tabs)/profile' as any);
        }
        // 'home' não navega — já estamos aqui
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

            <Header cityLabel={cityLabel} loading={locationLoading} />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <TitleBlock />

                <PendingCard
                    data={pendingData}
                    onPress={handlePending}
                />

                <BottomCards
                    critical={criticalData}
                    lastAnalysis={lastAnalysisData}
                    onCriticalPress={handleCritical}
                    onDetailsPress={handleDetails}
                />

                <MapSection onViewMap={handleViewMap} />

                <View style={{ height: 24 }} />
            </ScrollView>

            <TabBar active={activeTab} onTab={handleTab} onAdd={handleAdd} />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PRIMARY },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerLeft:     { flexDirection: 'row', alignItems: 'center' },
    headerCity:     { color: '#fff', fontSize: 16, fontWeight: '700' },
    headerTeam:     { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    headerLogoCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    scroll:        { flex: 1, backgroundColor: BG },
    scrollContent: { paddingBottom: 16 },

    titleBlock: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 28,
        gap: 12,
    },
    titleMain: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'Questrial_400Regular',
        marginBottom: 6,
    },
    titleSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 19 },
    updatedBadge: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        minWidth: 128,
        gap: 3,
    },
    updatedTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
    updatedDate:  { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

    card: {
        backgroundColor: CARD,
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
    },
    cardRow:     { flexDirection: 'row', alignItems: 'flex-start' },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#EAF4F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle:   { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
    cardDesc:    { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },
    countRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    countNumber: { fontSize: 36, fontWeight: '800', color: '#1a1a1a' },

    lastReceived: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: SURFACE,
        borderRadius: 10,
        padding: 12,
        marginTop: 14,
        gap: 6,
    },
    lastReceivedLabel: { fontSize: 11, color: '#aaa', marginBottom: 2 },
    lastReceivedTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
    lastReceivedTime:  { fontSize: 11, color: '#aaa', marginTop: 2 },
    priorityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF4ED',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
        alignSelf: 'flex-start',
    },
    priorityText: { fontSize: 11, color: ORANGE, fontWeight: '600' },
    priorityDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: ORANGE },
    cardFooterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: BORDER_LIGHT,
    },
    cardFooterBtnText: { fontSize: 13, color: PRIMARY_MID, fontWeight: '600' },

    bottomRow:    { flexDirection: 'row', marginHorizontal: 16, gap: 12, marginTop: 16 },
    bottomCard:   { flex: 1, marginHorizontal: 0, marginTop: 0 },
    criticalCard: { borderLeftWidth: 3, borderLeftColor: ORANGE },
    criticalPoints: {
        flexDirection: 'row',
        backgroundColor: '#FFF8F4',
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
    },
    criticalPointsLabel: { fontSize: 10, color: '#aaa' },
    criticalPointsNames: { fontSize: 11, fontWeight: '700', color: '#1a1a1a' },
    criticalPointsTime:  { fontSize: 10, color: '#aaa', marginTop: 1 },
    criticalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: BORDER_LIGHT,
    },
    criticalFooterText: { fontSize: 12, color: ORANGE, fontWeight: '600' },

    lastAnalysisTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1a1a1a',
        marginTop: 10,
        marginBottom: 4,
    },
    lastAnalysisDate: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    lastAnalysisDateText: { fontSize: 11, color: TEXT_MUTED },
    validatedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EAF4F1',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        gap: 4,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    validatedText: { fontSize: 11, color: PRIMARY_MID, fontWeight: '600' },
    detailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: BORDER_LIGHT,
    },
    detailsBtnText: { fontSize: 12, color: PRIMARY_MID, fontWeight: '600' },

    // ── MapSection ──
    mapSection:  { marginHorizontal: 16, marginTop: 24 },
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    mapTitle:    { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
    mapSubtitle: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
    mapCompleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    mapCompleteBtnText: { fontSize: 12, color: PRIMARY_MID, fontWeight: '600' },
    mapContainer: {
        borderRadius: 14,
        overflow: 'hidden',
        height: 185,
    },
    mapTapOverlay: {
        position: 'absolute',
        top: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 5,
    },
    mapTapLabel: { fontSize: 11, color: PRIMARY, fontWeight: '600' },

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