import React, { useState, useEffect, useRef, useCallback } from "react";
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

import { useAuth } from "@/contexts/auth-context";
import { markTutorialAsSeen } from "@/services/firestore/users";
import { getWaterBodyById } from "@/services/firestore/water_bodies";
import {
    buscarObservacoesPorCorpo,
    calcularResumoObservacoes,
    ResumoObservacoes,
} from "@/services/firestore/observations";
import { CorpoHidrico } from "@/types/water_bodies";

const PRIMARY = "#004d48";
const BORDER_LIGHT = "#e0f2f1";
const TEXT_MUTED = "#6b7a7a";
const SURFACE = "#F5F9F8";

type TabKey = "home" | "mapa" | "alertas" | "perfil";

function StarRating({ stars, size = 13 }: { stars: number; size?: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                    key={i}
                    name={i <= stars ? "star" : "star-outline"}
                    size={size}
                    color={i <= stars ? "#FFA000" : "#ccc"}
                />
            ))}
        </View>
    );
}

export default function HomeComum() {
    const router = useRouter();
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
    const { userProfile } = useAuth();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [locationText, setLocationText] = useState("Carregando...");
    const [activeTab, setActiveTab] = useState<TabKey>("home");
    const [corpoHidricoModalVisible, setCorpoHidricoModalVisible] = useState(false);
    const [tutorialVisible, setTutorialVisible] = useState(false);
    const [tutorialLoading, setTutorialLoading] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    const [ultimoCorpo, setUltimoCorpo] = useState<CorpoHidrico | null>(null);
    const [resumoUltimoCorpo, setResumoUltimoCorpo] = useState<ResumoObservacoes | null>(null);
    const [loadingUltimoCorpo, setLoadingUltimoCorpo] = useState(false);

    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;
    const cardFade  = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        if (tutorial === "1") {
            const timer = setTimeout(() => setTutorialVisible(true), 400);
            return () => clearTimeout(timer);
        }
    }, [tutorial]);

    useEffect(() => {
        // Atualiza o relógio a cada minuto
        const interval = setInterval(() => setCurrentDateTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

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

    const fetchUltimoCorpo = useCallback(async (id: string) => {
        setLoadingUltimoCorpo(true);
        try {
            const [corpo, obs] = await Promise.all([
                getWaterBodyById(id),
                buscarObservacoesPorCorpo(id),
            ]);
            setUltimoCorpo(corpo);
            setResumoUltimoCorpo(calcularResumoObservacoes(obs));
        } catch {
            setUltimoCorpo(null);
            setResumoUltimoCorpo(null);
        } finally {
            setLoadingUltimoCorpo(false);
        }
    }, []);

    useEffect(() => {
        const id = userProfile?.ultimoCorpoHidricoAcessadoId;
        if (id) {
            fetchUltimoCorpo(id);
        } else {
            setUltimoCorpo(null);
            setResumoUltimoCorpo(null);
        }
    }, [userProfile?.ultimoCorpoHidricoAcessadoId]);

    async function handleFinishTutorial() {
        const uid = userProfile?.uid;
        if (!uid) return;
        setTutorialLoading(true);
        try { await markTutorialAsSeen(uid); } catch { /* silencioso */ }
        finally { setTutorialLoading(false); setTutorialVisible(false); }
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

    function handleVerNoMapa() {
        if (!ultimoCorpo?.id) return;
        router.push({ pathname: "/map", params: { focusCorpoId: ultimoCorpo.id } } as any);
    }

    const userName = userProfile?.nome ?? "Usuário";
    const isGestor = userProfile?.tipoUsuario === "gestor";

    // Formata data e hora
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    };
    const formatDate = (date: Date) => {
        return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* ══ HEADER NOVO ══ */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e", "#0d9080"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                            {/* Linha topo: localização + tipo + logo + sino */}
                            <View style={styles.headerTopRow}>
                                <View>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={15} color="#FFFFFF" />
                                        <Text style={[styles.locationText, { fontFamily: questrial }]}>{locationText}</Text>
                                    </View>
                                    <Text style={[styles.userTypeText, { fontFamily: questrial }]}>Comum</Text>
                                </View>
                                <View style={styles.headerIcons}>
                                    <Image
                                        source={require("../../assets/images/aquasense.png")}
                                        style={styles.headerLogo}
                                        resizeMode="contain"
                                        tintColor="#FFFFFF"
                                    />
                                    
                                </View>
                            </View>

                            {/* Saudação + frase */}
                            <View style={styles.greetingRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.greetingName, { fontFamily: questrial }]}>Olá, {userName}</Text>
                                    <Text style={[styles.greetingPhrase, { fontFamily: questrial }]}>
                                        Sua participação faz a diferença na{"\n"}proteção da nossa comunidade.
                                    </Text>
                                </View>
                                {/* Card de data/hora */}
                                <View style={styles.dateTimeCard}>
                                    <View style={styles.dateTimeRow}>
                                        <Ionicons name="time-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                                        <Text style={[styles.dateTimeUpdated, { fontFamily: questrial }]}>Atualizado agora</Text>
                                    </View>
                                    <Text style={[styles.dateTimeText, { fontFamily: questrial }]}>
                                        {formatTime(currentDateTime)} • {formatDate(currentDateTime)}
                                    </Text>
                                </View>
                            </View>

                            {/* Card do corpo hídrico monitorado */}
                            {loadingUltimoCorpo ? (
                                <SkeletonCorpoCard />
                            ) : ultimoCorpo ? (
                                <UltimoCorpoHeaderCard
                                    corpo={ultimoCorpo}
                                    resumo={resumoUltimoCorpo}
                                    fontFamily={questrial}
                                    onVerDetalhes={handleVerNoMapa}
                                />
                            ) : (
                                <View style={styles.noCorpoCard}>
                                    <Ionicons name="water-outline" size={20} color="rgba(255,255,255,0.7)" />
                                    <Text style={[styles.noCorpoText, { fontFamily: questrial }]}>
                                        Nenhum corpo hídrico acessado ainda
                                    </Text>
                                </View>
                            )}
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ CONTEÚDO ══ */}
                <ScrollView style={styles.whiteBody} contentContainerStyle={styles.whiteBodyContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>
                        {/* Título da seção */}
                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Visão geral da água</Text>
                    </Animated.View>

                    {isGestor && (
                        <Animated.View style={[styles.managerCardContainer, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
                            <TouchableOpacity
                                style={styles.managerCard}
                                onPress={() => router.push("/(tabs)/home_manager" as any)}
                                activeOpacity={0.75}
                            >
                                <LinearGradient
                                    colors={["#1a8c80", "#0d6b5f"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.managerCardGradient}
                                >
                                    <View style={styles.managerCardContent}>
                                        <View style={styles.managerCardIcon}>
                                            <Ionicons name="clipboard-outline" size={32} color="#FFFFFF" />
                                        </View>
                                        <View style={styles.managerCardText}>
                                            <Text style={[styles.managerCardTitle, { fontFamily: questrial }]}>
                                                Acessar Módulo de Gestão
                                            </Text>
                                            <Text style={[styles.managerCardSubtitle, { fontFamily: questrial }]}>
                                                Gerencie alertas, corpos hídricos e equipes do AquaSense
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    <Animated.View style={[styles.actionsRow, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
                        <TouchableOpacity style={[styles.quickActionCard, styles.observationCard]} onPress={() => router.push("/register_observation" as any)} activeOpacity={0.85}>
                            <View style={[styles.quickActionIcon, { backgroundColor: "#0E8B6F" }]}>
                                <Ionicons name="document-text-outline" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={[styles.quickActionTitle, { fontFamily: questrial }]}>Registrar observação</Text>
                            <Text style={[styles.quickActionSubtitle, { fontFamily: questrial }]}>Registre alterações observadas no ambiente</Text>
                            <Ionicons name="arrow-forward" size={22} color="#0E8B6F" style={styles.quickActionArrow} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.quickActionCard, styles.complaintCard]} onPress={() => router.push("/report_complaint" as any)} activeOpacity={0.85}>
                            <View style={[styles.quickActionIcon, { backgroundColor: "#FF8A00" }]}>
                                <Ionicons name="megaphone-outline" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={[styles.quickActionTitle, { fontFamily: questrial }]}>Fazer denúncia</Text>
                            <Text style={[styles.quickActionSubtitle, { fontFamily: questrial }]}>Reporte problemas ambientais</Text>
                            <Ionicons name="arrow-forward" size={22} color="#FF8A00" style={styles.quickActionArrow} />
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>

                {/* ══ NAVBAR ══ */}
                <SafeAreaView edges={["bottom"]} style={styles.navBarWrapper}>
                    <View style={styles.navBar}>
                        <NavBarItem icon="home" iconOutline="home-outline" label="Home" active={activeTab === "home"} fontFamily={questrial} onPress={() => handleTabPress("home")} />
                        <NavBarItem icon="map"  iconOutline="map-outline"  label="Mapa" active={activeTab === "mapa"} fontFamily={questrial} onPress={() => handleTabPress("mapa")} />
                        <TouchableOpacity style={styles.fabButton} onPress={() => setCorpoHidricoModalVisible(true)} activeOpacity={0.85}>
                            <View style={styles.fabInner}><Ionicons name="add" size={32} color="#FFFFFF" /></View>
                        </TouchableOpacity>
                        <NavBarItem icon="notifications" iconOutline="notifications-outline" label="Alertas" active={activeTab === "alertas"} fontFamily={questrial} onPress={() => handleTabPress("alertas")} />
                        <NavBarItem icon="person"        iconOutline="person-outline"        label="Perfil"  active={activeTab === "perfil"}  fontFamily={questrial} onPress={() => handleTabPress("perfil")} />
                    </View>
                </SafeAreaView>
            </View>

            <CorpoHidricoModal
                visible={corpoHidricoModalVisible}
                fontFamily={questrial}
                onClose={() => setCorpoHidricoModalVisible(false)}
                onRegister={() => { setCorpoHidricoModalVisible(false); router.push("/register_water_body" as any); }}
            />
            <TutorialModal visible={tutorialVisible} fontFamily={questrial} loading={tutorialLoading} onFinish={handleFinishTutorial} />
        </>
    );
}

// ─────────────────────────────────────────────
// CARD DO CORPO HÍDRICO NO HEADER
// ─────────────────────────────────────────────
function UltimoCorpoHeaderCard({ corpo, resumo, fontFamily, onVerDetalhes }: {
    corpo: CorpoHidrico;
    resumo: ResumoObservacoes | null;
    fontFamily?: string;
    onVerDetalhes: () => void;
}) {
    const localizacao = [corpo.municipio, "PE"].filter(Boolean).join(" - ");

    return (
        <View style={styles.corpoHeaderCard}>
            <View style={styles.corpoHeaderCardLeft}>
                <Text style={[styles.corpoHeaderLabel, { fontFamily }]}>CORPO HÍDRICO MONITORADO</Text>
                <View style={styles.corpoHeaderIconName}>
                    <View style={styles.corpoHeaderIconCircle}>
                        <Ionicons name="water-outline" size={20} color={PRIMARY} />
                    </View>
                    <View>
                        <Text style={[styles.corpoHeaderNome, { fontFamily }]} numberOfLines={1}>{corpo.nome}</Text>
                        {localizacao ? (
                            <View style={styles.corpoHeaderLocRow}>
                                <Ionicons name="location-outline" size={11} color={TEXT_MUTED} style={{ marginRight: 2 }} />
                                <Text style={[styles.corpoHeaderLoc, { fontFamily }]}>{localizacao}</Text>
                            </View>
                        ) : null}
                        {resumo && resumo.totalObservacoes > 0 ? (
                            <View style={styles.corpoHeaderQualRow}>
                                <View style={[styles.qualidadeDot, { backgroundColor: resumo.qualidade.color }]} />
                                <Text style={[styles.corpoHeaderQualLabel, { fontFamily, color: resumo.qualidade.color }]}>
                                    {resumo.qualidade.label}
                                </Text>
                                {resumo.qualidade.hint ? (
                                    <Text style={[styles.corpoHeaderQualHint, { fontFamily }]}> · {resumo.qualidade.hint}</Text>
                                ) : null}
                            </View>
                        ) : (
                            <View style={styles.corpoHeaderQualRow}>
                                <View style={[styles.qualidadeDot, { backgroundColor: "#FFA000" }]} />
                                <Text style={[styles.corpoHeaderQualLabel, { fontFamily, color: "#FFA000" }]}>Moderada</Text>
                                <Text style={[styles.corpoHeaderQualHint, { fontFamily }]}> · Atenção ao contato com a água</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
            <TouchableOpacity style={styles.verDetalhesBtn} onPress={onVerDetalhes} activeOpacity={0.8}>
                <Text style={[styles.verDetalhesBtnText, { fontFamily }]}>Ver detalhes</Text>
                <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
            </TouchableOpacity>
        </View>
    );
}

// ─────────────────────────────────────────────
// SKELETON DO CARD NO HEADER
// ─────────────────────────────────────────────
function SkeletonCorpoCard() {
    return (
        <View style={[styles.corpoHeaderCard, { gap: 10 }]}>
            <View style={[styles.skeletonLine, { width: "55%", height: 11, backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <View style={[styles.skeletonLine, { width: "70%", height: 18, backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <View style={[styles.skeletonLine, { width: "45%", height: 11, backgroundColor: "rgba(255,255,255,0.15)" }]} />
        </View>
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
    visible: boolean; fontFamily?: string; loading: boolean; onFinish: () => void;
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
                    <Text style={[styles.modalTitle, { fontFamily, marginBottom: 4 }]}>Bem-vindo ao AquaSense!</Text>
                    <Text style={[styles.modalDescription, { fontFamily, marginBottom: 12 }]}>Veja rapidamente o que você pode fazer:</Text>
                    <View style={styles.modalDivider} />
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                        {steps.map((s) => (
                            <View key={s.title} style={styles.tutorialRow}>
                                <Ionicons name={s.icon} size={20} color={PRIMARY} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.tutorialStepTitle, { fontFamily }]}>{s.title}</Text>
                                    <Text style={[styles.tutorialStepDesc, { fontFamily }]}>{s.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={[styles.modalButton, { marginTop: 16 }]} onPress={onFinish} activeOpacity={0.85} disabled={loading}>
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
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#FFFFFF" },

    // Header novo
    headerGradient: { paddingBottom: 20 },
    headerSafeArea: { paddingHorizontal: 20, paddingTop: 6 },
    headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    locationText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600", letterSpacing: 0.2 },
    userTypeText: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2, marginLeft: 20 },
    headerIcons: { flexDirection: "row", alignItems: "center", gap: 14 },
    headerLogo: { width: 40, height: 40 },
    notifBadge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" },
    notifBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "700" },

    greetingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
    greetingName: { fontSize: 26, color: "#FFFFFF", fontWeight: "700", marginBottom: 6 },
    greetingPhrase: { fontSize: 13, color: "rgba(255,255,255,0.80)", lineHeight: 20 },

    dateTimeCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 12, minWidth: 140, alignItems: "flex-start" },
    dateTimeRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    dateTimeUpdated: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
    dateTimeText: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },

    // Card do corpo hídrico no header
    corpoHeaderCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    corpoHeaderCardLeft: { flex: 1, marginRight: 10 },
    corpoHeaderLabel: { fontSize: 10, fontWeight: "700", color: PRIMARY, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
    corpoHeaderIconName: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    corpoHeaderIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,77,72,0.10)", alignItems: "center", justifyContent: "center", marginTop: 2 },
    corpoHeaderNome: { fontSize: 17, fontWeight: "700", color: PRIMARY, marginBottom: 3 },
    corpoHeaderLocRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
    corpoHeaderLoc: { fontSize: 11, color: TEXT_MUTED },
    corpoHeaderQualRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
    corpoHeaderQualLabel: { fontSize: 13, fontWeight: "700" },
    corpoHeaderQualHint: { fontSize: 11, color: TEXT_MUTED },

    verDetalhesBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F2F7F6", borderRadius: 50, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
    verDetalhesBtnText: { fontSize: 12, color: PRIMARY, fontWeight: "700" },

    noCorpoCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
    noCorpoText: { fontSize: 13, color: "rgba(255,255,255,0.75)" },

    // Conteúdo
    sectionTitle: { fontSize: 18, color: PRIMARY, fontWeight: "700", letterSpacing: 0.2, marginBottom: 16 },
    whiteBody: { flex: 1, backgroundColor: "#FFFFFF" },
    whiteBodyContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 },

    cardDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginVertical: 12, width: "100%" },

    // Skeleton
    skeletonLine: { backgroundColor: "#E8F0EF", borderRadius: 6, alignSelf: "flex-start" },

    // Actions
    actionsRow: { flexDirection: "row", gap: 14 },

    // Manager card
    managerCardContainer: { marginBottom: 18 },
    managerCard: { borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
    managerCardGradient: { paddingVertical: 20, paddingHorizontal: 16 },
    managerCardContent: { flexDirection: "row", alignItems: "center", gap: 14 },
    managerCardIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    managerCardText: { flex: 1 },
    managerCardTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginBottom: 3 },
    managerCardSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.88)" },

    // Navbar
    navBarWrapper: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 12 },
    navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 4 : 10, paddingHorizontal: 8 },
    navItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
    navLabel: { fontSize: 10, marginTop: 3, letterSpacing: 0.1 },
    fabButton: { width: 56, height: 56, borderRadius: 28, marginBottom: 16, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 10, elevation: 8 },
    fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },

    // Modais
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.50)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    modalCard: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 28, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
    modalIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(63,243,231,0.15)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontSize: 17, color: PRIMARY, textAlign: "center", marginBottom: 14, fontWeight: "600" },
    modalDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 16 },
    modalDescription: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 22, marginBottom: 20 },
    modalButton: { backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: "center" },
    modalButtonText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600", letterSpacing: 0.3 },
    modalCancelButton: { paddingVertical: 12, alignItems: "center" },
    modalCancelText: { fontSize: 13, color: "#888", textDecorationLine: "underline" },
    tutorialRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    tutorialStepTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 2 },
    tutorialStepDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

    quickActionCard: { flex: 1, borderRadius: 20, padding: 20, minHeight: 190, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
    observationCard: { backgroundColor: "#F2F8F7" },
    complaintCard: { backgroundColor: "#FBF6F1" },
    quickActionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    quickActionTitle: { fontSize: 22, color: PRIMARY, fontWeight: "700", lineHeight: 30, marginBottom: 10 },
    quickActionSubtitle: { fontSize: 16, color: TEXT_MUTED, lineHeight: 24 },
    quickActionArrow: { position: "absolute", right: 20, bottom: 20 },

    qualidadeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
});