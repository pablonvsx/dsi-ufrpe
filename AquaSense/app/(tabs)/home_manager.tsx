import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    Animated,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/auth-context";
import { getUnvalidatedWaterBodies } from "@/services/firestore/water_bodies";
import { getCollaborators, getTechnicians } from "@/services/firestore/users";
import { listarEquipesTecnicas } from "@/services/firestore/technical_teams";
import { buscarAlertasDoUsuario, Alerta } from "@/services/firestore/alerts";
import {
    getColetasSimplesPorNivel,
    getColetasCompletas,
    getDailyColetasCompletas,
    getPreviousPeriodColetasCompletas,
    getDailyQualityLevels,
    DailyAnalysisData,
    DailyLevelData,
} from "@/services/coletas";
import {
    getComplaintsCountByPeriod,
    getDailyComplaintsCount,
    getPreviousPeriodComplaintsCount,
    getComplaintsInProgressCount,
} from "@/services/firestore/complaints";
import ManagerBottomNav from "@/components/managerbottomnav";

const PRIMARY = "#004d48";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calcChange(current: number, previous: number): { pct: number; up: boolean } {
    if (previous === 0) return { pct: 0, up: true };
    const pct = Math.round(((current - previous) / previous) * 100);
    return { pct: Math.abs(pct), up: current >= previous };
}

function prepareSparkline(
    dailyData: { date: string; count: number }[],
    daysBack: number,
    pointCount = 8
): number[] {
    const dataMap = new Map(dailyData.map((d) => [d.date, d.count]));
    const values: number[] = [];
    const today = new Date();
    const step = Math.max(1, Math.floor(daysBack / pointCount));

    for (let i = daysBack - 1; i >= 0; i -= step) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        values.push(dataMap.get(dateStr) ?? 0);
    }
    return values;
}

// ─── Sub-componentes internos ────────────────────────────────────────────────

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
    const max = Math.max(...values, 1);
    return (
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 28, gap: 2 }}>
            {values.map((v, i) => (
                <View
                    key={i}
                    style={{
                        flex: 1,
                        height: Math.max(2, (v / max) * 28),
                        backgroundColor: color,
                        borderRadius: 1.5,
                        opacity: 0.55 + (i / values.length) * 0.45,
                    }}
                />
            ))}
        </View>
    );
}

interface QualidadeAgua {
    boa: number;
    normal: number;
    atencao: number;
    critico: number;
    total: number;
}

function WaterQualityRing({ data }: { data: QualidadeAgua }) {
    const size = 82;
    const total = data.total || 1;
    const dominantColor =
        data.critico > 0 ? "#EF4444" : data.atencao > 0 ? "#F97316" : "#22C55E";

    return (
        <View style={{ alignItems: "center" }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 13,
                    borderColor: dominantColor,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>
                    {data.total}
                </Text>
                <Text style={{ fontSize: 7, color: "#6b7a7a", textAlign: "center" }}>
                    {"análises\nno período"}
                </Text>
            </View>
            {/* Barra de proporção segmentada */}
            <View
                style={{
                    flexDirection: "row",
                    width: size - 4,
                    height: 4,
                    borderRadius: 2,
                    overflow: "hidden",
                    marginTop: 7,
                    backgroundColor: "#E5E7EB",
                }}
            >
                {data.total > 0 && (
                    <>
                        {data.critico > 0 && (
                            <View style={{ flex: data.critico, backgroundColor: "#EF4444" }} />
                        )}
                        {data.atencao > 0 && (
                            <View style={{ flex: data.atencao, backgroundColor: "#F97316" }} />
                        )}
                        {data.normal > 0 && (
                            <View style={{ flex: data.normal, backgroundColor: "#F59E0B" }} />
                        )}
                        {data.boa > 0 && (
                            <View style={{ flex: data.boa, backgroundColor: "#22C55E" }} />
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

interface AlertLevelConfig {
    icon: keyof typeof Ionicons.glyphMap;
    bgColor: string;
    iconColor: string;
    labelColor: string;
    labelText: string;
}

function alertLevelConfig(nivel: string): AlertLevelConfig {
    if (nivel === "Crítico") {
        return {
            icon: "alert-circle",
            bgColor: "#FEE2E2",
            iconColor: "#EF4444",
            labelColor: "#DC2626",
            labelText: "Prioridade alta",
        };
    }
    if (nivel === "Atenção") {
        return {
            icon: "warning",
            bgColor: "#FFF3E0",
            iconColor: "#F97316",
            labelColor: "#EA580C",
            labelText: "Prioridade média",
        };
    }
    return {
        icon: "information-circle",
        bgColor: "#ECFDF5",
        iconColor: "#22C55E",
        labelColor: "#16A34A",
        labelText: "Monitoramento recomendado",
    };
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function HomeManager() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    // Header
    const [locationText, setLocationText] = useState("Região Metropolitana do Recife");
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Quick cards
    const [validacoesPendentes, setValidacoesPendentes] = useState(0);
    const [alertasCriticos, setAlertasCriticos] = useState(0);
    const [equipesAtivas, setEquipesAtivas] = useState(0);
    const [bellCount, setBellCount] = useState(0);

    // Panorama
    const [timeFilter, setTimeFilter] = useState<7 | 14 | 30>(7);
    const [qualidadeAgua, setQualidadeAgua] = useState<QualidadeAgua>({
        boa: 0, normal: 0, atencao: 0, critico: 0, total: 0,
    });
    const [denunciasCount, setDenunciasCount] = useState(0);
    const [previousDenuncias, setPreviousDenuncias] = useState(0);
    const [dailyDenuncias, setDailyDenuncias] = useState<{ date: string; count: number }[]>([]);
    const [analisesCount, setAnalisesCount] = useState(0);
    const [previousAnalises, setPreviousAnalises] = useState(0);
    const [dailyAnalises, setDailyAnalises] = useState<DailyAnalysisData[]>([]);
    const [dailyQuality, setDailyQuality] = useState<DailyLevelData[]>([]);

    // Alertas
    const [alertas, setAlertas] = useState<Alerta[]>([]);

    // Atividade da gestão
    const [analisesConcluidas, setAnalisesConcluidas] = useState(0);
    const [denunciasAndamento, setDenunciasAndamento] = useState(0);

    const [loadingMain, setLoadingMain] = useState(true);
    const [loadingStats, setLoadingStats] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    // ── Dados iniciais (independentes do filtro de tempo) ──────────────────
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]).start();

        (async () => {
            try {
                const [unvalidated, equipes, today] = await Promise.all([
                    getUnvalidatedWaterBodies(),
                    listarEquipesTecnicas(),
                    getColetasCompletas(1),
                ]);

                setValidacoesPendentes(unvalidated.length);
                setEquipesAtivas(equipes.filter((e) => e.status === "ativa").length);
                setAnalisesConcluidas(today);

                if (userProfile?.uid) {
                    const [alertasList, inProgress] = await Promise.all([
                        buscarAlertasDoUsuario(userProfile.uid),
                        getComplaintsInProgressCount(),
                    ]);
                    setAlertas(alertasList.slice(0, 3));
                    setAlertasCriticos(
                        alertasList.filter((a) => a.nivel === "Crítico").length
                    );
                    setBellCount(
                        alertasList.filter(
                            (a) => !(a.lidoPor ?? []).includes(userProfile.uid)
                        ).length
                    );
                    setDenunciasAndamento(inProgress);
                }

                setLastUpdated(new Date());
            } catch (err) {
                console.error("[home_manager] dados iniciais:", err);
            } finally {
                setLoadingMain(false);
            }
        })();

        // Localização
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") return;
                const loc = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
                if (place) {
                    const city = place.city ?? place.subregion ?? "";
                    const state = place.region ?? "";
                    setLocationText(city && state ? `${city} - ${state}` : city || state || "Região Metropolitana do Recife");
                }
            } catch {
                // mantém o default
            }
        })();
    }, [userProfile?.uid]);

    // ── Dados do panorama (dependem do filtro de tempo) ─────────────────────
    useEffect(() => {
        const fetchPanorama = async () => {
            try {
                setLoadingStats(true);
                const [qualidade, analises, prevAnalises, dailyAnal, dailyQual, denuncias, prevDenuncias, dailyDen] =
                    await Promise.all([
                        getColetasSimplesPorNivel(timeFilter),
                        getColetasCompletas(timeFilter),
                        getPreviousPeriodColetasCompletas(timeFilter),
                        getDailyColetasCompletas(timeFilter),
                        getDailyQualityLevels(timeFilter),
                        getComplaintsCountByPeriod(timeFilter),
                        getPreviousPeriodComplaintsCount(timeFilter),
                        getDailyComplaintsCount(timeFilter),
                    ]);

                setQualidadeAgua(qualidade);
                setAnalisesCount(analises);
                setPreviousAnalises(prevAnalises);
                setDailyAnalises(dailyAnal);
                setDailyQuality(dailyQual);
                setDenunciasCount(denuncias);
                setPreviousDenuncias(prevDenuncias);
                setDailyDenuncias(dailyDen);
            } catch (err) {
                console.error("[home_manager] panorama:", err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchPanorama();
    }, [timeFilter]);

    // ── Dados derivados ─────────────────────────────────────────────────────
    const corposCriticos = qualidadeAgua.critico;
    const dailyCriticoValues = prepareSparkline(
        dailyQuality.map((d) => ({ date: d.date, count: d.critico })),
        timeFilter
    );
    const dailyAnalisesValues = prepareSparkline(dailyAnalises, timeFilter);
    const dailyDenunciasValues = prepareSparkline(dailyDenuncias, timeFilter);

    const changeAnalises = calcChange(analisesCount, previousAnalises);
    const changeDenuncias = calcChange(denunciasCount, previousDenuncias);
    const previousCritico = dailyQuality
        .slice(0, Math.floor(dailyQuality.length / 2))
        .reduce((s, d) => s + d.critico, 0);
    const currentCritico = dailyQuality
        .slice(Math.floor(dailyQuality.length / 2))
        .reduce((s, d) => s + d.critico, 0);
    const changeCritico = calcChange(currentCritico, previousCritico);

    const userName =
        userProfile?.nome?.split(" ").slice(0, 2).join(" ") ?? "Gestor";

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={styles.root}>

                {/* ══ HEADER ══ */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <Animated.View
                            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                        >
                            {/* Linha superior: logo + badge + ações */}
                            <View style={styles.headerTopRow}>
                                <View style={styles.brandRow}>
                                    <Image
                                        source={require("../../assets/images/aquasense.png")}
                                        style={styles.headerLogo}
                                        resizeMode="contain"
                                        tintColor="#FFFFFF"
                                    />
                                    <View style={styles.gestorBadge}>
                                        <Text style={styles.gestorBadgeText}>Gestor</Text>
                                    </View>
                                </View>
                                <View style={styles.headerActions}>
                                    <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
                                        <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                                        {bellCount > 0 && (
                                            <View style={styles.bellBadge}>
                                                <Text style={styles.bellBadgeText}>
                                                    {bellCount > 9 ? "9+" : bellCount}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.profileButton}
                                        onPress={() => router.push("/(tabs)/profile" as any)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.profileCircle}>
                                            <Ionicons name="person" size={18} color={PRIMARY} />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Linha inferior: saudação + chip atualizado */}
                            <View style={styles.welcomeRow}>
                                <View style={styles.welcomeLeft}>
                                    <Text style={[styles.welcomeName, { fontFamily: questrial }]}>
                                        Olá, {userName}
                                    </Text>
                                    <View style={styles.locationRow}>
                                        <Ionicons
                                            name="location-outline"
                                            size={13}
                                            color="rgba(255,255,255,0.75)"
                                        />
                                        <Text style={[styles.locationText, { fontFamily: questrial }]}>
                                            Painel de gestão territorial • {locationText}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.updateChip}>
                                    <Ionicons name="time-outline" size={11} color={PRIMARY} />
                                    <View style={{ marginLeft: 4 }}>
                                        <Text style={styles.updateChipTitle}>Atualizado agora</Text>
                                        <Text style={styles.updateChipTime}>
                                            Hoje, {formatTime(lastUpdated)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ CONTEÚDO ══ */}
                <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                    {/* Cards Grid - 4 opções de gestão */}
                    <View style={styles.cardsContainer}>
                        
                        {/* Card 1: Alertas */}
                        <TouchableOpacity 
                            style={[styles.quickCard, styles.alertCard]}
                            onPress={() => router.push("/(tabs)/alerts_manager" as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#FFE8E8" }]}>
                                <Ionicons name="alert-circle" size={22} color="#EF4444" />
                            </View>
                            <Text style={styles.quickCardNumber}>—</Text>
                            <Text style={styles.quickCardTitle}>Alertas</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                        {/* Card 2: Equipes Técnicas */}
                        <TouchableOpacity 
                            style={[styles.quickCard, styles.techniciansCard]}
                            onPress={() => router.push("/(tabs)/manage_technicians" as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#E0F7E6" }]}>
                                <Ionicons name="build" size={22} color="#22C55E" />
                            </View>
                            <Text style={styles.quickCardNumber}>{techniciansCount}</Text>
                            <Text style={styles.quickCardTitle}>Técnicos</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                        {/* Card 3: Gestão de Colaboradores */}
                        <TouchableOpacity 
                            style={[styles.quickCard, styles.collaboratorsCard]}
                            onPress={() => router.push("/(tabs)/manage_collaborators" as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#E8E8F8" }]}>
                                <Ionicons name="people" size={22} color="#7C3AED" />
                            </View>
                            <Text style={styles.quickCardNumber}>{collaboratorsCount}</Text>
                            <Text style={styles.quickCardTitle}>Colab.</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                        {/* Card 4: Gerenciar Corpos Hídricos */}
                        <TouchableOpacity 
                            style={[styles.quickCard, styles.waterBodiesCard]}
                            onPress={() => router.push("/(tabs)/validacoes_manager" as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#E0E8FF" }]}>
                                <Ionicons name="water" size={22} color="#3B82F6" />
                            </View>
                            <Text style={styles.quickCardNumber}>{unvalidatedCount}</Text>
                            <Text style={styles.quickCardTitle}>Registros</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                    </View>

                    {/* ══ PANORAMA GERAL ══ */}
                    <View style={styles.panoramaSection}>
                        <Text style={[styles.panoramaTitle, { fontFamily: questrial }]}>Panorama Geral</Text>
                        
                        {/* Filtro de Tempo */}
                        <View style={styles.timeFilterContainer}>
                            {[30, 60, 90].map((dias) => (
                                <TouchableOpacity
                                    key={dias}
                                    style={[styles.filterButton, timeFilter === dias && styles.filterButtonActive]}
                                    onPress={() => setTimeFilter(dias)}
                                >
                                    <Text style={[styles.filterButtonText, timeFilter === dias && styles.filterButtonTextActive]}>
                                        {dias}d
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {loadingStats ? (
                            <ActivityIndicator size="large" color="#004d48" style={{ marginVertical: 40 }} />
                        ) : (
                            <>
                                {/* Gráfico: Qualidade da Água */}
                                <View style={styles.chartCard}>
                                    <Text style={[styles.chartTitle, { fontFamily: questrial }]}>Qualidade da Água</Text>
                                    <View style={styles.horizontalBar}>
                                        {qualidadeAgua.total > 0 && (
                                            <>
                                                {qualidadeAgua.boa > 0 && (
                                                    <View 
                                                        style={[
                                                            styles.barSegment, 
                                                            { backgroundColor: "#22C55E", width: `${(qualidadeAgua.boa / qualidadeAgua.total) * 100}%` }
                                                        ]} 
                                                    />
                                                )}
                                                {qualidadeAgua.normal > 0 && (
                                                    <View 
                                                        style={[
                                                            styles.barSegment, 
                                                            { backgroundColor: "#F59E0B", width: `${(qualidadeAgua.normal / qualidadeAgua.total) * 100}%` }
                                                        ]} 
                                                    />
                                                )}
                                                {qualidadeAgua.atencao > 0 && (
                                                    <View 
                                                        style={[
                                                            styles.barSegment, 
                                                            { backgroundColor: "#F97316", width: `${(qualidadeAgua.atencao / qualidadeAgua.total) * 100}%` }
                                                        ]} 
                                                    />
                                                )}
                                                {qualidadeAgua.critico > 0 && (
                                                    <View 
                                                        style={[
                                                            styles.barSegment, 
                                                            { backgroundColor: "#EF4444", width: `${(qualidadeAgua.critico / qualidadeAgua.total) * 100}%` }
                                                        ]} 
                                                    />
                                                )}
                                            </>
                                        )}
                                    </View>
                                    <View style={styles.chartLegend}>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: "#22C55E" }]} />
                                            <Text style={styles.legendText}>Boa</Text>
                                        </View>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: "#F59E0B" }]} />
                                            <Text style={styles.legendText}>Normal</Text>
                                        </View>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: "#F97316" }]} />
                                            <Text style={styles.legendText}>Atenção</Text>
                                        </View>
                                        <Text style={[styles.quickCardNumber, { fontFamily: questrial }]}>
                                            {validacoesPendentes}
                                        </Text>
                                        <Text style={styles.quickCardTitle}>Validações pendentes</Text>
                                        <Text style={styles.quickCardDesc}>Aguardando sua análise</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.quickCard, { borderBottomColor: "#EF4444" }]}
                                        onPress={() => {}}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.quickCardTop}>
                                            <View style={[styles.quickCardIcon, { backgroundColor: "#FEE2E2" }]}>
                                                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" />
                                        </View>
                                        <Text style={[styles.quickCardNumber, { fontFamily: questrial }]}>
                                            {alertasCriticos}
                                        </Text>
                                        <Text style={styles.quickCardTitle}>Alertas críticos</Text>
                                        <Text style={styles.quickCardDesc}>Requerem atenção imediata</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Linha 2 */}
                                <View style={styles.cardsRow}>
                                    <TouchableOpacity
                                        style={[styles.quickCard, { borderBottomColor: "#4CAF50" }]}
                                        onPress={() => router.push("/(tabs)/manage_technicians" as any)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.quickCardTop}>
                                            <View style={[styles.quickCardIcon, { backgroundColor: "#E8F5E9" }]}>
                                                <Ionicons name="people" size={20} color="#2E7D32" />
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" />
                                        </View>
                                        <Text style={[styles.quickCardNumber, { fontFamily: questrial }]}>
                                            {equipesAtivas}
                                        </Text>
                                        <Text style={styles.quickCardTitle}>Equipes técnicas ativas</Text>
                                        <Text style={styles.quickCardDesc}>Monitorando o território</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.quickCard, { borderBottomColor: "#2196F3" }]}
                                        onPress={() => router.push("/(tabs)/manage_water_bodies" as any)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.quickCardTop}>
                                            <View style={[styles.quickCardIcon, { backgroundColor: "#E3F2FD" }]}>
                                                <Ionicons name="add-circle-outline" size={20} color="#1565C0" />
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" />
                                        </View>
                                        <Text style={[styles.quickCardNumber, { fontFamily: questrial }]}>
                                            {validacoesPendentes}
                                        </Text>
                                        <Text style={styles.quickCardTitle}>Novos registros</Text>
                                        <Text style={styles.quickCardDesc}>
                                            Corpos hídricos aguardando validação
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ── Panorama da região ────────────────────────────────── */}
                            <View style={styles.panoramaSection}>
                                <View style={styles.panoramaHeader}>
                                    <View>
                                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                            Panorama da região
                                        </Text>
                                        <Text style={styles.sectionSubtitle}>
                                            Resumo geral dos principais indicadores
                                        </Text>
                                    </View>
                                </View>

                                {/* Filtro de tempo + botão filtrar */}
                                <View style={styles.filterRow}>
                                    <View style={styles.filterChips}>
                                        {([7, 14, 30] as const).map((d) => (
                                            <TouchableOpacity
                                                key={d}
                                                style={[
                                                    styles.filterChip,
                                                    timeFilter === d && styles.filterChipActive,
                                                ]}
                                                onPress={() => setTimeFilter(d)}
                                                activeOpacity={0.7}
                                            >
                                                <Text
                                                    style={[
                                                        styles.filterChipText,
                                                        timeFilter === d && styles.filterChipTextActive,
                                                    ]}
                                                >
                                                    Últimos {d} dias
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {loadingStats ? (
                                    <ActivityIndicator
                                        size="large"
                                        color={PRIMARY}
                                        style={{ marginVertical: 30 }}
                                    />
                                ) : (
                                    <>
                                        {/* 2×2 grid de mini-cards indicadores */}
                                        <View style={styles.indicatorGrid}>
                                            {/* Qualidade da água */}
                                            <View style={[styles.indicatorCard, styles.indicatorCardTall]}>
                                                <Text style={[styles.indicatorTitle, { fontFamily: questrial }]}>
                                                    Qualidade da água
                                                </Text>
                                                <View style={{ alignItems: "center", marginTop: 8 }}>
                                                    <WaterQualityRing data={qualidadeAgua} />
                                                </View>
                                                <View style={styles.qualidadeLegend}>
                                                    <LegendItem color="#EF4444" label="Crítico" value={qualidadeAgua.critico} total={qualidadeAgua.total} />
                                                    <LegendItem color="#F97316" label="Atenção" value={qualidadeAgua.atencao} total={qualidadeAgua.total} />
                                                    <LegendItem color="#F59E0B" label="Normal" value={qualidadeAgua.normal} total={qualidadeAgua.total} />
                                                    <LegendItem color="#22C55E" label="Boa" value={qualidadeAgua.boa} total={qualidadeAgua.total} />
                                                </View>
                                            </View>

                                            {/* Denúncias registradas */}
                                            <IndicatorSparkCard
                                                title="Denúncias registradas"
                                                value={denunciasCount}
                                                subtitle="No período"
                                                sparkValues={dailyDenunciasValues}
                                                sparkColor="#3B82F6"
                                                change={changeDenuncias}
                                                timeFilter={timeFilter}
                                                questrial={questrial}
                                            />

                                            {/* Análises técnicas */}
                                            <IndicatorSparkCard
                                                title="Análises técnicas"
                                                value={analisesCount}
                                                subtitle="Concluídas"
                                                sparkValues={dailyAnalisesValues}
                                                sparkColor="#22C55E"
                                                change={changeAnalises}
                                                timeFilter={timeFilter}
                                                questrial={questrial}
                                            />

                                            {/* Corpos críticos */}
                                            <IndicatorSparkCard
                                                title="Corpos críticos"
                                                value={corposCriticos}
                                                subtitle="Em estado crítico"
                                                sparkValues={dailyCriticoValues}
                                                sparkColor="#EF4444"
                                                change={changeCritico}
                                                timeFilter={timeFilter}
                                                questrial={questrial}
                                            />
                                        </View>

                                        {/* Banner informativo */}
                                        {corposCriticos > 0 && (
                                            <TouchableOpacity style={styles.infoBanner} activeOpacity={0.8}>
                                                <Ionicons
                                                    name="information-circle-outline"
                                                    size={16}
                                                    color="#374151"
                                                />
                                                <Text style={[styles.infoBannerText, { fontFamily: questrial }]}>
                                                    {corposCriticos} {corposCriticos === 1 ? "corpo hídrico apresentou" : "corpos hídricos apresentaram"} aumento de criticidade no período.
                                                </Text>
                                                <Text style={styles.infoBannerLink}>Ver detalhes</Text>
                                                <Ionicons name="chevron-forward" size={13} color={PRIMARY} />
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>

                            {/* ── Alertas prioritários ──────────────────────────────── */}
                            <View style={styles.listSection}>
                                <View style={styles.listSectionHeader}>
                                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                        Alertas prioritários
                                    </Text>
                                    <TouchableOpacity onPress={() => {}}>
                                        <Text style={styles.verTodosLink}>Ver todos</Text>
                                    </TouchableOpacity>
                                </View>

                                {alertas.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="checkmark-circle-outline" size={28} color="#22C55E" />
                                        <Text style={[styles.emptyStateText, { fontFamily: questrial }]}>
                                            Nenhum alerta no momento
                                        </Text>
                                    </View>
                                ) : (
                                    alertas.map((alerta) => {
                                        const cfg = alertLevelConfig(alerta.nivel);
                                        return (
                                            <TouchableOpacity
                                                key={alerta.id}
                                                style={styles.alertaItem}
                                                activeOpacity={0.75}
                                            >
                                                <View style={[styles.alertaIconBox, { backgroundColor: cfg.bgColor }]}>
                                                    <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
                                                </View>
                                                <View style={styles.alertaContent}>
                                                    <Text style={[styles.alertaTitle, { fontFamily: questrial }]}>
                                                        {alerta.titulo}
                                                    </Text>
                                                    <Text style={styles.alertaDesc} numberOfLines={1}>
                                                        {alerta.mensagem}
                                                    </Text>
                                                    <Text style={[styles.alertaLabel, { color: cfg.labelColor }]}>
                                                        {cfg.labelText}
                                                    </Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>

                            {/* ── Atividade da gestão ───────────────────────────────── */}
                            <View style={[styles.listSection, { marginBottom: 8 }]}>
                                <View style={styles.listSectionHeader}>
                                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                        Atividade da gestão
                                    </Text>
                                    <TouchableOpacity onPress={() => {}}>
                                        <Text style={styles.verTodosLink}>Ver todas</Text>
                                    </TouchableOpacity>
                                </View>

                                <AtividadeItem
                                    icon="stats-chart"
                                    iconBg="#E8F5E9"
                                    iconColor="#2E7D32"
                                    value={analisesConcluidas}
                                    title="Análises concluídas hoje"
                                    subtitle="Enviadas pelas equipes técnicas"
                                    onPress={() => {}}
                                    questrial={questrial}
                                />
                                <AtividadeItem
                                    icon="clipboard-outline"
                                    iconBg="#FFF3E0"
                                    iconColor="#F57C00"
                                    value={validacoesPendentes}
                                    title="Aguardando validação"
                                    subtitle="Pendências de decisão"
                                    onPress={() => router.push("/(tabs)/manage_water_bodies" as any)}
                                    questrial={questrial}
                                />
                                <AtividadeItem
                                    icon="people-outline"
                                    iconBg="#EDE9FE"
                                    iconColor="#7C3AED"
                                    value={equipesAtivas}
                                    title="Revisões solicitadas"
                                    subtitle="Aguardando retorno das equipes"
                                    onPress={() => router.push("/(tabs)/manage_technicians" as any)}
                                    questrial={questrial}
                                />
                                <AtividadeItem
                                    icon="time-outline"
                                    iconBg="#E0F2FE"
                                    iconColor="#0369A1"
                                    value={denunciasAndamento}
                                    title="Denúncias em andamento"
                                    subtitle="Em avaliação técnica"
                                    onPress={() => {}}
                                    questrial={questrial}
                                    noBorder
                                />
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* ══ NAVBAR ══ */}
                <ManagerBottomNav activeTab="home" fontFamily={questrial} />
            </View>
        </>
    );
}

// ─── Componentes auxiliares extraídos ────────────────────────────────────────

function LegendItem({
    color,
    label,
    value,
    total,
}: {
    color: string;
    label: string;
    value: number;
    total: number;
}) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>
                {label} {value} ({pct}%)
            </Text>
        </View>
    );
}

function IndicatorSparkCard({
    title,
    value,
    subtitle,
    sparkValues,
    sparkColor,
    change,
    timeFilter,
    questrial,
}: {
    title: string;
    value: number;
    subtitle: string;
    sparkValues: number[];
    sparkColor: string;
    change: { pct: number; up: boolean };
    timeFilter: number;
    questrial?: string;
}) {
    return (
        <View style={styles.indicatorCard}>
            <Text style={[styles.indicatorTitle, { fontFamily: questrial }]}>{title}</Text>
            <Text style={[styles.indicatorBigNumber, { fontFamily: questrial }]}>{value}</Text>
            <Text style={styles.indicatorSubtitle}>{subtitle}</Text>
            <View style={{ marginVertical: 6 }}>
                <MiniSparkline values={sparkValues.length > 0 ? sparkValues : [0]} color={sparkColor} />
            </View>
            {change.pct > 0 ? (
                <View style={[styles.changeBadge, { backgroundColor: change.up ? "#DBEAFE" : "#FEE2E2" }]}>
                    <Text style={[styles.changeBadgeText, { color: change.up ? "#1D4ED8" : "#B91C1C" }]}>
                        {change.up ? "↑" : "↓"} {change.pct}%
                    </Text>
                    <Text style={[styles.changeBadgeLabel, { color: change.up ? "#1D4ED8" : "#B91C1C" }]}>
                        {" "}vs. {timeFilter} dias anteriores
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

function AtividadeItem({
    icon,
    iconBg,
    iconColor,
    value,
    title,
    subtitle,
    onPress,
    questrial,
    noBorder = false,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    value: number;
    title: string;
    subtitle: string;
    onPress: () => void;
    questrial?: string;
    noBorder?: boolean;
}) {
    return (
        <TouchableOpacity
            style={[styles.atividadeItem, noBorder && { borderBottomWidth: 0 }]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            <View style={[styles.atividadeIconBox, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <View style={styles.atividadeContent}>
                <View style={styles.atividadeValueRow}>
                    <Text style={[styles.atividadeValue, { fontFamily: questrial }]}>{value}</Text>
                    <Text style={[styles.atividadeTitle, { fontFamily: questrial }]}>{title}</Text>
                </View>
                <Text style={styles.atividadeSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>
    );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#F5F9F8",
    },

    // Header
    headerGradient: {},
    headerSafeArea: { paddingBottom: 0 },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 8,
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    headerLogo: {
        width: 36,
        height: 36,
    },
    gestorBadge: {
        backgroundColor: "rgba(255,255,255,0.18)",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    gestorBadgeText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    bellButton: {
        position: "relative",
        padding: 4,
    },
    bellBadge: {
        position: "absolute",
        top: 0,
        right: 0,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#EF4444",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
    },
    bellBadgeText: {
        fontSize: 9,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    profileButton: {
        padding: 2,
    },
    profileCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    welcomeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingHorizontal: 20,
        paddingBottom: 18,
        gap: 10,
    },
    welcomeLeft: {
        flex: 1,
    },
    welcomeName: {
        fontSize: 22,
        fontWeight: "700",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flexShrink: 1,
    },
    locationText: {
        fontSize: 11,
        color: "rgba(255,255,255,0.75)",
        flexShrink: 1,
    },
    updateChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    updateChipTitle: {
        fontSize: 9,
        fontWeight: "600",
        color: PRIMARY,
    },
    updateChipTime: {
        fontSize: 9,
        color: "#6b7a7a",
    },

    // Body
    body: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },

    // Cards 2×2
    cardsGrid: {
        gap: 8,
        marginBottom: 20,
    },
    cardsRow: {
        flexDirection: "row",
        gap: 8,
    },
    quickCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        borderBottomWidth: 2.5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 3,
        elevation: 2,
    },
    quickCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
    },
    quickCardIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    quickCardNumber: {
        fontSize: 24,
        fontWeight: "700",
        color: PRIMARY,
        marginBottom: 2,
    },
    quickCardTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#374151",
        marginBottom: 2,
    },
    quickCardDesc: {
        fontSize: 10,
        color: "#9CA3AF",
    },

    // Panorama
    panoramaSection: {
        marginBottom: 20,
    },
    panoramaHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
    },
    sectionSubtitle: {
        fontSize: 11,
        color: "#9CA3AF",
        marginTop: 2,
    },
    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 8,
    },
    filterChips: {
        flexDirection: "row",
        gap: 6,
        flex: 1,
    },
    filterChip: {
        flex: 1,
        paddingVertical: 7,
        paddingHorizontal: 6,
        borderRadius: 8,
        backgroundColor: "#E8F5F3",
        borderWidth: 1,
        borderColor: "#B0C4C2",
        alignItems: "center",
    },
    filterChipActive: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },
    filterChipText: {
        fontSize: 10,
        fontWeight: "600",
        color: PRIMARY,
        textAlign: "center",
    },
    filterChipTextActive: {
        color: "#FFFFFF",
    },

    // Indicadores 2×2
    indicatorGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    indicatorCard: {
        width: (SCREEN_WIDTH - 42) / 2,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 3,
        elevation: 2,
    },
    indicatorCardTall: {},
    indicatorTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#374151",
        marginBottom: 4,
    },
    indicatorBigNumber: {
        fontSize: 28,
        fontWeight: "700",
        color: PRIMARY,
    },
    indicatorSubtitle: {
        fontSize: 10,
        color: "#9CA3AF",
        marginBottom: 2,
    },
    changeBadge: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 3,
        alignSelf: "flex-start",
        marginTop: 4,
        flexWrap: "wrap",
    },
    changeBadgeText: {
        fontSize: 10,
        fontWeight: "700",
    },
    changeBadgeLabel: {
        fontSize: 9,
    },

    // Legenda qualidade da água
    qualidadeLegend: {
        marginTop: 8,
        gap: 3,
    },
    legendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 9,
        color: "#6b7a7a",
    },

    // Banner informativo
    infoBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 12,
        gap: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 11,
        color: "#374151",
    },
    infoBannerLink: {
        fontSize: 11,
        fontWeight: "700",
        color: PRIMARY,
    },

    // Alertas prioritários
    listSection: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 3,
        elevation: 2,
    },
    listSectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    verTodosLink: {
        fontSize: 12,
        fontWeight: "600",
        color: PRIMARY,
    },
    alertaItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        gap: 10,
    },
    alertaIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    alertaContent: {
        flex: 1,
    },
    alertaTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 2,
    },
    alertaDesc: {
        fontSize: 11,
        color: "#6B7280",
        marginBottom: 3,
    },
    alertaLabel: {
        fontSize: 10,
        fontWeight: "600",
    },

    // Atividade da gestão
    atividadeItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        gap: 10,
    },
    atividadeIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    atividadeContent: {
        flex: 1,
    },
    atividadeValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 2,
    },
    atividadeValue: {
        fontSize: 18,
        fontWeight: "700",
        color: PRIMARY,
    },
    atividadeTitle: {
        fontSize: 12,
        fontWeight: "600",
        color: "#111827",
        flexShrink: 1,
    },
    atividadeSubtitle: {
        fontSize: 10,
        color: "#9CA3AF",
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        paddingVertical: 20,
        gap: 8,
    },
    emptyStateText: {
        fontSize: 13,
        color: "#9CA3AF",
    },
} as const);
