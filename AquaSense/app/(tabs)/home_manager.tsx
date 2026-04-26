import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/auth-context";

const PRIMARY = "#004d48";

export default function HomeManager() {
    const { userProfile } = useAuth();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;
    const [locationText, setLocationText] = useState("Carregando...");

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]).start();

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
                            <Text style={[styles.welcomeName, { fontFamily: questrial }]}>{userName}</Text>
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ CONTEÚDO ══ */}
                <View style={styles.body}>

                    {/* Cards de métricas */}
                    <View style={styles.metricsRow}>
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconCircle, { backgroundColor: "rgba(26,140,128,0.12)" }]}>
                                <Ionicons name="water-outline" size={22} color={PRIMARY} />
                            </View>
                            <Text style={[styles.metricNumber, { fontFamily: questrial }]}>0</Text>
                            <Text style={[styles.metricLabel, { fontFamily: questrial }]}>Pontos{"\n"}Monitorados</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconCircle, { backgroundColor: "rgba(230,168,23,0.12)" }]}>
                                <Ionicons name="warning-outline" size={22} color="#e6a817" />
                            </View>
                            <Text style={[styles.metricNumber, { fontFamily: questrial }]}>0</Text>
                            <Text style={[styles.metricLabel, { fontFamily: questrial }]}>Denúncias</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconCircle, { backgroundColor: "rgba(224,82,82,0.12)" }]}>
                                <Ionicons name="analytics-outline" size={22} color="#e05252" />
                            </View>
                            <Text style={[styles.metricNumber, { fontFamily: questrial }]}>0</Text>
                            <Text style={[styles.metricLabel, { fontFamily: questrial }]}>Análises{"\n"}Pendentes</Text>
                        </View>
                    </View>

                    {/* Seção qualidade da água */}
                    <View style={styles.qualidadeCard}>
                        <Text style={[styles.qualidadeTitle, { fontFamily: questrial }]}>Qualidade da Água</Text>
                        <View style={styles.qualidadeContent}>
                            <View style={styles.qualidadeCirculo}>
                                <Text style={[styles.qualidadeCirculoLabel, { fontFamily: questrial }]}>—</Text>
                                <Text style={[styles.qualidadeCirculoSub, { fontFamily: questrial }]}>sem dados</Text>
                            </View>
                            <View style={styles.qualidadeLegenda}>
                                <View style={styles.legendaItem}>
                                    <View style={[styles.legendaDot, { backgroundColor: "#e05252" }]} />
                                    <Text style={[styles.legendaText, { fontFamily: questrial }]}>Ruim</Text>
                                </View>
                                <View style={styles.legendaItem}>
                                    <View style={[styles.legendaDot, { backgroundColor: "#e6a817" }]} />
                                    <Text style={[styles.legendaText, { fontFamily: questrial }]}>Razoável</Text>
                                </View>
                                <View style={styles.legendaItem}>
                                    <View style={[styles.legendaDot, { backgroundColor: "#1a8c80" }]} />
                                    <Text style={[styles.legendaText, { fontFamily: questrial }]}>Boa</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                </View>

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
    body: { flex: 1, padding: 20 },
    metricsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    metricCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    metricIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    metricNumber: { fontSize: 28, fontWeight: "700", color: PRIMARY, marginVertical: 6 },
    metricLabel: { fontSize: 11, color: "#6b7a7a", textAlign: "center", lineHeight: 16 },
    qualidadeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    qualidadeTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY, marginBottom: 14 },
    qualidadeContent: { flexDirection: "row", alignItems: "center", gap: 20 },
    qualidadeCirculo: { width: 90, height: 90, borderRadius: 45, borderWidth: 8, borderColor: "#e0f2f1", alignItems: "center", justifyContent: "center" },
    qualidadeCirculoLabel: { fontSize: 18, fontWeight: "700", color: PRIMARY },
    qualidadeCirculoSub: { fontSize: 9, color: "#6b7a7a", textAlign: "center" },
    qualidadeLegenda: { flex: 1, gap: 10 },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendaDot: { width: 10, height: 10, borderRadius: 5 },
    legendaText: { fontSize: 13, color: "#6b7a7a" },
});