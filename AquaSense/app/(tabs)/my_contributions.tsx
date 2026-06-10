import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from 'react-native';
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { auth } from "../../config/firebase";
import {
    getCollaboratorContributions,
    type ContribuicaoUnificada,
    type StatusContribuicao,
    type TipoContribuicao,
} from "@/services/firestore/collaborator_contributions";

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIMARY    = "#004d48";
const TEAL_MID   = "#0d9080";
const SURFACE    = "#F5F9F8";
const CARD_BG    = "#ffffff";
const BORDER     = "#e0f2f1";
const MUTED      = "#6b7a7a";
const ORANGE     = "#e07b1e";
const RED        = "#e05252";
const BLUE       = "#1565c0";
const GREEN      = "#2e7d32";
const GRAY       = "#9e9e9e";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataHora(date: Date): { data: string; hora: string } {
    if (!date || date.getTime() === 0) return { data: "—", hora: "—" };
    return {
        data: date.toLocaleDateString("pt-BR"),
        hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
}

interface StatusConfig {
    label: string;
    bg: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    dot: string;
}

function getStatusConfig(status: StatusContribuicao): StatusConfig {
    switch (status) {
        case "validada":   return { label: "Validada",   bg: "#e8f5e9", color: GREEN,  icon: "checkmark-circle",     dot: GREEN  };
        case "em_analise": return { label: "Em análise", bg: "#fce4e4", color: RED,    icon: "time-outline",          dot: RED    };
        case "arquivada":  return { label: "Arquivada",  bg: "#f5f5f5", color: GRAY,   icon: "archive-outline",       dot: GRAY   };
        case "rascunho":   return { label: "Rascunho",   bg: "#f5f5f5", color: GRAY,   icon: "document-outline",      dot: GRAY   };
        default:           return { label: "Pendente",   bg: "#fff3e0", color: ORANGE, icon: "time-outline",          dot: ORANGE };
    }
}

interface TipoConfig {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
}

function getTipoConfig(tipo: TipoContribuicao): TipoConfig {
    switch (tipo) {
        case "measurement": return { icon: "flask-outline",    iconBg: "rgba(13,144,128,0.12)", iconColor: TEAL_MID };
        case "observation":  return { icon: "leaf-outline",     iconBg: "rgba(46,125,50,0.12)",  iconColor: GREEN    };
        case "complaint":    return { icon: "megaphone-outline",iconBg: "rgba(224,82,82,0.12)",  iconColor: RED      };
        case "water_body":   return { icon: "water-outline",    iconBg: "rgba(21,101,192,0.12)", iconColor: BLUE     };
    }
}

// ─── Chips de filtro ──────────────────────────────────────────────────────────

type Filtro = "Todas" | "Validadas" | "Pendentes" | "Em análise" | "Rascunhos";

const FILTROS: Filtro[] = ["Todas", "Validadas", "Pendentes", "Em análise", "Rascunhos"];

const FILTRO_DOT: Partial<Record<Filtro, string>> = {
    Validadas: GREEN,
    Pendentes: ORANGE,
    "Em análise": RED,
};

function filtroMatchStatus(filtro: Filtro, status: StatusContribuicao): boolean {
    if (filtro === "Todas") return true;
    if (filtro === "Validadas") return status === "validada";
    if (filtro === "Pendentes") return status === "pendente";
    if (filtro === "Em análise") return status === "em_analise";
    if (filtro === "Rascunhos") return status === "rascunho" || status === "arquivada";
    return true;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ChipFiltro({
    label,
    ativo,
    onPress,
    fontFamily,
}: {
    label: Filtro;
    ativo: boolean;
    onPress: () => void;
    fontFamily?: string;
}) {
    const dot = FILTRO_DOT[label];
    return (
        <TouchableOpacity
            style={[chip.base, ativo && chip.active]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            {dot && !ativo && <View style={[chip.dot, { backgroundColor: dot }]} />}
            <Text style={[chip.text, { fontFamily }, ativo && chip.textActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const chip = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 50,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: BORDER,
        marginRight: 8,
    },
    active: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
    text: { fontSize: 13, color: MUTED, fontWeight: "600" },
    textActive: { color: "#fff" },
});

function CardContribuicao({
    item,
    fontFamily,
    onPress,
}: {
    item: ContribuicaoUnificada;
    fontFamily?: string;
    onPress?: () => void;
}) {
    const { data, hora } = formatarDataHora(item.criadoEm);
    const st = getStatusConfig(item.status);
    const tp = getTipoConfig(item.tipo);
    const isCalendar = item.tipo === "measurement" || item.tipo === "water_body";

    return (
        <TouchableOpacity
            style={card.wrap}
            onPress={onPress}
            activeOpacity={onPress ? 0.75 : 1}
        >
            {/* ícone tipo */}
            <View style={[card.iconCircle, { backgroundColor: tp.iconBg }]}>
                <Ionicons name={tp.icon} size={22} color={tp.iconColor} />
            </View>

            {/* conteúdo */}
            <View style={card.body}>
                <Text style={[card.title, { fontFamily }]} numberOfLines={1}>
                    {item.titulo}
                </Text>
                {(item.corpoHidricoNome || item.descricao) && (
                    <Text style={[card.sub, { fontFamily }]} numberOfLines={1}>
                        {[item.corpoHidricoNome, item.descricao].filter(Boolean).join(" · ")}
                    </Text>
                )}
                <View style={card.dateRow}>
                    <Ionicons
                        name={isCalendar ? "calendar-outline" : "time-outline"}
                        size={12}
                        color="#aaa"
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[card.date, { fontFamily }]}>
                        {data} · {hora}
                    </Text>
                </View>
            </View>

            {/* status + chevron */}
            <View style={card.right}>
                <View style={[card.pill, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={11} color={st.color} style={{ marginRight: 3 }} />
                    <Text style={[card.pillText, { fontFamily, color: st.color }]}>
                        {st.label}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#ccc" style={{ marginTop: 6 }} />
            </View>
        </TouchableOpacity>
    );
}

const card = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: CARD_BG,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    body: { flex: 1, marginRight: 8 },
    title: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 3 },
    sub: { fontSize: 12, color: MUTED, marginBottom: 4 },
    dateRow: { flexDirection: "row", alignItems: "center" },
    date: { fontSize: 11, color: "#aaa" },
    right: { alignItems: "flex-end" },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 50,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    pillText: { fontSize: 11, fontWeight: "700" },
});

// ─── Tela principal ───────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

export default function MyContributions() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("Todas");
    const [items, setItems] = useState<ContribuicaoUnificada[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [visivel, setVisivel] = useState(PAGE_SIZE);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const Q = fontsLoaded ? "Questrial_400Regular" : undefined;

    const buscar = useCallback(async () => {
        setLoading(true);
        setErro(null);
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) {
                setItems([]);
                return;
            }
            const data = await getCollaboratorContributions(uid);
            setItems(data);
        } catch (e: any) {
            console.error("[MyContributions] Erro ao buscar contribuições:", e);
            setErro("Não foi possível carregar as contribuições. Tente novamente.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { buscar(); }, [buscar]);

    // ── Filtro corrigido: inclui tipo e status na busca textual ──
    const filtradas = items.filter((item) => {
        const q = search.toLowerCase();
        const textOk =
            !search ||
            item.titulo.toLowerCase().includes(q) ||
            (item.corpoHidricoNome ?? "").toLowerCase().includes(q) ||
            (item.descricao ?? "").toLowerCase().includes(q) ||
            item.tipo.toLowerCase().includes(q) ||
            item.status.toLowerCase().includes(q);
        return textOk && filtroMatchStatus(filtro, item.status);
    });

    const pagina = filtradas.slice(0, visivel);
    const temMais = visivel < filtradas.length;

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={s.root}>
                {/* ── HEADER ──────────────────────────────────────────────── */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.headerGrad}
                >
                    <SafeAreaView edges={["top"]} style={s.headerSafe}>
                        <View style={s.headerRow}>
                            <TouchableOpacity
                                style={s.backBtn}
                                onPress={() => router.back()}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back-outline" size={22} color="#fff" />
                            </TouchableOpacity>

                            <View style={s.headerText}>
                                <Text style={[s.headerTitle, { fontFamily: Q }]}>
                                    Minhas contribuições
                                </Text>
                                <Text style={[s.headerSub, { fontFamily: Q }]}>
                                    Acompanhe aqui todas as suas medições e observações enviadas.
                                </Text>
                            </View>

                            <Image
                                source={require('../../assets/images/aquasense.png')}
                                style={s.logoImage}
                                resizeMode="contain"
                            />
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ── CARD BRANCO PRINCIPAL ────────────────────────────────── */}
                <View style={s.mainCard}>

                    {/* ── BUSCA — botão Filtrar removido ── */}
                    <View style={s.searchRow}>
                        <View style={s.searchBar}>
                            <Ionicons name="search-outline" size={17} color={MUTED} style={{ marginRight: 8 }} />
                            <TextInput
                                style={[s.searchInput, { fontFamily: Q }]}
                                placeholder="Buscar contribuições"
                                placeholderTextColor="#bbb"
                                value={search}
                                onChangeText={(t) => { setSearch(t); setVisivel(PAGE_SIZE); }}
                                returnKeyType="search"
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch("")}>
                                    <Ionicons name="close-circle" size={16} color={MUTED} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={s.chipsScroll}
                        contentContainerStyle={s.chipsContent}
                    >
                        {FILTROS.map((f) => (
                            <ChipFiltro
                                key={f}
                                label={f}
                                ativo={filtro === f}
                                onPress={() => { setFiltro(f); setVisivel(PAGE_SIZE); }}
                                fontFamily={Q}
                            />
                        ))}
                    </ScrollView>

                    {/* Contagem + ordenação */}
                    {!loading && (
                        <View style={s.metaRow}>
                            <Text style={[s.metaCount, { fontFamily: Q }]}>
                                Resultados:{" "}
                                <Text style={{ color: "#1a1a1a", fontWeight: "700" }}>
                                    {filtradas.length} contribuiç{filtradas.length === 1 ? "ão" : "ões"}
                                </Text>
                            </Text>
                            <View style={s.sortBtn}>
                                <Text style={[s.sortText, { fontFamily: Q }]}>Mais recentes</Text>
                                <Ionicons name="swap-vertical-outline" size={14} color={MUTED} style={{ marginLeft: 4 }} />
                            </View>
                        </View>
                    )}

                    {/* Lista */}
                    {loading ? (
                        <View style={s.loadingWrap}>
                            <ActivityIndicator size="large" color={PRIMARY} />
                            <Text style={[s.loadingText, { fontFamily: Q }]}>
                                Carregando contribuições…
                            </Text>
                        </View>
                    ) : erro ? (
                        <View style={s.erroWrap}>
                            <Ionicons name="cloud-offline-outline" size={32} color={MUTED} />
                            <Text style={[s.erroText, { fontFamily: Q }]}>{erro}</Text>
                            <TouchableOpacity style={s.retryBtn} onPress={buscar} activeOpacity={0.8}>
                                <Text style={[s.retryText, { fontFamily: Q }]}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={s.listContent}
                        >
                            {pagina.length === 0 ? (
                                <View style={s.emptyWrap}>
                                    <View style={s.emptyCircle}>
                                        <Ionicons name="leaf-outline" size={28} color={MUTED} />
                                    </View>
                                    <Text style={[s.emptyText, { fontFamily: Q }]}>
                                        Nenhuma contribuição encontrada.
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {pagina.map((item) => (
                                        <CardContribuicao
                                            key={item.id}
                                            item={item}
                                            fontFamily={Q}
                                        />
                                    ))}

                                    {/* paginação */}
                                    <Text style={[s.showingText, { fontFamily: Q }]}>
                                        Mostrando {pagina.length} de {filtradas.length} contribuições
                                    </Text>

                                    {temMais && (
                                        <TouchableOpacity
                                            style={s.loadMoreBtn}
                                            onPress={() => setVisivel((v) => v + PAGE_SIZE)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.loadMoreText, { fontFamily: Q }]}>
                                                Carregar mais
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={MUTED} style={{ marginLeft: 6 }} />
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { height: H } = Dimensions.get("window");

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0a6b5e" },

    // Header
    headerGrad: {},
    headerSafe: { paddingBottom: 20 },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 21, color: "#fff", fontWeight: "700" },
    headerSub: {
        fontSize: 12,
        color: "rgba(255,255,255,0.8)",
        marginTop: 5,
        lineHeight: 18,
    },
    logoImage: {
        width: 70,
        height: 70,
    },

    // Card branco principal
    mainCard: {
        flex: 1,
        backgroundColor: SURFACE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        overflow: "hidden",
    },

    // Busca — ocupa largura total sem botão Filtrar
    searchRow: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: CARD_BG,
        borderRadius: 50,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === "ios" ? 11 : 8,
        borderWidth: 1,
        borderColor: BORDER,
    },
    searchInput: { flex: 1, fontSize: 14, color: "#333" },

    // Chips
    chipsScroll: { flexGrow: 0, marginBottom: 14 },
    chipsContent: {
        paddingHorizontal: 16,
        paddingVertical: 2,
        flexDirection: "row",
        alignItems: "center",
    },

    // Meta row
    metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    metaCount: { fontSize: 13, color: MUTED },
    sortBtn: { flexDirection: "row", alignItems: "center" },
    sortText: { fontSize: 12, color: MUTED, fontWeight: "600" },

    // Lista
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },

    // Estados
    loadingWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        gap: 12,
    },
    loadingText: { fontSize: 14, color: MUTED },

    erroWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        paddingHorizontal: 32,
        gap: 12,
    },
    erroText: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },
    retryBtn: {
        marginTop: 4,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: PRIMARY,
        borderRadius: 50,
    },
    retryText: { fontSize: 14, color: "#fff", fontWeight: "600" },

    emptyWrap: { alignItems: "center", paddingTop: 48, gap: 12 },
    emptyCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: BORDER,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: { fontSize: 14, color: MUTED },

    // Paginação
    showingText: {
        textAlign: "center",
        fontSize: 12,
        color: MUTED,
        marginTop: 8,
        marginBottom: 14,
    },
    loadMoreBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: BORDER,
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: CARD_BG,
        marginBottom: 8,
    },
    loadMoreText: { fontSize: 14, color: MUTED, fontWeight: "600" },
});