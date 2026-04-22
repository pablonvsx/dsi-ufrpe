import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    StatusBar,
    Pressable,
    Platform,
    Image,
    Animated,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { auth } from "@/config/firebase";
import { markTutorialAsSeen } from "@/services/firestore/users";

const PRIMARY = "#004d48";

type TabKey = "home" | "mapa" | "alertas" | "perfil";

export default function HomeComum() {
    const router = useRouter();
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [locationText, setLocationText] = useState("Carregando...");
    const [activeTab, setActiveTab] = useState<TabKey>("home");
    const [corpoHidricoModalVisible, setCorpoHidricoModalVisible] = useState(false);

    // Tutorial: abre automaticamente se vier o parâmetro ?tutorial=1
    const [tutorialVisible, setTutorialVisible] = useState(false);
    const [tutorialLoading, setTutorialLoading] = useState(false);

    const user = auth.currentUser;
    const userName = user?.displayName?.split(" ")[0] ?? "Usuário";

    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;
    const cardFade  = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        // Abre o tutorial se veio o parâmetro do login
        if (tutorial === "1") {
            // Pequeno delay para a Home terminar de montar antes de abrir o modal
            const timer = setTimeout(() => setTutorialVisible(true), 400);
            return () => clearTimeout(timer);
        }
    }, [tutorial]);

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 550, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(cardFade,  { toValue: 1, duration: 450, useNativeDriver: true }),
                Animated.timing(cardSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
            ]),
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
                    const city  = place.city ?? place.subregion ?? "Cidade";
                    const state = place.region ?? "";
                    setLocationText(`${city} - ${state}`);
                }
            } catch {
                setLocationText("Localização indisponível");
            }
        })();
    }, []);

    async function handleFinishTutorial() {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setTutorialLoading(true);
        try {
            await markTutorialAsSeen(currentUser.uid);
        } catch {
            // Falhou ao gravar — não bloqueia o usuário.
            // No próximo login o tutorial aparece de novo, o que é aceitável.
        } finally {
            setTutorialLoading(false);
            setTutorialVisible(false);
        }
    }

    function handleTabPress(tab: TabKey) {
        setActiveTab(tab);
        switch (tab) {
            case "mapa":    router.push("/map" as any);     break;
            case "alertas": router.push("/alerts" as any);  break;
            case "perfil":  router.push("/profile" as any); break;
            default: break;
        }
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>

                {/* ══ 1. HEADER GRADIENT ══ */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <Animated.View
                            style={[
                                styles.headerRow,
                                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                            ]}
                        >
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                                <Text style={[styles.locationText, { fontFamily: questrial }]}>
                                    {locationText}
                                </Text>
                            </View>
                            <Image
                                source={require("../../assets/images/aquasense.png")}
                                style={styles.headerLogo}
                                resizeMode="contain"
                                tintColor="#FFFFFF"
                            />
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ 2. FAIXA TEAL ══ */}
                <LinearGradient
                    colors={["#0d9080", "#1fc8b4", "#3ff3e7"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.tealBand}
                >
                    <Animated.Text
                        style={[
                            styles.sectionTitle,
                            { fontFamily: questrial, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                        ]}
                    >
                        Visão geral da água
                    </Animated.Text>
                    <View style={styles.waveWhite} />
                </LinearGradient>

                {/* ══ 3. FUNDO BRANCO ══ */}
                <ScrollView
                    style={styles.whiteBody}
                    contentContainerStyle={styles.whiteBodyContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View
                        style={[
                            styles.welcomeCard,
                            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
                        ]}
                    >
                        <View style={styles.welcomeIconCircle}>
                            <Ionicons name="water-outline" size={28} color={PRIMARY} />
                        </View>
                        <Text style={[styles.welcomeTitle, { fontFamily: questrial }]}>
                            Bem-vindo, {userName}
                        </Text>
                        <View style={styles.cardDivider} />
                        <Text style={[styles.welcomeBody, { fontFamily: questrial }]}>
                            Explore os corpos hídricos, registre observações e acompanhe alertas da sua região.
                        </Text>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.actionsRow,
                            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
                        ]}
                    >
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionPrimary]}
                            onPress={() => router.push("/register_observation" as any)}
                            activeOpacity={0.82}
                        >
                            <Ionicons name="document-text-outline" size={28} color="#FFFFFF" style={styles.actionIcon} />
                            <Text style={[styles.actionTextPrimary, { fontFamily: questrial }]}>
                                {"Registrar\nobservação"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionSecondary]}
                            onPress={() => router.push("/report_complaint" as any)}
                            activeOpacity={0.82}
                        >
                            <Ionicons name="megaphone-outline" size={28} color={PRIMARY} style={styles.actionIcon} />
                            <Text style={[styles.actionTextSecondary, { fontFamily: questrial }]}>
                                {"Fazer\ndenúncia"}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>

                {/* ══ 4. NAVBAR ══ */}
                <SafeAreaView edges={["bottom"]} style={styles.navBarWrapper}>
                    <View style={styles.navBar}>
                        <NavBarItem icon="home" iconOutline="home-outline" label="Home" active={activeTab === "home"} fontFamily={questrial} onPress={() => handleTabPress("home")} />
                        <NavBarItem icon="map"  iconOutline="map-outline"  label="Mapa" active={activeTab === "mapa"} fontFamily={questrial} onPress={() => handleTabPress("mapa")} />

                        <TouchableOpacity style={styles.fabButton} onPress={() => setCorpoHidricoModalVisible(true)} activeOpacity={0.85}>
                            <View style={styles.fabInner}>
                                <Ionicons name="add" size={32} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>

                        <NavBarItem icon="notifications" iconOutline="notifications-outline" label="Alertas" active={activeTab === "alertas"} fontFamily={questrial} onPress={() => handleTabPress("alertas")} />
                        <NavBarItem icon="person"        iconOutline="person-outline"        label="Perfil"  active={activeTab === "perfil"}  fontFamily={questrial} onPress={() => handleTabPress("perfil")} />
                    </View>
                </SafeAreaView>
            </View>

            {/* Modal: registrar corpo hídrico */}
            <CorpoHidricoModal
                visible={corpoHidricoModalVisible}
                fontFamily={questrial}
                onClose={() => setCorpoHidricoModalVisible(false)}
                onRegister={() => {
                    setCorpoHidricoModalVisible(false);
                    router.push("/register_water_body" as any);
                }}
            />

            {/* Modal: tutorial — abre automaticamente no primeiro acesso */}
            <TutorialModal
                visible={tutorialVisible}
                fontFamily={questrial}
                loading={tutorialLoading}
                onFinish={handleFinishTutorial}
            />
        </>
    );
}

// ─────────────────────────────────────────────
// NAV BAR ITEM
// ─────────────────────────────────────────────
function NavBarItem({ icon, iconOutline, label, active, fontFamily, onPress }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string; active: boolean; fontFamily?: string; onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
            <Ionicons name={active ? icon : iconOutline} size={24} color={active ? PRIMARY : "#b0c4c2"} />
            <Text style={[styles.navLabel, { fontFamily, color: active ? PRIMARY : "#b0c4c2" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─────────────────────────────────────────────
// MODAL: CORPO HÍDRICO
// ─────────────────────────────────────────────
function CorpoHidricoModal({ visible, fontFamily, onClose, onRegister }: {
    visible: boolean; fontFamily?: string; onClose: () => void; onRegister: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalIconCircle}>
                        <Ionicons name="water" size={32} color={PRIMARY} />
                    </View>
                    <Text style={[styles.modalTitle, { fontFamily }]}>Registrar corpo hídrico</Text>
                    <View style={styles.modalDivider} />
                    <Text style={[styles.modalDescription, { fontFamily }]}>
                        Identifique e cadastre um novo corpo hídrico na sua região — rios, lagos, açudes ou nascentes.
                    </Text>
                    <TouchableOpacity style={styles.modalButton} onPress={onRegister} activeOpacity={0.85}>
                        <Text style={[styles.modalButtonText, { fontFamily }]}>Começar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} activeOpacity={0.7}>
                        <Text style={[styles.modalCancelText, { fontFamily }]}>Cancelar</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─────────────────────────────────────────────
// MODAL: TUTORIAL
// ─────────────────────────────────────────────
function TutorialModal({ visible, fontFamily, loading, onFinish }: {
    visible: boolean;
    fontFamily?: string;
    loading: boolean;
    onFinish: () => void;
}) {
    const steps = [
        { icon: "home-outline" as const,          title: "Home",                    desc: "Acompanhe informações e acesse as funcionalidades principais." },
        { icon: "create-outline" as const,        title: "Registrar observação",    desc: "Relate o que você observou em um corpo hídrico." },
        { icon: "warning-outline" as const,       title: "Fazer denúncia",          desc: "Reporte problemas ambientais na sua região." },
        { icon: "add-circle-outline" as const,    title: "Registrar corpo hídrico", desc: "Cadastre um novo rio, lago ou açude." },
        { icon: "map-outline" as const,           title: "Mapa",                    desc: "Visualize corpos hídricos e alertas no mapa." },
        { icon: "notifications-outline" as const, title: "Alertas",                 desc: "Receba notificações sobre qualidade da água." },
        { icon: "person-outline" as const,        title: "Perfil",                  desc: "Gerencie sua conta e configurações." },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onFinish}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { maxHeight: "80%" }]}>
                    <Text style={[styles.modalTitle, { fontFamily, marginBottom: 4 }]}>
                        Bem-vindo ao AquaSense!
                    </Text>
                    <Text style={[styles.modalDescription, { fontFamily, marginBottom: 12 }]}>
                        Veja rapidamente o que você pode fazer:
                    </Text>
                    <View style={styles.modalDivider} />
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                        {steps.map((s) => (
                            <View key={s.title} style={styles.tutorialRow}>
                                <Ionicons name={s.icon} size={20} color={PRIMARY} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.tutorialStepTitle, { fontFamily }]}>{s.title}</Text>
                                    <Text style={[styles.tutorialStepDesc,  { fontFamily }]}>{s.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        style={[styles.modalButton, { marginTop: 16 }]}
                        onPress={onFinish}
                        activeOpacity={0.85}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#FFFFFF" />
                            : <Text style={[styles.modalButtonText, { fontFamily }]}>Entendi, vamos começar!</Text>
                        }
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────
// ESTILOS — idênticos ao original
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#FFFFFF" },

    headerGradient: {},
    headerSafeArea:  { paddingBottom: 14 },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    locationText:   { fontSize: 15, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "600" },
    headerLogo:     { width: 55, height: 55 },

    tealBand: {
        paddingTop: 20,
        paddingBottom: 0,
        overflow: "hidden",
    },
    sectionTitle: {
        fontSize: 20,
        color: "#FFFFFF",
        fontWeight: "700",
        letterSpacing: 0.3,
        textAlign: "center",
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    waveWhite: {
        height: 28,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },

    whiteBody: { flex: 1, backgroundColor: "#FFFFFF" },
    whiteBodyContent: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 16,
    },

    welcomeCard: {
        backgroundColor: "#F5F9F8",
        borderRadius: 20,
        padding: 24,
        marginBottom: 18,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    welcomeIconCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: "rgba(63,243,231,0.18)",
        alignItems: "center", justifyContent: "center",
        marginBottom: 14,
    },
    welcomeTitle: { fontSize: 18, color: PRIMARY, fontWeight: "700", textAlign: "center", marginBottom: 12 },
    cardDivider:  { height: 1, backgroundColor: "#e0f2f1", marginBottom: 14, width: "100%" },
    welcomeBody:  { fontSize: 14, color: "#6b7a7a", textAlign: "center", lineHeight: 22 },

    actionsRow: { flexDirection: "row", gap: 14 },
    actionButton: {
        flex: 1, borderRadius: 16,
        paddingVertical: 22, paddingHorizontal: 14,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 4,
    },
    actionPrimary:   { backgroundColor: PRIMARY },
    actionSecondary: { backgroundColor: "#F2F7F6" },
    actionIcon: { marginBottom: 8 },
    actionTextPrimary:   { fontSize: 13, color: "#FFFFFF", textAlign: "center", lineHeight: 19 },
    actionTextSecondary: { fontSize: 13, color: PRIMARY,   textAlign: "center", lineHeight: 19 },

    navBarWrapper: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 12,
    },
    navBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 4 : 10,
        paddingHorizontal: 8,
    },
    navItem:  { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
    navLabel: { fontSize: 10, marginTop: 3, letterSpacing: 0.1 },

    fabButton: {
        width: 56, height: 56, borderRadius: 28,
        marginBottom: 16,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.40,
        shadowRadius: 10,
        elevation: 8,
    },
    fabInner: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: PRIMARY,
        alignItems: "center", justifyContent: "center",
    },

    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.50)",
        alignItems: "center", justifyContent: "center",
        paddingHorizontal: 28,
    },
    modalCard: {
        width: "100%", backgroundColor: "#FFFFFF",
        borderRadius: 20, padding: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
    },
    modalIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: "rgba(63,243,231,0.15)",
        alignItems: "center", justifyContent: "center",
        alignSelf: "center", marginBottom: 16,
    },
    modalTitle:       { fontSize: 17, color: PRIMARY, textAlign: "center", marginBottom: 14, fontWeight: "600" },
    modalDivider:     { height: 1, backgroundColor: "#e0f2f1", marginBottom: 16 },
    modalDescription: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 22, marginBottom: 20 },
    modalButton:      { backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: "center" },
    modalButtonText:  { fontSize: 15, color: "#FFFFFF", fontWeight: "600", letterSpacing: 0.3 },
    modalCancelButton:{ paddingVertical: 12, alignItems: "center" },
    modalCancelText:  { fontSize: 13, color: "#888", textDecorationLine: "underline" },

    tutorialRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    tutorialStepTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 2 },
    tutorialStepDesc:  { fontSize: 12, color: "#6b7a7a", lineHeight: 18 },
});