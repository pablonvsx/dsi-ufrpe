import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    Animated,
    TouchableOpacity,
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

                    {/* Card: Gerenciamento de Corpos Hídricos */}
                    <TouchableOpacity
                        style={styles.manageCard}
                        onPress={() => router.push("/(tabs)/manage_water_bodies")}
                        activeOpacity={0.75}
                    >
                        <LinearGradient
                            colors={["#1a8c80", "#0d6b5f"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.manageCardGradient}
                        >
                            <View style={styles.manageCardContent}>
                                <View style={styles.manageCardIconContainer}>
                                    <View style={styles.manageCardIcon}>
                                        <Ionicons name="clipboard-outline" size={40} color="#FFFFFF" />
                                    </View>
                                    {unvalidatedCount > 0 && (
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{unvalidatedCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.manageCardText}>
                                    <Text style={[styles.manageCardTitle, { fontFamily: questrial }]}>
                                        Gerenciar Corpos Hídricos
                                    </Text>
                                    <Text style={[styles.manageCardSubtitle, { fontFamily: questrial }]}>
                                        Revisar e validar novos cadastros
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" style={{ marginLeft: "auto" }} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Card: Gerenciar Colaboradores */}
                    <TouchableOpacity
                        style={styles.manageCard}
                        onPress={() => router.push("/(tabs)/manage_collaborators" as any)}
                        activeOpacity={0.75}
                    >
                        <LinearGradient
                            colors={["#2E7D76", "#1a5850"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.manageCardGradient}
                        >
                            <View style={styles.manageCardContent}>
                                <View style={styles.manageCardIconContainer}>
                                    <View style={styles.manageCardIcon}>
                                        <Ionicons name="people-outline" size={40} color="#FFFFFF" />
                                    </View>
                                    {collaboratorsCount > 0 && (
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{collaboratorsCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.manageCardText}>
                                    <Text style={[styles.manageCardTitle, { fontFamily: questrial }]}>
                                        Gerenciar Colaboradores
                                    </Text>
                                    <Text style={[styles.manageCardSubtitle, { fontFamily: questrial }]}>
                                        Editar e ativar/desativar usuários
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" style={{ marginLeft: "auto" }} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Card: Gerenciar Técnicos */}
                    <TouchableOpacity
                        style={styles.manageCard}
                        onPress={() => router.push("/(tabs)/manage_technicians" as any)}
                        activeOpacity={0.75}
                    >
                        <LinearGradient
                            colors={["#1F6B64", "#0d4a42"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.manageCardGradient}
                        >
                            <View style={styles.manageCardContent}>
                                <View style={styles.manageCardIconContainer}>
                                    <View style={styles.manageCardIcon}>
                                        <Ionicons name="build-outline" size={40} color="#FFFFFF" />
                                    </View>
                                    {techniciansCount > 0 && (
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{techniciansCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.manageCardText}>
                                    <Text style={[styles.manageCardTitle, { fontFamily: questrial }]}>
                                        Gerenciar Técnicos
                                    </Text>
                                    <Text style={[styles.manageCardSubtitle, { fontFamily: questrial }]}>
                                        Editar e ativar/desativar usuários
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" style={{ marginLeft: "auto" }} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

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
    manageCard: { borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
    manageCardGradient: { paddingVertical: 24, paddingHorizontal: 20 },
    manageCardContent: { flexDirection: "row", alignItems: "center", gap: 16 },
    manageCardIconContainer: { position: "relative" },
    manageCardIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
    badgeContainer: { position: "absolute", top: -8, right: -8, width: 32, height: 32, borderRadius: 16, backgroundColor: "#FF6B6B", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1a8c80" },
    badgeText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    manageCardText: { flex: 1 },
    manageCardTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
    manageCardSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.9)" },
});