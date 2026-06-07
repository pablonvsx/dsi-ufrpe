import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Platform,
    Animated,
    Modal,
    ActivityIndicator,
    Dimensions,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
} from "firebase/firestore";
import { db } from "@/config/firebase"; // ajuste o caminho conforme seu projeto

import { useAuth } from "@/contexts/auth-context";
import { markTutorialColaboradorAsSeen } from "@/services/firestore/users";

const PRIMARY = "#004d48";
const TEAL_MED = "#0d6e52";
const TEXT_MUTED = "#6b7a7a";
const ORANGE = "#e07b1e";
const BLUE_ACTION = "#2563c7";

const { width: SCREEN_W } = Dimensions.get("window");

type TabKey = "home" | "mapa" | "alertas" | "perfil";

const TUTORIAL_STEPS = [
    {
        icon: "home-outline" as const,
        iconBg: TEAL_MED,
        title: "Bem-vindo, Colaborador!",
        desc: "Esta é a sua Home. Aqui você acompanha o corpo hídrico monitorado, suas atividades e os números da sua comunidade.",
    },
    {
        icon: "flask-outline" as const,
        iconBg: TEAL_MED,
        title: "Registrar contribuição",
        desc: "Registre medições e observações ambientais dos corpos hídricos da sua região. Cada dado conta para a proteção da água.",
    },
    {
        icon: "megaphone-outline" as const,
        iconBg: ORANGE,
        title: "Fazer denúncia",
        desc: "Identificou um problema ambiental? Reporte aqui. Suas denúncias são analisadas pelos gestores e técnicos.",
    },
    {
        icon: "water-outline" as const,
        iconBg: BLUE_ACTION,
        title: "Sugerir novo corpo hídrico",
        desc: "Conhece um rio, lago ou açude que ainda não está no mapa? Sugira o cadastro e ajude a ampliar o monitoramento.",
    },
    {
        icon: "map-outline" as const,
        iconBg: "#7c3aed",
        title: "Mapa",
        desc: "Visualize todos os corpos hídricos monitorados no mapa interativo. Filtre por localização e status de qualidade.",
    },
    {
        icon: "people-outline" as const,
        iconBg: "#7c3aed",
        title: "Painel Comunitário",
        desc: "Acompanhe os dados da comunidade, contribuições, denúncias, alertas e corpos hídricos monitorados na sua região.",
    },
    {
        icon: "person-outline" as const,
        iconBg: "#555",
        title: "Perfil",
        desc: "Gerencie sua conta, acompanhe seu histórico de contribuições e configure suas preferências.",
    },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CorpoHidrico {
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
    status?: string;
}

interface Atividade {
    id: string;
    tipo: "medicao" | "observacao" | "denuncia" | "contribuicao";
    titulo: string;
    detalhe: string;
    data: Date;
    status: "validada" | "pendente" | "analise";
}

interface NumerosData {
    contribuicoes: number;
    denuncias: number;
    corposHidricos: number;
    alertas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarData(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ontemInicio = new Date(hojeInicio.getTime() - 86400000);

    if (date >= hojeInicio) {
        return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date >= ontemInicio) {
        return `Ontem, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
        return `${date.toLocaleDateString("pt-BR")} • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
}

function tipoParaIcone(tipo: Atividade["tipo"]): {
    iconName: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
} {
    switch (tipo) {
        case "medicao":
            return { iconName: "flask-outline", iconBg: "#e6f5ef", iconColor: TEAL_MED };
        case "observacao":
            return { iconName: "leaf-outline", iconBg: "#f0faf0", iconColor: "#4a9e5e" };
        case "denuncia":
            return { iconName: "megaphone-outline", iconBg: "#fff0e6", iconColor: ORANGE };
        case "contribuicao":
        default:
            return { iconName: "water-outline", iconBg: "#e8f0ff", iconColor: BLUE_ACTION };
    }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function HomeColaborador() {
    const router = useRouter();
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
    const { userProfile } = useAuth();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [locationText, setLocationText] = useState("Carregando...");
    const [activeTab, setActiveTab] = useState<TabKey>("home");
    const [now, setNow] = useState(new Date());
    const [tutorialVisible, setTutorialVisible] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [tutorialLoading, setTutorialLoading] = useState(false);

    // ── Estado de dados reais ───────────────────────────────────────────────
    const [corpoHidrico, setCorpoHidrico] = useState<CorpoHidrico | null>(null);
    const [corpoHidricoLoading, setCorpoHidricoLoading] = useState(true);
    const [atividades, setAtividades] = useState<Atividade[]>([]);
    const [atividadesLoading, setAtividadesLoading] = useState(true);
    const [numeros, setNumeros] = useState<NumerosData>({ contribuicoes: 0, denuncias: 0, corposHidricos: 0, alertas: 0 });
    const [numerosLoading, setNumerosLoading] = useState(true);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(24)).current;
    const stepFade = useRef(new Animated.Value(1)).current;
    const stepSlide = useRef(new Animated.Value(0)).current;

    // ── Tutorial ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (tutorial === "1") {
            const timer = setTimeout(() => setTutorialVisible(true), 600);
            return () => clearTimeout(timer);
        }
    }, [tutorial]);

    // ── Animações de entrada ────────────────────────────────────────────────
    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(cardFade, { toValue: 1, duration: 450, useNativeDriver: true }),
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
                    const city = place.city ?? place.subregion ?? "Cidade";
                    const state = place.region ?? "";
                    setLocationText(`${city} - ${state}`);
                }
            } catch { setLocationText("Localização indisponível"); }
        })();

        const interval = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(interval);
    }, []);

    // ── Busca de dados reais ────────────────────────────────────────────────
    useEffect(() => {
        if (!userProfile?.uid) return;

        // 1) Corpo hídrico acessado
        const fetchCorpoHidrico = async () => {
            setCorpoHidricoLoading(true);
            try {
                const ultimoId = userProfile?.ultimoCorpoHidricoAcessadoId as string | undefined;
                if (!ultimoId) { setCorpoHidrico(null); return; }

                const snap = await getDoc(doc(db, "corposHidricos", ultimoId));
                if (snap.exists()) {
                    const d = snap.data();
                    setCorpoHidrico({
                        id: snap.id,
                        nome: d.nome ?? "Corpo hídrico",
                        cidade: d.cidade ?? d.municipio ?? "",
                        estado: d.estado ?? d.uf ?? "",
                        status: d.status ?? d.qualidade ?? "",
                    });
                } else {
                    setCorpoHidrico(null);
                }
            } catch { setCorpoHidrico(null); }
            finally { setCorpoHidricoLoading(false); }
        };

        // 2) Atividades recentes do usuário
        const fetchAtividades = async () => {
            setAtividadesLoading(true);
            try {
                const uid = userProfile.uid;
                const results: Atividade[] = [];

                // Medições
                const medicoesSnap = await getDocs(
                    query(
                        collection(db, "medicoes"),
                        where("uid", "==", uid),
                        orderBy("criadoEm", "desc"),
                        limit(3)
                    )
                );
                medicoesSnap.forEach((d) => {
                    const data = d.data();
                    results.push({
                        id: d.id,
                        tipo: "medicao",
                        titulo: `Medição – ${data.corpoHidricoNome ?? "Corpo hídrico"}`,
                        detalhe: data.resumo ?? `pH: ${data.ph ?? "-"} • Turbidez: ${data.turbidez ?? "-"}`,
                        data: data.criadoEm?.toDate?.() ?? new Date(),
                        status: data.status ?? "pendente",
                    });
                });

                // Denúncias
                const denunciasSnap = await getDocs(
                    query(
                        collection(db, "denuncias"),
                        where("uid", "==", uid),
                        orderBy("criadoEm", "desc"),
                        limit(3)
                    )
                );
                denunciasSnap.forEach((d) => {
                    const data = d.data();
                    results.push({
                        id: d.id,
                        tipo: "denuncia",
                        titulo: `Denúncia – ${data.categoria ?? "Problema ambiental"}`,
                        detalhe: data.descricao ?? `${data.corpoHidricoNome ?? ""}`,
                        data: data.criadoEm?.toDate?.() ?? new Date(),
                        status: data.status ?? "analise",
                    });
                });

                // Observações / contribuições
                const observacoesSnap = await getDocs(
                    query(
                        collection(db, "observacoes"),
                        where("uid", "==", uid),
                        orderBy("criadoEm", "desc"),
                        limit(3)
                    )
                );
                observacoesSnap.forEach((d) => {
                    const data = d.data();
                    results.push({
                        id: d.id,
                        tipo: "observacao",
                        titulo: `Observação – ${data.tipo ?? "Ambiental"}`,
                        detalhe: `${data.corpoHidricoNome ?? ""} • ${data.descricao ?? ""}`,
                        data: data.criadoEm?.toDate?.() ?? new Date(),
                        status: data.status ?? "pendente",
                    });
                });

                results.sort((a, b) => b.data.getTime() - a.data.getTime());
                setAtividades(results.slice(0, 3));
            } catch { setAtividades([]); }
            finally { setAtividadesLoading(false); }
        };

        // 3) Números da comunidade
        const fetchNumeros = async () => {
            setNumerosLoading(true);
            try {
                const uid = userProfile.uid;
                const cidade = (userProfile as any)?.cidade ?? "";

                // Contribuições do usuário
                const contribSnap = await getDocs(
                    query(collection(db, "medicoes"), where("uid", "==", uid))
                );
                const obsSnap = await getDocs(
                    query(collection(db, "observacoes"), where("uid", "==", uid))
                );
                const totalContrib = contribSnap.size + obsSnap.size;

                // Denúncias do usuário
                const denSnap = await getDocs(
                    query(collection(db, "denuncias"), where("uid", "==", uid))
                );

                // Corpos hídricos acompanhados pelo usuário
                const corposSnap = await getDocs(
                    query(collection(db, "corposHidricos"), where("colaboradoresIds", "array-contains", uid))
                );

                // Alertas na região (cidade do usuário ou global)
                let alertasSnap;
                if (cidade) {
                    alertasSnap = await getDocs(
                        query(collection(db, "alertas"), where("cidade", "==", cidade))
                    );
                } else {
                    alertasSnap = await getDocs(collection(db, "alertas"));
                }

                setNumeros({
                    contribuicoes: totalContrib,
                    denuncias: denSnap.size,
                    corposHidricos: corposSnap.size,
                    alertas: alertasSnap.size,
                });
            } catch { setNumeros({ contribuicoes: 0, denuncias: 0, corposHidricos: 0, alertas: 0 }); }
            finally { setNumerosLoading(false); }
        };

        fetchCorpoHidrico();
        fetchAtividades();
        fetchNumeros();
    }, [userProfile?.uid]);

    // ── Handlers do tutorial ────────────────────────────────────────────────
    function animateStep(next: number) {
        Animated.parallel([
            Animated.timing(stepFade, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(stepSlide, { toValue: -20, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setTutorialStep(next);
            stepSlide.setValue(20);
            Animated.parallel([
                Animated.timing(stepFade, { toValue: 1, duration: 260, useNativeDriver: true }),
                Animated.timing(stepSlide, { toValue: 0, duration: 260, useNativeDriver: true }),
            ]).start();
        });
    }

    function handleTutorialNext() {
        if (tutorialStep < TUTORIAL_STEPS.length - 1) animateStep(tutorialStep + 1);
    }
    function handleTutorialBack() {
        if (tutorialStep > 0) animateStep(tutorialStep - 1);
    }

    async function handleFinishTutorial() {
        const uid = userProfile?.uid;
        if (!uid) { setTutorialVisible(false); return; }
        setTutorialLoading(true);
        try { await markTutorialColaboradorAsSeen(uid); } catch {}
        finally {
            setTutorialLoading(false);
            setTutorialVisible(false);
            setTutorialStep(0);
        }
    }

    function handleTabPress(tab: TabKey) {
        setActiveTab(tab);
        switch (tab) {
            case "home": router.replace("/home_collaborator_update" as any); break;
            case "mapa": router.push("/map" as any); break;
            case "alertas": router.push("/alerts" as any); break;
            case "perfil":
                console.log("navegando para profile_collaborator");
                router.push("/(tabs)/profile_collaborator" as any);
                break;
        }
    }

    const userName = userProfile?.nome ?? "Colaborador";
    const firstName = userName.split(" ")[0];
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("pt-BR");
    const isLastStep = tutorialStep === TUTORIAL_STEPS.length - 1;
    const step = TUTORIAL_STEPS[tutorialStep];

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* ── HEADER ─────────────────────────────────────────────── */}
                <LinearGradient
                    colors={["#0d5c47", "#0d4a3e", "#0a3d32"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
                        <Animated.View
                            style={[styles.headerTopRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
                        >
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={13} color="#7ecfb3" />
                                <Text style={[styles.locationCity, { fontFamily: questrial }]}>
                                    {locationText}
                                </Text>
                            </View>
                            <View style={styles.headerIcons}>
                                <View style={styles.logoCircle}>
                                    <Image
                                        source={require("../../assets/images/aquasense.png")}
                                        style={styles.logoHeader}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View style={styles.bellWrap}>
                                    <View style={styles.iconCircle}>
                                        <Ionicons name="notifications-outline" size={19} color="#e8f5f0"
                                        onPress={() => router.push("/alerts" as any)}/>
                                    </View>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>3</Text>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View
                            style={[styles.headerBottomRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
                        >
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={[styles.colaboradorLabel, { fontFamily: questrial }]}>Colaborador</Text>
                                <Text style={[styles.greetingName, { fontFamily: questrial }]}>Olá, {firstName}</Text>
                                <Text style={[styles.greetingSubtitle, { fontFamily: questrial }]}>
                                    Sua participação faz a diferença na proteção da nossa comunidade.
                                </Text>
                            </View>
                            <View style={styles.updatedCard}>
                                <View style={styles.updatedCardRow}>
                                    <Ionicons name="time-outline" size={11} color="#a8dac8" />
                                    <Text style={[styles.updatedLabel, { fontFamily: questrial }]}>Atualizado agora</Text>
                                </View>
                                <Text style={[styles.updatedTime, { fontFamily: questrial }]}>
                                    {timeStr} • {dateStr}
                                </Text>
                            </View>
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ── BODY ───────────────────────────────────────────────── */}
                <ScrollView
                    style={styles.scrollBody}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>

                        {/* ── CORPO HÍDRICO ──────────────────────────────── */}
                        {corpoHidricoLoading ? (
                            <View style={[styles.corpoCard, styles.centerContent]}>
                                <ActivityIndicator color={TEAL_MED} size="small" />
                            </View>
                        ) : corpoHidrico ? (
                            <CorpoHidricoCard
                                fontFamily={questrial}
                                corpoHidrico={corpoHidrico}
                                onVerDetalhes={() => router.push("/map" as any)}
                            />
                        ) : (
                            <CorpoHidricoEmpty
                                fontFamily={questrial}
                                onAbrirMapa={() => router.push("/map" as any)}
                            />
                        )}

                        {/* ── AÇÕES RÁPIDAS ──────────────────────────────── */}
                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Ações rápidas</Text>

                        <View style={styles.acoesRow}>
                            <AcaoCard
                                iconName="flask-outline"
                                iconBg={TEAL_MED}
                                cardBg="#f0faf5"
                                borderColor="#d4ede0"
                                arrowColor={TEAL_MED}
                                title="Registrar contribuição"
                                subtitle="Medição ou observação ambiental"
                                fontFamily={questrial}
                                onPress={() => router.push("/register_observation" as any)}
                            />
                            <AcaoCard
                                iconName="megaphone-outline"
                                iconBg={ORANGE}
                                cardBg="#fff8f0"
                                borderColor="#ede0cc"
                                arrowColor={ORANGE}
                                title="Fazer denúncia"
                                subtitle="Reporte problemas ambientais"
                                fontFamily={questrial}
                                onPress={() => router.push("/report_complaint" as any)}
                            />
                            <AcaoCard
                                iconName="book-outline"
                                iconBg={BLUE_ACTION}
                                cardBg="#f0f6ff"
                                borderColor="#ccdcf0"
                                arrowColor={BLUE_ACTION}
                                title="Central de Aprendizagem"
                                subtitle="Aprenda a realizar medições simples"
                                fontFamily={questrial}
                                onPress={() => router.push("/learning_center" as any)}
                            />
                        </View>

                        {/* ── ATIVIDADES RECENTES ────────────────────────── */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { fontFamily: questrial, marginBottom: 0 }]}>
                                Minhas Contribuições
                            </Text>
                            <TouchableOpacity onPress={() => router.push("/my_contributions" as any)} activeOpacity={0.7}>
                                <View style={styles.verTodasRow}>
                                    <Text style={[styles.verTodasText, { fontFamily: questrial }]}>Ver todas</Text>
                                    <Ionicons name="chevron-forward" size={13} color={TEAL_MED} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {atividadesLoading ? (
                            <View style={[styles.atividadesCard, styles.centerContent, { paddingVertical: 28 }]}>
                                <ActivityIndicator color={TEAL_MED} size="small" />
                            </View>
                        ) : atividades.length === 0 ? (
                            <View style={styles.atividadesCard}>
                                <EmptyState
                                    iconName="time-outline"
                                    titulo="Nenhuma atividade registrada ainda"
                                    descricao="Suas medições, observações e denúncias aparecerão aqui."
                                    fontFamily={questrial}
                                />
                            </View>
                        ) : (
                            <View style={styles.atividadesCard}>
                                {atividades.map((ativ, idx) => {
                                    const { iconName, iconBg, iconColor } = tipoParaIcone(ativ.tipo);
                                    return (
                                        <AtividadeItem
                                            key={ativ.id}
                                            iconName={iconName}
                                            iconBg={iconBg}
                                            iconColor={iconColor}
                                            titulo={ativ.titulo}
                                            detalhe={ativ.detalhe}
                                            data={formatarData(ativ.data)}
                                            status={ativ.status}
                                            fontFamily={questrial}
                                            isLast={idx === atividades.length - 1}
                                        />
                                    );
                                })}
                            </View>
                        )}

                        {/* ── COMUNIDADE EM NÚMEROS ──────────────────────── */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { fontFamily: questrial, marginBottom: 0 }]}>
                                Sua comunidade 
                            </Text>
                            <TouchableOpacity onPress={() => router.push("/community_panel" as any)} activeOpacity={0.7}>
                                <View style={styles.verTodasRow}>
                                    <Text style={[styles.verTodasText, { fontFamily: questrial }]}>Ver painel completo</Text>
                                    <Ionicons name="chevron-forward" size={13} color={TEAL_MED} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {numerosLoading ? (
                            <View style={[styles.numerosGrid, { justifyContent: "center", paddingVertical: 20 }]}>
                                <ActivityIndicator color={TEAL_MED} size="small" />
                            </View>
                        ) : (
                            <View style={styles.numerosGrid}>
                                <NumeroCard iconName="water-outline" iconColor={TEAL_MED} bg="#f5faf7" border="#d4ede0" valor={numeros.contribuicoes} label="Contribuições" sub="Este mês" fontFamily={questrial} />
                                <NumeroCard iconName="warning-outline" iconColor={ORANGE} bg="#fff8f0" border="#ede0cc" valor={numeros.denuncias} label="Denúncias" sub="Em andamento" fontFamily={questrial} />
                                <NumeroCard iconName="bar-chart-outline" iconColor={BLUE_ACTION} bg="#f0f6ff" border="#ccdcf0" valor={numeros.corposHidricos} label="Corpos hídricos" sub="Acompanhados" fontFamily={questrial} />
                                <NumeroCard iconName="people-outline" iconColor="#7c3aed" bg="#f5f0fa" border="#ddd0ed" valor={numeros.alertas} label="Alertas na região" sub="Ver todos" fontFamily={questrial} />
                            </View>
                        )}

                        {/* ── ENGAJAMENTO ────────────────────────────────── */}
                        <View style={styles.engajamentoCard}>
                            <View style={styles.engajamentoIconCircle}>
                                <Ionicons name="people" size={22} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.engajamentoTitle, { fontFamily: questrial }]}>
                                    Juntos por uma comunidade melhor!
                                </Text>
                                <Text style={[styles.engajamentoBody, { fontFamily: questrial }]}>
                                    Continue contribuindo com informações. Pequenas ações geram grandes mudanças.
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                </ScrollView>

                {/* ── NAVBAR ─────────────────────────────────────────────── */}
                <SafeAreaView edges={["bottom"]} style={styles.navWrapper}>
                    <View style={styles.navBar}>
                        <NavItem icon="home" iconOutline="home-outline" label="Home" active={activeTab === "home"} fontFamily={questrial} onPress={() => handleTabPress("home")} />
                        <NavItem icon="map" iconOutline="map-outline" label="Mapa" active={activeTab === "mapa"} fontFamily={questrial} onPress={() => handleTabPress("mapa")} />
                        <View style={styles.fabSpacer}>
                            <TouchableOpacity style={styles.fab} onPress={() => router.push("/manage_water_bodies_collaborator" as any)} activeOpacity={0.85}>
                                <View style={styles.fabInner}>
                                    <Ionicons name="add" size={32} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>
                        <NavItem icon="notifications" iconOutline="notifications-outline" label="Alertas" active={activeTab === "alertas"} fontFamily={questrial} onPress={() => handleTabPress("alertas")} />
                        <NavItem icon="person" iconOutline="person-outline" label="Perfil" active={activeTab === "perfil"} fontFamily={questrial} onPress={() => handleTabPress("perfil")} />
                    </View>
                </SafeAreaView>
            </View>

            {/* ── TUTORIAL ─────────────────────────────────────────────────── */}
            <Modal visible={tutorialVisible} transparent animationType="fade" onRequestClose={handleFinishTutorial}>
                <View style={styles.tutorialOverlay}>
                    <View style={styles.tutorialCard}>
                        <View style={styles.tutorialCardHeader}>
                            <LinearGradient
                                colors={["#0d5c47", "#0d4a3e"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.tutorialHeaderGrad}
                            >
                                <Text style={[styles.tutorialHeaderTitle, { fontFamily: questrial }]}>Guia do Colaborador</Text>
                                <Text style={[styles.tutorialHeaderSub, { fontFamily: questrial }]}>AquaSense</Text>
                            </LinearGradient>
                        </View>

                        <View style={styles.tutorialDotsRow}>
                            {TUTORIAL_STEPS.map((_, i) => (
                                <View key={i} style={[styles.tutorialDot, i === tutorialStep && styles.tutorialDotActive]} />
                            ))}
                        </View>

                        <Animated.View
                            style={[styles.tutorialStepBody, { opacity: stepFade, transform: [{ translateY: stepSlide }] }]}
                        >
                            <View style={[styles.tutorialStepIconCircle, { backgroundColor: step.iconBg }]}>
                                <Ionicons name={step.icon} size={32} color="#fff" />
                            </View>
                            <Text style={[styles.tutorialStepTitle, { fontFamily: questrial }]}>{step.title}</Text>
                            <Text style={[styles.tutorialStepDesc, { fontFamily: questrial }]}>{step.desc}</Text>
                        </Animated.View>

                        <Text style={[styles.tutorialCounter, { fontFamily: questrial }]}>
                            {tutorialStep + 1} de {TUTORIAL_STEPS.length}
                        </Text>

                        <View style={styles.tutorialBtnsRow}>
                            {tutorialStep > 0 ? (
                                <TouchableOpacity style={styles.tutorialBtnBack} onPress={handleTutorialBack} activeOpacity={0.7}>
                                    <Ionicons name="chevron-back" size={16} color={TEAL_MED} style={{ marginRight: 4 }} />
                                    <Text style={[styles.tutorialBtnBackText, { fontFamily: questrial }]}>Voltar</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ flex: 1 }} />
                            )}

                            {isLastStep ? (
                                <TouchableOpacity style={styles.tutorialBtnFinish} onPress={handleFinishTutorial} activeOpacity={0.85} disabled={tutorialLoading}>
                                    {tutorialLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Text style={[styles.tutorialBtnFinishText, { fontFamily: questrial }]}>Começar a usar</Text>
                                            <Ionicons name="checkmark" size={16} color="#fff" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.tutorialBtnNext} onPress={handleTutorialNext} activeOpacity={0.85}>
                                    <Text style={[styles.tutorialBtnNextText, { fontFamily: questrial }]}>Próximo</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {!isLastStep && (
                            <TouchableOpacity style={styles.tutorialSkipBtn} onPress={handleFinishTutorial} activeOpacity={0.7}>
                                <Text style={[styles.tutorialSkipText, { fontFamily: questrial }]}>Pular tutorial</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

// ─── CorpoHidricoCard (com dados reais) ───────────────────────────────────────

function statusLabel(status?: string): { label: string; color: string; dotColor: string; hint: string } {
    const s = (status ?? "").toLowerCase();
    if (s.includes("boa") || s.includes("ótima") || s.includes("excelente")) {
        return { label: "Boa", color: "#0d6e52", dotColor: "#34c77a", hint: "Água em boas condições" };
    }
    if (s.includes("ruim") || s.includes("péssima") || s.includes("crítica")) {
        return { label: "Crítica", color: "#c0392b", dotColor: "#e74c3c", hint: "Evite contato com a água" };
    }
    return { label: "Moderada", color: "#c47a00", dotColor: "#f5a623", hint: "Atenção ao contato com a água" };
}

function CorpoHidricoCard({
    fontFamily,
    corpoHidrico,
    onVerDetalhes,
}: {
    fontFamily?: string;
    corpoHidrico: CorpoHidrico;
    onVerDetalhes: () => void;
}) {
    const st = statusLabel(corpoHidrico.status);
    const locacao = [corpoHidrico.cidade, corpoHidrico.estado].filter(Boolean).join(" - ");

    return (
        <View style={styles.corpoCard}>
            <View style={styles.corpoCardContent}>
                <View style={{ flex: 1 }}>
                    <View style={styles.corpoLabelRow}>
                        <View style={styles.corpoIconCircle}>
                            <Ionicons name="water" size={16} color={TEAL_MED} />
                        </View>
                        <Text style={[styles.corpoLabelText, { fontFamily }]}>CORPO HÍDRICO MONITORADO</Text>
                    </View>

                    <Text style={[styles.corpoNome, { fontFamily }]}>{corpoHidrico.nome}</Text>

                    {locacao ? (
                        <View style={styles.corpoLocRow}>
                            <Ionicons name="location-outline" size={11} color={TEXT_MUTED} />
                            <Text style={[styles.corpoLoc, { fontFamily }]}>{locacao}</Text>
                        </View>
                    ) : null}

                    <View style={styles.corpoStatusRow}>
                        <View style={[styles.corpoStatusDot, { backgroundColor: st.dotColor }]} />
                        <Text style={[styles.corpoStatusLabel, { fontFamily, color: st.color }]}>{st.label}</Text>
                        <Text style={[styles.corpoStatusHint, { fontFamily }]}> · {st.hint}</Text>
                    </View>

                    <TouchableOpacity style={styles.verDetalhesBtn} onPress={onVerDetalhes} activeOpacity={0.8}>
                        <Text style={[styles.verDetalhesBtnText, { fontFamily }]}>Ver detalhes</Text>
                        <Ionicons name="chevron-forward" size={13} color={TEAL_MED} />
                    </TouchableOpacity>
                </View>

                <View style={styles.corpoIlustracao}>
                    <LinearGradient colors={["#b8dfc4", "#a8d5b8"]} style={styles.corpoIlustracaoGrad}>
                        <Ionicons name="water" size={36} color="#3a9e6e" style={{ opacity: 0.7 }} />
                    </LinearGradient>
                </View>
            </View>
        </View>
    );
}

// ─── CorpoHidricoEmpty ────────────────────────────────────────────────────────

function CorpoHidricoEmpty({
    fontFamily,
    onAbrirMapa,
}: {
    fontFamily?: string;
    onAbrirMapa: () => void;
}) {
    return (
        <View style={styles.corpoCard}>
            <View style={styles.corpoCardContent}>
                <View style={{ flex: 1 }}>
                    <View style={styles.corpoLabelRow}>
                        <View style={styles.corpoIconCircle}>
                            <Ionicons name="water" size={16} color={TEAL_MED} />
                        </View>
                        <Text style={[styles.corpoLabelText, { fontFamily }]}>CORPO HÍDRICO MONITORADO</Text>
                    </View>

                    <Text style={[styles.corpoNome, { fontFamily, color: TEXT_MUTED, fontSize: 16 }]}>
                        Nenhum corpo hídrico acessado ainda
                    </Text>

                    <Text style={[styles.corpoStatusHint, { fontFamily, marginBottom: 12, lineHeight: 18 }]}>
                        Explore o mapa para acompanhar um corpo hídrico da sua região.
                    </Text>

                    <TouchableOpacity style={styles.verDetalhesBtn} onPress={onAbrirMapa} activeOpacity={0.8}>
                        <Ionicons name="map-outline" size={13} color={TEAL_MED} style={{ marginRight: 4 }} />
                        <Text style={[styles.verDetalhesBtnText, { fontFamily }]}>Abrir mapa</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.corpoIlustracao}>
                    <LinearGradient colors={["#e0eee8", "#d4e8e0"]} style={styles.corpoIlustracaoGrad}>
                        <Ionicons name="map-outline" size={32} color="#7aada0" style={{ opacity: 0.6 }} />
                    </LinearGradient>
                </View>
            </View>
        </View>
    );
}

// ─── AcaoCard ─────────────────────────────────────────────────────────────────

function AcaoCard({
    iconName,
    iconBg,
    cardBg,
    borderColor,
    arrowColor,
    title,
    subtitle,
    fontFamily,
    onPress,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    cardBg: string;
    borderColor: string;
    arrowColor: string;
    title: string;
    subtitle: string;
    fontFamily?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.acaoCard, { backgroundColor: cardBg, borderColor }]}
            onPress={onPress}
            activeOpacity={0.82}
        >
            <View style={[styles.acaoIconCircle, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={20} color="#fff" />
            </View>
            <Text style={[styles.acaoTitle, { fontFamily }]}>{title}</Text>
            <Text style={[styles.acaoSubtitle, { fontFamily }]}>{subtitle}</Text>
            <View style={styles.acaoArrowRow}>
                <Ionicons name="arrow-forward" size={14} color={arrowColor} />
            </View>
        </TouchableOpacity>
    );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
    iconName,
    titulo,
    descricao,
    fontFamily,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    titulo: string;
    descricao: string;
    fontFamily?: string;
}) {
    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
                <Ionicons name={iconName} size={26} color={TEXT_MUTED} />
            </View>
            <Text style={[styles.emptyTitulo, { fontFamily }]}>{titulo}</Text>
            <Text style={[styles.emptyDescricao, { fontFamily }]}>{descricao}</Text>
        </View>
    );
}

// ─── AtividadeItem ────────────────────────────────────────────────────────────

type StatusType = "validada" | "pendente" | "analise";

const STATUS_CONFIG: Record<StatusType, { label: string; bg: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    validada: { label: "Validada", bg: "#e6f5ef", color: "#0d6e52", icon: "checkmark-circle-outline" },
    pendente: { label: "Pendente", bg: "#fff8e6", color: "#b87d00", icon: "time-outline" },
    analise: { label: "Em análise", bg: "#fff0f0", color: "#c0392b", icon: "ellipse" },
};

function AtividadeItem({
    iconName,
    iconBg,
    iconColor,
    titulo,
    detalhe,
    data,
    status,
    fontFamily,
    isLast,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    titulo: string;
    detalhe: string;
    data: string;
    status: StatusType;
    fontFamily?: string;
    isLast: boolean;
}) {
    const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
    return (
        <View style={[styles.atividadeItem, !isLast && styles.atividadeItemBorder]}>
            <View style={[styles.atividadeIconBox, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={17} color={iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.atividadeTitulo, { fontFamily }]} numberOfLines={1}>{titulo}</Text>
                <Text style={[styles.atividadeDetalhe, { fontFamily }]} numberOfLines={1}>{detalhe}</Text>
                <Text style={[styles.atividadeData, { fontFamily }]}>{data}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={10} color={s.color} style={{ marginRight: 3 }} />
                    <Text style={[styles.statusPillText, { fontFamily, color: s.color }]}>{s.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#ccc" />
            </View>
        </View>
    );
}

// ─── NumeroCard ───────────────────────────────────────────────────────────────

function NumeroCard({
    iconName, iconColor, bg, border, valor, label, sub, fontFamily,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    bg: string;
    border: string;
    valor: number;
    label: string;
    sub: string;
    fontFamily?: string;
}) {
    return (
        <View style={[styles.numeroCard, { backgroundColor: bg, borderColor: border }]}>
            <View style={styles.numeroIconRow}>
                <Ionicons name={iconName} size={16} color={iconColor} />
                <Text style={[styles.numeroValor, { fontFamily }]}>{valor}</Text>
            </View>
            <Text style={[styles.numeroLabel, { fontFamily }]}>{label}</Text>
            <Text style={[styles.numeroSub, { fontFamily }]}>{sub}</Text>
        </View>
    );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
    icon, iconOutline, label, active, fontFamily, onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
    fontFamily?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
            <Ionicons name={active ? icon : iconOutline} size={24} color={active ? PRIMARY : "#b0c4c2"} />
            <Text style={[styles.navLabel, { fontFamily, color: active ? PRIMARY : "#b0c4c2" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#f5f7f5" },
    centerContent: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },

    headerGradient: {},
    headerSafe: { paddingBottom: 20 },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 18,
    },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    locationCity: { fontSize: 13, color: "#e8f5f0", fontWeight: "600", letterSpacing: 0.2 },
    headerIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    },
    logoCircle: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
    logoHeader: { width: 50, height: 50 },
    bellWrap: { position: "relative" },
    badge: {
        position: "absolute", top: -4, right: -4,
        backgroundColor: "#e53935", borderRadius: 8,
        width: 16, height: 16,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1.5, borderColor: "#0d4a3e",
    },
    badgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },
    headerBottomRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20 },
    colaboradorLabel: { fontSize: 12, color: "#7ecfb3", letterSpacing: 0.5, marginBottom: 2 },
    greetingName: { fontSize: 26, color: "#ffffff", fontWeight: "700", marginBottom: 5, lineHeight: 30 },
    greetingSubtitle: { fontSize: 14, color: "#a8dac8", lineHeight: 19 },
    updatedCard: {
        backgroundColor: "rgba(255,255,255,0.13)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
        borderRadius: 14, padding: 10, minWidth: 120, alignItems: "center",
    },
    updatedCardRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    updatedLabel: { fontSize: 11, color: "#a8dac8" },
    updatedTime: { fontSize: 12, color: "#fff", fontWeight: "600" },

    scrollBody: { flex: 1, backgroundColor: "#f5f7f5" },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

    sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1a2e26", marginBottom: 12 },
    sectionHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 12,
    },
    verTodasRow: { flexDirection: "row", alignItems: "center", gap: 2 },
    verTodasText: { fontSize: 13, color: TEAL_MED, fontWeight: "600" },

    // Corpo hídrico
    corpoCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    corpoCardContent: { flexDirection: "row" },
    corpoLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    corpoIconCircle: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: "#e6f5ef", alignItems: "center", justifyContent: "center",
    },
    corpoLabelText: { fontSize: 10, fontWeight: "700", color: TEAL_MED, letterSpacing: 0.8 },
    corpoNome: { fontSize: 20, fontWeight: "700", color: "#1a2e26", marginBottom: 4 },
    corpoLocRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 8 },
    corpoLoc: { fontSize: 13, color: TEXT_MUTED },
    corpoStatusRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
    corpoStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    corpoStatusLabel: { fontSize: 13, fontWeight: "600", marginRight: 2 },
    corpoStatusHint: { fontSize: 12, color: TEXT_MUTED },
    verDetalhesBtn: {
        flexDirection: "row", alignItems: "center",
        borderWidth: 1, borderColor: "#d0e8df", borderRadius: 20,
        paddingVertical: 7, paddingHorizontal: 14, alignSelf: "flex-start",
    },
    verDetalhesBtnText: { fontSize: 13, color: TEAL_MED, fontWeight: "600", marginRight: 3 },
    corpoIlustracao: { width: 80, height: 80, marginLeft: 8, alignSelf: "center" },
    corpoIlustracaoGrad: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },

    // Ações
    acoesRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
    acaoCard: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1 },
    acaoIconCircle: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: "center", justifyContent: "center", marginBottom: 10,
    },
    acaoTitle: { fontSize: 12, fontWeight: "700", color: "#1a2e26", lineHeight: 16, marginBottom: 4 },
    acaoSubtitle: { fontSize: 10, color: TEXT_MUTED, lineHeight: 14, flex: 1 },
    acaoArrowRow: { alignItems: "flex-end", marginTop: 8 },

    // Empty state
    emptyState: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
    emptyIconCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: "#f0f4f2", alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    emptyTitulo: { fontSize: 14, fontWeight: "700", color: "#1a2e26", textAlign: "center", marginBottom: 6 },
    emptyDescricao: { fontSize: 13, color: TEXT_MUTED, textAlign: "center", lineHeight: 19 },

    // Atividades
    atividadesCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 4, marginBottom: 18,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    atividadeItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    atividadeItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    atividadeIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    atividadeTitulo: { fontSize: 13, fontWeight: "700", color: "#1a2e26", marginBottom: 2 },
    atividadeDetalhe: { fontSize: 12, color: TEXT_MUTED, marginBottom: 2 },
    atividadeData: { fontSize: 11, color: "#aaa" },
    statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusPillText: { fontSize: 11, fontWeight: "600" },

    // Números
    numerosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    numeroCard: { width: "47.5%", borderRadius: 12, padding: 12, borderWidth: 1 },
    numeroIconRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    numeroValor: { fontSize: 24, fontWeight: "700", color: "#1a2e26" },
    numeroLabel: { fontSize: 12, fontWeight: "600", color: "#1a2e26", marginBottom: 2 },
    numeroSub: { fontSize: 11, color: TEXT_MUTED },

    // Engajamento
    engajamentoCard: {
        backgroundColor: "#e8f5ef", borderRadius: 18, padding: 16,
        flexDirection: "row", gap: 12, alignItems: "center",
        borderWidth: 1, borderColor: "#c0e0cf",
    },
    engajamentoIconCircle: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: TEAL_MED,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    engajamentoTitle: { fontSize: 14, fontWeight: "700", color: "#0d4a3e", marginBottom: 3 },
    engajamentoBody: { fontSize: 12, color: "#2a7a5c", lineHeight: 17 },

    // Navbar
    navWrapper: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
    },
    navBar: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 4 : 10,
        paddingHorizontal: 8,
    },
    navItem: { width: "20%", alignItems: "center", justifyContent: "center", paddingVertical: 4 },
    navLabel: { fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
    fabSpacer: { width: "20%", alignItems: "center", justifyContent: "center" },
    fab: {
        width: 56, height: 56, borderRadius: 28, marginTop: -22,
        shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    },
    fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },

    // Tutorial
    tutorialOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center", alignItems: "center", paddingHorizontal: 24,
    },
    tutorialCard: {
        width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 24,
        overflow: "hidden",
        shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22, shadowRadius: 24, elevation: 16,
    },
    tutorialCardHeader: { marginBottom: 0 },
    tutorialHeaderGrad: { paddingVertical: 20, paddingHorizontal: 24, alignItems: "center" },
    tutorialHeaderTitle: { fontSize: 18, color: "#fff", fontWeight: "700", letterSpacing: 0.3 },
    tutorialHeaderSub: { fontSize: 12, color: "#a8dac8", marginTop: 2, letterSpacing: 1 },
    tutorialDotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 18, paddingBottom: 4 },
    tutorialDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#dce8e5" },
    tutorialDotActive: { width: 20, backgroundColor: TEAL_MED },
    tutorialStepBody: { alignItems: "center", paddingHorizontal: 28, paddingTop: 20, paddingBottom: 8 },
    tutorialStepIconCircle: {
        width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center",
        marginBottom: 18,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
    },
    tutorialStepTitle: { fontSize: 17, fontWeight: "700", color: "#1a2e26", textAlign: "center", marginBottom: 10 },
    tutorialStepDesc: { fontSize: 14, color: TEXT_MUTED, textAlign: "center", lineHeight: 22 },
    tutorialCounter: { textAlign: "center", fontSize: 12, color: "#bbb", marginTop: 14, marginBottom: 4 },
    tutorialBtnsRow: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 24, paddingBottom: 8, gap: 10,
    },
    tutorialBtnBack: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        borderWidth: 1.5, borderColor: TEAL_MED, borderRadius: 50, paddingVertical: 12,
    },
    tutorialBtnBackText: { fontSize: 14, color: TEAL_MED, fontWeight: "600" },
    tutorialBtnNext: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        backgroundColor: TEAL_MED, borderRadius: 50, paddingVertical: 12,
    },
    tutorialBtnNextText: { fontSize: 14, color: "#fff", fontWeight: "700" },
    tutorialBtnFinish: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 12,
    },
    tutorialBtnFinishText: { fontSize: 14, color: "#fff", fontWeight: "700" },
    tutorialSkipBtn: { paddingVertical: 14, alignItems: "center" },
    tutorialSkipText: { fontSize: 12, color: "#aaa", textDecorationLine: "underline" },
});