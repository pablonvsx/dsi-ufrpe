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
import { LineChart } from "react-native-chart-kit";
import { useAuth } from "@/contexts/auth-context";
import { getUnvalidatedWaterBodies } from "@/services/firestore/water_bodies";
import { getCollaborators, getTechnicians } from "@/services/firestore/users";
import {
    getColetasSimplesPorNivel,
    getColetasCompletasPorNivel,
    getColetasSimples,
    getColetasCompletas,
    getDailyColetasSimples,
    getDailyColetasCompletas,
    getPreviousPeriodColetasSimples,
    getPreviousPeriodColetasCompletas,
    DailyAnalysisData,
} from "@/services/coletas";

const PRIMARY = "#004d48";

export default function HomeManager() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;
    const [locationText, setLocationText] = useState("Carregando...");
    const [unvalidatedCount, setUnvalidatedCount] = useState(0);
    const [collaboratorsCount, setCollaboratorsCount] = useState(0);
    const [techniciansCount, setTechniciansCount] = useState(0);
    
    // Estados para Panorama da Região
    const [timeFilter, setTimeFilter] = useState(30); // dias
    const [qualidadeAgua, setQualidadeAgua] = useState({ boa: 0, normal: 0, atencao: 0, critico: 0, total: 0 });
    const [analisesSimples, setAnalisesSimples] = useState(0);
    const [analisesCompletas, setAnalisesCompletas] = useState(0);
    const [dailySimples, setDailySimples] = useState<DailyAnalysisData[]>([]);
    const [dailyCompletas, setDailyCompletas] = useState<DailyAnalysisData[]>([]);
    const [previousSimples, setPreviousSimples] = useState(0);
    const [previousCompletas, setPreviousCompletas] = useState(0);
    const [loadingStats, setLoadingStats] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]).start();

        // Buscar contagem de corpos não validados
        (async () => {
            try {
                const unvalidated = await getUnvalidatedWaterBodies();
                setUnvalidatedCount(unvalidated.length);
                
                const collaborators = await getCollaborators();
                setCollaboratorsCount(collaborators.length);
                
                const technicians = await getTechnicians();
                setTechniciansCount(technicians.length);
            } catch (error) {
                console.error("Erro ao buscar contagens:", error);
            }
        })();

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") { setLocationText("Localização negada"); return; }
                const loc = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
                if (place) {
                    const city = place.city ?? place.subregion ?? "Cidade";
                    const state = place.region ?? "";
                    setLocationText(`${city} - ${state}`);
                }
            } catch {
                setLocationText("Localização indisponível");
            }
        })();
    }, []);

    // Carregar dados de coletas quando o filtro de tempo mudar
    useEffect(() => {
        const fetchColetasData = async () => {
            try {
                setLoadingStats(true);
                const qualidade = await getColetasSimplesPorNivel(timeFilter);
                setQualidadeAgua(qualidade);
                
                const simples = await getColetasSimples(timeFilter);
                setAnalisesSimples(simples);
                
                const completas = await getColetasCompletas(timeFilter);
                setAnalisesCompletas(completas);

                // Buscar dados diários
                const dailySimplesData = await getDailyColetasSimples(timeFilter);
                setDailySimples(dailySimplesData);

                const dailyCompletasData = await getDailyColetasCompletas(timeFilter);
                setDailyCompletas(dailyCompletasData);

                // Buscar período anterior (14 dias antes)
                const prevSimples = await getPreviousPeriodColetasSimples(timeFilter);
                setPreviousSimples(prevSimples);

                const prevCompletas = await getPreviousPeriodColetasCompletas(timeFilter);
                setPreviousCompletas(prevCompletas);
            } catch (error) {
                console.error("Erro ao buscar dados das coletas:", error);
            } finally {
                setLoadingStats(false);
            }
        };
        
        fetchColetasData();
    }, [timeFilter]);

    // Função para preparar dados do gráfico com todas as datas do período
    const prepareChartData = (dailyData: DailyAnalysisData[], daysBack: number) => {
        const dataMap = new Map(dailyData.map(d => [d.date, d.count]));
        const chartData: { date: string; count: number }[] = [];
        
        const today = new Date();
        for (let i = daysBack - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;
            chartData.push({ date: dateStr, count });
        }
        
        return chartData;
    };

    // Função para gerar labels do gráfico (a cada N dias)
    const generateChartLabels = (daysBack: number) => {
        const interval = daysBack <= 30 ? 5 : daysBack <= 60 ? 10 : 15;
        const labels: string[] = [];
        
        for (let i = 0; i < daysBack; i++) {
            if (i === 0 || i === daysBack - 1 || i % interval === 0) {
                const date = new Date();
                date.setDate(date.getDate() - (daysBack - 1 - i));
                labels.push(`${date.getDate()}/${String(date.getMonth() + 1).padStart(2, "0")}`);
            } else {
                labels.push("");
            }
        }
        
        return labels;
    };

    const userName = userProfile?.nome?.split(" ")[0] ?? "Gestor";

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={styles.root}>

                {/* ══ HEADER ══ */}
                <LinearGradient colors={["#004d48", "#0a6b5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient}>
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                                <Text style={[styles.locationText, { fontFamily: questrial }]}>{locationText}</Text>
                            </View>
                            <Image
                                source={require("../../assets/images/aquasense.png")}
                                style={styles.headerLogo}
                                resizeMode="contain"
                                tintColor="#FFFFFF"
                            />
                        </Animated.View>
                        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: 20, paddingBottom: 16 }}>
                            <Text style={[styles.welcomeText, { fontFamily: questrial }]}>Bem-vindo de volta,</Text>
                            <Text style={[styles.welcomeName, { fontFamily: questrial }]}>Olá, {userName}</Text>
                            <Text style={[styles.locationSubtext, { fontFamily: questrial }]}>Painel de gestão territorial</Text>
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
                            onPress={() => {}}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#FFE8E8" }]}>
                                <Ionicons name="alert-circle" size={22} color="#EF4444" />
                            </View>
                            <Text style={styles.quickCardNumber}>—</Text>
                            <Text style={styles.quickCardTitle}>Alertas</Text>
                            <Text style={styles.quickCardDescription}>Em breve</Text>
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
                            <Text style={styles.quickCardTitle}>Equipes</Text>
                            <Text style={styles.quickCardDescription}>técnicas</Text>
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
                            <Text style={styles.quickCardDescription}>adores</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                        {/* Card 4: Gerenciar Corpos Hídricos */}
                        <TouchableOpacity 
                            style={[styles.quickCard, styles.waterBodiesCard]}
                            onPress={() => router.push("/(tabs)/manage_water_bodies" as any)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.quickCardIcon, { backgroundColor: "#E0E8FF" }]}>
                                <Ionicons name="clipboard" size={22} color="#3B82F6" />
                            </View>
                            <Text style={styles.quickCardNumber}>{unvalidatedCount}</Text>
                            <Text style={styles.quickCardTitle}>Novos</Text>
                            <Text style={styles.quickCardDescription}>registros</Text>
                            <Ionicons name="chevron-forward" size={14} color="#9ca3a3" style={styles.quickCardArrow} />
                        </TouchableOpacity>

                    </View>

                    {/* ══ PANORAMA DA REGIÃO ══ */}
                    <View style={styles.panoramaSection}>
                        <Text style={[styles.panoramaTitle, { fontFamily: questrial }]}>Panorama da Região</Text>
                        
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
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: "#EF4444" }]} />
                                            <Text style={styles.legendText}>Crítico</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Análises Simples */}
                                <View style={styles.chartCard}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartCardScroll}>
                                        <View style={styles.chartCardContent}>
                                            <View style={styles.chartHeaderRow}>
                                                <Text style={[styles.chartTitle, { fontFamily: questrial }]}>Análises Simples</Text>
                                                {previousSimples > 0 && (
                                                    <View style={[styles.percentageBadge, { backgroundColor: analisesSimples >= previousSimples ? "#DBEAFE" : "#FEE2E2" }]}>
                                                        <Text style={[styles.percentageText, { color: analisesSimples >= previousSimples ? "#1E40AF" : "#7F1D1D" }]}>
                                                            {analisesSimples >= previousSimples ? "↑" : "↓"} {Math.abs(Math.round((analisesSimples - previousSimples) / previousSimples * 100))}%
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            {dailySimples.length > 0 ? (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollContainer}>
                                                    <LineChart
                                                        data={{
                                                            labels: generateChartLabels(timeFilter),
                                                            datasets: [{ data: prepareChartData(dailySimples, timeFilter).map(d => d.count) }],
                                                        }}
                                                        width={Math.max(Dimensions.get("window").width - 48, timeFilter * 8)}
                                                        height={180}
                                                        chartConfig={{
                                                            backgroundColor: "#ffffff",
                                                            backgroundGradientFrom: "#ffffff",
                                                            backgroundGradientTo: "#ffffff",
                                                            decimalPlaces: 0,
                                                            color: () => "#7C3AED",
                                                            strokeWidth: 2,
                                                            propsForDots: {
                                                                r: "2.5",
                                                                strokeWidth: "1.5",
                                                                stroke: "#7C3AED",
                                                            },
                                                            propsForLabels: {
                                                                fontSize: 10,
                                                            },
                                                        }}
                                                        yAxisLabel=""
                                                        yAxisSuffix=""
                                                        fromZero={true}
                                                        style={styles.chartInnerContainer}
                                                        withVerticalLines={false}
                                                    />
                                                </ScrollView>
                                            ) : (
                                                <Text style={styles.noDataText}>Sem dados suficientes para este período</Text>
                                            )}
                                        </View>
                                    </ScrollView>
                                    <Text style={styles.statNumber}>{analisesSimples} análises realizadas</Text>
                                </View>

                                {/* Análises Técnicas */}
                                <View style={styles.chartCard}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartCardScroll}>
                                        <View style={styles.chartCardContent}>
                                            <View style={styles.chartHeaderRow}>
                                                <Text style={[styles.chartTitle, { fontFamily: questrial }]}>Análises Técnicas</Text>
                                                {previousCompletas > 0 && (
                                                    <View style={[styles.percentageBadge, { backgroundColor: analisesCompletas >= previousCompletas ? "#DBEAFE" : "#FEE2E2" }]}>
                                                        <Text style={[styles.percentageText, { color: analisesCompletas >= previousCompletas ? "#1E40AF" : "#7F1D1D" }]}>
                                                            {analisesCompletas >= previousCompletas ? "↑" : "↓"} {Math.abs(Math.round((analisesCompletas - previousCompletas) / previousCompletas * 100))}%
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            {dailyCompletas.length > 0 ? (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollContainer}>
                                                    <LineChart
                                                        data={{
                                                            labels: generateChartLabels(timeFilter),
                                                            datasets: [{ data: prepareChartData(dailyCompletas, timeFilter).map(d => d.count) }],
                                                        }}
                                                        width={Math.max(Dimensions.get("window").width - 48, timeFilter * 8)}
                                                        height={180}
                                                        chartConfig={{
                                                            backgroundColor: "#ffffff",
                                                            backgroundGradientFrom: "#ffffff",
                                                            backgroundGradientTo: "#ffffff",
                                                            decimalPlaces: 0,
                                                            color: () => "#3B82F6",
                                                            strokeWidth: 2,
                                                            propsForDots: {
                                                                r: "2.5",
                                                                strokeWidth: "1.5",
                                                                stroke: "#3B82F6",
                                                            },
                                                            propsForLabels: {
                                                                fontSize: 10,
                                                            },
                                                        }}
                                                        yAxisLabel=""
                                                        yAxisSuffix=""
                                                        fromZero={true}
                                                        style={styles.chartInnerContainer}
                                                        withVerticalLines={false}
                                                    />
                                                </ScrollView>
                                            ) : (
                                                <Text style={styles.noDataText}>Sem dados suficientes para este período</Text>
                                            )}
                                        </View>
                                    </ScrollView>
                                    <Text style={styles.statNumber}>{analisesCompletas} análises realizadas</Text>
                                </View>
                            </>
                        )}
                    </View>

                </ScrollView>

            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },
    headerGradient: {},
    headerSafeArea: { paddingBottom: 0 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    locationText: { fontSize: 15, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "600" },
    headerLogo: { width: 55, height: 55 },
    welcomeText: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 8 },
    welcomeName: { fontSize: 22, color: "#FFFFFF", fontWeight: "700" },
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
    manageCard: { borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5, marginBottom: 16 },
    manageCardGradient: { paddingVertical: 20, paddingHorizontal: 16 },
    manageCardContent: { flexDirection: "row", alignItems: "center", gap: 16 },
    manageCardIconContainer: { position: "relative" },
    manageCardIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
    badgeContainer: { position: "absolute", top: -8, right: -8, width: 32, height: 32, borderRadius: 16, backgroundColor: "#FF6B6B", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1a8c80" },
    badgeText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    manageCardText: { flex: 1 },
    manageCardTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
    manageCardSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.9)" },

    // Cards Grid
    cardsContainer: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 20,
        flexWrap: "nowrap",
    },
    quickCard: {
        flex: 1,
        minWidth: 0,
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 10,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        borderBottomWidth: 2,
    },
    quickCardIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    quickCardNumber: {
        fontSize: 16,
        fontWeight: "700",
        color: "#004d48",
        marginBottom: 2,
    },
    quickCardTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#004d48",
        textAlign: "center",
    },
    quickCardDescription: {
        fontSize: 8,
        color: "#9ca3a3",
        textAlign: "center",
        marginBottom: 4,
    },
    quickCardArrow: {
        marginTop: 2,
    },
    alertCard: { borderBottomColor: "#FCA5A5" },
    techniciansCard: { borderBottomColor: "#86EFAC" },
    collaboratorsCard: { borderBottomColor: "#D8B4FE" },
    waterBodiesCard: { borderBottomColor: "#93C5FD" },
    locationSubtext: {
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
        marginTop: 2,
    },

    // Panorama da Região
    panoramaSection: {
        marginTop: 24,
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    panoramaTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#004d48",
        marginBottom: 12,
    },
    timeFilterContainer: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 18,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: "#E8F5F3",
        borderWidth: 1,
        borderColor: "#B0C4C2",
    },
    filterButtonActive: {
        backgroundColor: "#004d48",
        borderColor: "#004d48",
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#004d48",
        textAlign: "center",
    },
    filterButtonTextActive: {
        color: "#FFFFFF",
    },
    chartCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#004d48",
        marginBottom: 12,
    },
    horizontalBar: {
        flexDirection: "row",
        height: 24,
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 12,
    },
    barSegment: {
        height: "100%",
    },
    chartLegend: {
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: 12,
        justifyContent: "space-around",
        paddingHorizontal: 4,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 3,
    },
    legendText: {
        fontSize: 11,
        color: "#6b7a7a",
        fontWeight: "500",
    },
    statBar: {
        height: 20,
        backgroundColor: "#f0f9f8",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 8,
    },
    statBarFill: {
        height: "100%",
        borderRadius: 6,
    },
    statNumber: {
        fontSize: 12,
        color: "#6b7a7a",
        fontWeight: "500",
    },
    chartHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    percentageBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    percentageText: {
        fontSize: 12,
        fontWeight: "700",
    },
    chartContainer: {
        marginVertical: 4,
        marginHorizontal: -16,
        borderRadius: 8,
    },
    chartCardScroll: {
        marginHorizontal: -14,
        paddingHorizontal: 14,
    },
    chartCardContent: {
        flexDirection: "column",
    },
    chartScrollContainer: {
        marginVertical: 4,
        marginHorizontal: -16,
    },
    chartInnerContainer: {
        marginVertical: 0,
    },
    noDataText: {
        fontSize: 12,
        color: "#a0a0a0",
        textAlign: "center",
        marginVertical: 12,
    },
} as const);