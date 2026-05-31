import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    TextInput,
    Image,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db, auth } from "../../config/firebase";

const PRIMARY = "#004d48";

interface Contribuicao {
    id: string;
    tipo: "observacao" | "denuncia" | "medicao";
    titulo: string;
    corpo: string;
    detalhe: string;
    data: string;
    hora: string;
    status: string;
    statusBg: string;
    statusColor: string;
    icon: string;
    iconBg: string;
    iconColor: string;
}

function formatarData(timestamp: any): { data: string; hora: string } {
    if (!timestamp) return { data: "—", hora: "—" };
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const data = date.toLocaleDateString("pt-BR");
    const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return { data, hora };
}

export default function MyContributions() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [filtroAtivo, setFiltroAtivo] = useState("Todas");
    const [contribuicoes, setContribuicoes] = useState<Contribuicao[]>([]);
    const [loading, setLoading] = useState(true);
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    useEffect(() => {
        buscarContribuicoes();
    }, []);

    async function buscarContribuicoes() {
        setLoading(true);
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            // Busca observações reais do Firestore
            const q = query(
                collection(db, "observacoes"),
                where("criadoPor", "==", uid),
                orderBy("dataCriacao", "desc")
            );
            const snap = await getDocs(q);

            const lista: Contribuicao[] = snap.docs.map((doc) => {
                const d = doc.data();
                const { data, hora } = formatarData(d.dataCriacao);
                return {
                    id: doc.id,
                    tipo: "observacao",
                    titulo: `Observação - ${d.corpoHidricoId ?? "Corpo hídrico"}`,
                    corpo: d.corpoHidricoId ?? "—",
                    detalhe: `Cor: ${d.cor ?? "—"} · Odor: ${d.odor ?? "—"}`,
                    data,
                    hora,
                    status: "Pendente",
                    statusBg: "#fff8e1",
                    statusColor: "#e6a817",
                    icon: "leaf-outline",
                    iconBg: "rgba(230,168,23,0.12)",
                    iconColor: "#e6a817",
                };
            });

            setContribuicoes(lista);
        } catch (e) {
            console.error("Erro ao buscar contribuições:", e);
        } finally {
            setLoading(false);
        }
    }

    const filtradas = contribuicoes.filter((c) => {
        const buscaOk = c.titulo.toLowerCase().includes(search.toLowerCase());
        const filtroOk = filtroAtivo === "Todas" || c.status === filtroAtivo;
        return buscaOk && filtroOk;
    });

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* ══ HEADER ══ */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <View style={styles.headerRow}>
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => router.back()}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={styles.headerTitleWrapper}>
                                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                                    Minhas contribuições
                                </Text>
                                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                                    Acompanhe aqui todas as suas medições e observações enviadas.
                                </Text>
                            </View>
                            <Image
                                source={require("../../assets/images/aquasense.png")}
                                style={styles.headerLogo}
                                resizeMode="contain"
                                tintColor="#FFFFFF"
                            />
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ BARRA DE BUSCA ══ */}
                <View style={styles.searchWrapper}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color="#6b7a7a" style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.searchInput, { fontFamily: questrial }]}
                            placeholder="Buscar contribuições"
                            placeholderTextColor="#aaa"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {/* ══ FILTROS ══ */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersWrapper}>
                    {["Todas", "Validada", "Pendente", "Em análise"].map((filtro) => (
                        <TouchableOpacity
                            key={filtro}
                            style={[styles.filterChip, filtroAtivo === filtro && styles.filterChipActive]}
                            onPress={() => setFiltroAtivo(filtro)}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { fontFamily: questrial },
                                filtroAtivo === filtro && styles.filterChipTextActive,
                            ]}>
                                {filtro}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* ══ LISTA ══ */}
                {loading ? (
                    <View style={styles.loadingWrapper}>
                        <ActivityIndicator size="large" color={PRIMARY} />
                        <Text style={[styles.loadingText, { fontFamily: questrial }]}>Carregando contribuições...</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.resultados, { fontFamily: questrial }]}>
                            Resultados: {filtradas.length} contribuiç{filtradas.length === 1 ? "ão" : "ões"}
                        </Text>

                        {filtradas.length === 0 ? (
                            <View style={styles.emptyWrapper}>
                                <Ionicons name="leaf-outline" size={40} color="#e0f2f1" />
                                <Text style={[styles.emptyText, { fontFamily: questrial }]}>
                                    Nenhuma contribuição encontrada.
                                </Text>
                            </View>
                        ) : (
                            filtradas.map((item) => (
                                <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.82}>
                                    <View style={styles.cardLeft}>
                                        <View style={[styles.cardIconCircle, { backgroundColor: item.iconBg }]}>
                                            <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                                        </View>
                                        <View style={styles.cardInfo}>
                                            <Text style={[styles.cardTitle, { fontFamily: questrial }]} numberOfLines={1}>
                                                {item.titulo}
                                            </Text>
                                            <Text style={[styles.cardSub, { fontFamily: questrial }]} numberOfLines={1}>
                                                {item.detalhe}
                                            </Text>
                                            <Text style={[styles.cardData, { fontFamily: questrial }]}>
                                                {item.data} · {item.hora}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardRight}>
                                        <View style={[styles.statusPill, { backgroundColor: item.statusBg }]}>
                                            <Text style={[styles.statusText, { fontFamily: questrial, color: item.statusColor }]}>
                                                {item.status}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#aaa" style={{ marginTop: 8 }} />
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },
    headerGradient: {},
    headerSafeArea: { paddingBottom: 16 },
    headerRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 10, gap: 12 },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center", justifyContent: "center",
        marginTop: 4,
    },
    headerTitleWrapper: { flex: 1 },
    headerTitle: { fontSize: 20, color: "#FFFFFF", fontWeight: "700", letterSpacing: 0.2 },
    headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, lineHeight: 18 },
    headerLogo: { width: 44, height: 44 },
    searchWrapper: {
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1, borderBottomColor: "#e0f2f1",
    },
    searchBar: {
        flex: 1, flexDirection: "row", alignItems: "center",
        backgroundColor: "#F5F9F8", borderRadius: 50,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: "#e0f2f1",
    },
    searchInput: { flex: 1, fontSize: 14, color: "#333" },
    filtersScroll: { backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#e0f2f1" },
    filtersWrapper: {
        flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12,
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 50, backgroundColor: "#F5F9F8",
        borderWidth: 1, borderColor: "#e0f2f1",
    },
    filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    filterChipText: { fontSize: 12, color: "#6b7a7a", fontWeight: "600" },
    filterChipTextActive: { color: "#FFFFFF" },
    loadingWrapper: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 14, color: "#6b7a7a" },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    resultados: { fontSize: 13, color: "#6b7a7a", marginBottom: 12, fontWeight: "600" },
    emptyWrapper: { alignItems: "center", paddingTop: 40, gap: 12 },
    emptyText: { fontSize: 14, color: "#6b7a7a", textAlign: "center" },
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14,
        marginBottom: 12, flexDirection: "row", alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    cardIconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 14, color: "#1a1a1a", fontWeight: "700", marginBottom: 3 },
    cardSub: { fontSize: 12, color: "#6b7a7a", marginBottom: 3 },
    cardData: { fontSize: 11, color: "#aaa" },
    cardRight: { alignItems: "flex-end" },
    statusPill: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 11, fontWeight: "700" },
});