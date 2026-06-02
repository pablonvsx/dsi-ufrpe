import React, { useState, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Modal, Alert, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db, auth } from "../../config/firebase";
import {
    getComplaintsByUser,
    archiveComplaint,
    type Denuncia,
} from "@/services/firestore/complaints";

const PRIMARY = "#004d48";
const TEAL_MID = "#0d9080";
const SURFACE = "#F5F9F8";
const BORDER_LIGHT = "#e0f2f1";
const TEXT_MUTED = "#6b7a7a";
const ORANGE = "#e07b1e";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDenunciaStyle(status?: string): { label: string; bg: string; color: string } {
    switch (status) {
        case "recebida":           return { label: "Recebida",     bg: "#e8f5e9", color: "#388e3c" };
        case "em_analise":         return { label: "Em análise",   bg: "#fff8e1", color: "#f57f17" };
        case "encaminhada_equipe": return { label: "Encaminhada",  bg: "#e3f2fd", color: "#1565c0" };
        case "resolvida":          return { label: "Resolvida",    bg: "#e6f4f1", color: "#1a8c80" };
        case "arquivada":          return { label: "Arquivada",    bg: "#f5f5f5", color: "#9e9e9e" };
        default:                   return { label: "Pendente",     bg: "#fff3e0", color: ORANGE   };
    }
}

function statusOrder(status?: string): number {
    const map: Record<string, number> = {
        pendente: 0, recebida: 1, em_analise: 2, encaminhada_equipe: 3, resolvida: 4,
    };
    return map[status ?? "pendente"] ?? 0;
}

function labelTipo(id: string): string {
    const map: Record<string, string> = {
        esgoto: "Esgoto irregular", lixo: "Lixo / Resíduos",
        poluicao_agua: "Poluição da água", desmatamento: "Desmatamento",
        queimada: "Queimada", fumaca: "Emissão de fumaça", outro: "Outro",
    };
    return map[id] ?? id;
}

function formatarData(timestamp: any): { data: string; hora: string } {
    if (!timestamp) return { data: "—", hora: "—" };
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return {
        data: date.toLocaleDateString("pt-BR"),
        hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
}

// ─── Status Timeline ──────────────────────────────────────────────────────────

const STATUS_STEPS = [
    { key: "recebida",           label: "Recebida",          icon: "checkmark-circle-outline" as const, color: "#388e3c" },
    { key: "em_analise",         label: "Em análise",        icon: "search-outline" as const,           color: "#f57f17" },
    { key: "encaminhada_equipe", label: "Encaminhada",       icon: "people-outline" as const,           color: "#1565c0" },
    { key: "resolvida",          label: "Resolvida",         icon: "checkmark-done-circle-outline" as const, color: "#1a8c80" },
];

function StatusTimeline({ currentStatus, fontFamily }: { currentStatus?: string; fontFamily?: string }) {
    const currentOrder = statusOrder(currentStatus);

    return (
        <View style={tl.row}>
            {STATUS_STEPS.map((step, idx) => {
                const done = statusOrder(step.key) <= currentOrder && currentStatus !== "pendente" && currentStatus !== "arquivada";
                const isActive = step.key === currentStatus;
                const color = done ? step.color : "#ccc";

                return (
                    <React.Fragment key={step.key}>
                        <View style={tl.step}>
                            <View style={[tl.circle, { borderColor: color, backgroundColor: done ? color + "22" : "#f5f5f5" }]}>
                                <Ionicons name={step.icon} size={18} color={color} />
                            </View>
                            <Text style={[tl.label, { fontFamily, color: done ? "#333" : "#bbb" }]} numberOfLines={2}>
                                {step.label}
                            </Text>
                            {isActive && <View style={[tl.activeDot, { backgroundColor: color }]} />}
                        </View>
                        {idx < STATUS_STEPS.length - 1 && (
                            <View style={[tl.line, { backgroundColor: statusOrder(STATUS_STEPS[idx + 1].key) <= currentOrder && currentStatus !== "pendente" ? STATUS_STEPS[idx].color : "#e0e0e0" }]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const tl = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", marginVertical: 8 },
    step: { alignItems: "center", width: 60 },
    circle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    label: { fontSize: 9, textAlign: "center", marginTop: 4, lineHeight: 12 },
    activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
    line: { flex: 1, height: 2, marginTop: 17 },
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MyContributions() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [filtroAtivo, setFiltroAtivo] = useState("Todas");
    const [contribuicoes, setContribuicoes] = useState<Contribuicao[]>([]);
    const [denunciasMap, setDenunciasMap] = useState<Map<string, Denuncia>>(new Map());
    const [loading, setLoading] = useState(true);
    const [archiving, setArchiving] = useState(false);

    const [selectedItem, setSelectedItem] = useState<Contribuicao | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const Q = fontsLoaded ? "Questrial_400Regular" : undefined;

    useEffect(() => { buscarContribuicoes(); }, []);

    const buscarContribuicoes = useCallback(async () => {
        setLoading(true);
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) { setContribuicoes([]); return; }

            const obsQuery = query(
                collection(db, "observacoes"),
                where("criadoPor", "==", uid),
                orderBy("dataCriacao", "desc")
            );

            const [obsSnap, denuncias] = await Promise.all([
                getDocs(obsQuery),
                getComplaintsByUser(uid),
            ]);

            const observacoes: Contribuicao[] = obsSnap.docs.map((doc) => {
                const d = doc.data();
                const { data, hora } = formatarData(d.dataCriacao);
                return {
                    id: doc.id, tipo: "observacao",
                    titulo: `Observação - ${d.corpoHidricoId ?? "Corpo hídrico"}`,
                    corpo: d.corpoHidricoId ?? "—",
                    detalhe: `Cor: ${d.cor ?? "—"} · Odor: ${d.odor ?? "—"}`,
                    data, hora,
                    status: "Pendente", statusBg: "#fff8e1", statusColor: "#e6a817",
                    icon: "leaf-outline", iconBg: "rgba(230,168,23,0.12)", iconColor: "#e6a817",
                };
            });

            const rawMap = new Map<string, Denuncia>();
            const denunciasFormatadas: Contribuicao[] = denuncias.map((d) => {
                rawMap.set(d.id, d);
                const { data, hora } = formatarData(d.dataCriacao);
                const { label, bg, color } = statusDenunciaStyle(d.status);
                return {
                    id: d.id, tipo: "denuncia",
                    titulo: d.titulo ?? "Denúncia",
                    corpo: d.corpoHidricoNome ?? d.cidade ?? "—",
                    detalhe: d.tipoProblema ? `Tipo: ${labelTipo(d.tipoProblema)}` : (d.descricao?.slice(0, 60) ?? ""),
                    data, hora,
                    status: label, statusBg: bg, statusColor: color,
                    icon: "megaphone-outline", iconBg: "rgba(224,82,82,0.12)", iconColor: "#e05252",
                };
            });

            setDenunciasMap(rawMap);
            const all = [...observacoes, ...denunciasFormatadas].sort((a, b) => {
                const parse = (s: string, h: string) => new Date(`${s.split("/").reverse().join("-")}T${h}`).getTime();
                return parse(b.data, b.hora) - parse(a.data, a.hora);
            });
            setContribuicoes(all);
        } catch (e) {
            console.error("Erro ao buscar contribuições:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    function abrirDetalhe(item: Contribuicao) {
        setSelectedItem(item);
        setModalVisible(true);
    }

    async function handleArquivar() {
        if (!selectedItem) return;
        Alert.alert(
            "Arquivar denúncia",
            "Tem certeza que deseja arquivar esta denúncia? Esta ação não pode ser desfeita.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Arquivar", style: "destructive",
                    onPress: async () => {
                        setArchiving(true);
                        try {
                            await archiveComplaint(selectedItem.id);
                            setModalVisible(false);
                            await buscarContribuicoes();
                        } catch {
                            Alert.alert("Erro", "Não foi possível arquivar a denúncia.");
                        } finally {
                            setArchiving(false);
                        }
                    },
                },
            ]
        );
    }

    const filtradas = contribuicoes.filter((c) => {
        const buscaOk = c.titulo.toLowerCase().includes(search.toLowerCase());
        const filtroOk = filtroAtivo === "Todas" || c.status === filtroAtivo ||
            (filtroAtivo === "Denúncias" && c.tipo === "denuncia") ||
            (filtroAtivo === "Observações" && c.tipo === "observacao");
        return buscaOk && filtroOk;
    });

    const selectedDenuncia = selectedItem ? denunciasMap.get(selectedItem.id) : null;
    const podeArquivar = selectedDenuncia && !["arquivada", "resolvida"].includes(selectedDenuncia.status ?? "");

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={s.root}>
                {/* HEADER */}
                <LinearGradient colors={["#004d48", "#0a6b5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.headerGradient}>
                    <SafeAreaView edges={["top"]} style={s.headerSafe}>
                        <View style={s.headerRow}>
                            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                                <Ionicons name="arrow-back-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                            <View style={s.headerTextWrap}>
                                <Text style={[s.headerTitle, { fontFamily: Q }]}>Minhas contribuições</Text>
                                <Text style={[s.headerSub, { fontFamily: Q }]}>
                                    Acompanhe suas observações e denúncias enviadas.
                                </Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                {/* BUSCA */}
                <View style={s.searchWrapper}>
                    <View style={s.searchBar}>
                        <Ionicons name="search-outline" size={18} color={TEXT_MUTED} style={{ marginRight: 8 }} />
                        <TextInput
                            style={[s.searchInput, { fontFamily: Q }]}
                            placeholder="Buscar contribuições"
                            placeholderTextColor="#aaa"
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch("")}>
                                <Ionicons name="close-circle" size={16} color={TEXT_MUTED} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* FILTROS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersWrap}>
                    {["Todas", "Denúncias", "Observações", "Pendente", "Recebida", "Em análise", "Encaminhada", "Resolvida"].map((f) => (
                        <TouchableOpacity key={f} style={[s.chip, filtroAtivo === f && s.chipActive]} onPress={() => setFiltroAtivo(f)} activeOpacity={0.8}>
                            <Text style={[s.chipText, { fontFamily: Q }, filtroAtivo === f && s.chipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* LISTA */}
                {loading ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator size="large" color={PRIMARY} />
                        <Text style={[s.loadingText, { fontFamily: Q }]}>Carregando contribuições...</Text>
                    </View>
                ) : (
                    <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
                        <Text style={[s.resultados, { fontFamily: Q }]}>
                            {filtradas.length} contribuiç{filtradas.length === 1 ? "ão" : "ões"} encontrada{filtradas.length === 1 ? "" : "s"}
                        </Text>

                        {filtradas.length === 0 ? (
                            <View style={s.emptyWrap}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="leaf-outline" size={28} color={TEXT_MUTED} />
                                </View>
                                <Text style={[s.emptyText, { fontFamily: Q }]}>Nenhuma contribuição encontrada.</Text>
                            </View>
                        ) : (
                            filtradas.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[s.card, item.tipo === "denuncia" && s.cardDenuncia]}
                                    onPress={() => item.tipo === "denuncia" ? abrirDetalhe(item) : null}
                                    activeOpacity={item.tipo === "denuncia" ? 0.75 : 1}
                                >
                                    <View style={s.cardLeft}>
                                        <View style={[s.cardIcon, { backgroundColor: item.iconBg }]}>
                                            <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                                        </View>
                                        <View style={s.cardInfo}>
                                            <Text style={[s.cardTitle, { fontFamily: Q }]} numberOfLines={1}>{item.titulo}</Text>
                                            <Text style={[s.cardDetalhe, { fontFamily: Q }]} numberOfLines={1}>{item.detalhe}</Text>
                                            <Text style={[s.cardData, { fontFamily: Q }]}>{item.data} · {item.hora}</Text>
                                        </View>
                                    </View>
                                    <View style={s.cardRight}>
                                        <View style={[s.statusPill, { backgroundColor: item.statusBg }]}>
                                            <Text style={[s.statusText, { fontFamily: Q, color: item.statusColor }]}>{item.status}</Text>
                                        </View>
                                        {item.tipo === "denuncia" && (
                                            <Ionicons name="chevron-forward" size={16} color="#aaa" style={{ marginTop: 6 }} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>

            {/* ── MODAL DETALHE DENÚNCIA ─────────────────────────────────────── */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={m.overlay}>
                    <TouchableOpacity style={m.backdrop} onPress={() => setModalVisible(false)} activeOpacity={1} />

                    <View style={m.sheet}>
                        {/* Handle */}
                        <View style={m.handle} />

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={m.sheetScroll}>
                            {/* Cabeçalho */}
                            <View style={m.sheetHeader}>
                                <View style={m.sheetIconCircle}>
                                    <Ionicons name="megaphone-outline" size={24} color={ORANGE} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[m.sheetTitle, { fontFamily: Q }]} numberOfLines={2}>
                                        {selectedItem?.titulo}
                                    </Text>
                                    {selectedDenuncia?.tipoProblema && (
                                        <View style={m.tipoTag}>
                                            <Text style={[m.tipoTagText, { fontFamily: Q }]}>
                                                {labelTipo(selectedDenuncia.tipoProblema)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={m.closeBtn}>
                                    <Ionicons name="close" size={20} color={TEXT_MUTED} />
                                </TouchableOpacity>
                            </View>

                            <View style={m.divider} />

                            {/* Status atual */}
                            {selectedItem && (
                                <View style={m.statusRow}>
                                    <View style={[m.statusBadge, { backgroundColor: selectedItem.statusBg }]}>
                                        <Ionicons
                                            name={selectedItem.status === "Resolvida" ? "checkmark-circle" : selectedItem.status === "Arquivada" ? "archive" : "time-outline"}
                                            size={14} color={selectedItem.statusColor} style={{ marginRight: 4 }}
                                        />
                                        <Text style={[m.statusBadgeText, { fontFamily: Q, color: selectedItem.statusColor }]}>
                                            {selectedItem.status}
                                        </Text>
                                    </View>
                                    <Text style={[m.dataText, { fontFamily: Q }]}>
                                        {selectedItem.data} às {selectedItem.hora}
                                    </Text>
                                </View>
                            )}

                            {/* Timeline */}
                            {selectedDenuncia && !["arquivada"].includes(selectedDenuncia.status ?? "") && (
                                <View style={m.section}>
                                    <Text style={[m.sectionLabel, { fontFamily: Q }]}>Andamento da denúncia</Text>
                                    <StatusTimeline currentStatus={selectedDenuncia.status} fontFamily={Q} />
                                </View>
                            )}

                            {/* Localização */}
                            {(selectedDenuncia?.cidade || selectedDenuncia?.corpoHidricoNome) && (
                                <View style={m.infoRow}>
                                    <Ionicons name="location-outline" size={16} color={TEAL_MID} />
                                    <Text style={[m.infoText, { fontFamily: Q }]}>
                                        {[selectedDenuncia.corpoHidricoNome, selectedDenuncia.cidade, selectedDenuncia.estado].filter(Boolean).join(" · ")}
                                    </Text>
                                </View>
                            )}

                            {/* Descrição */}
                            {selectedDenuncia?.descricao && (
                                <View style={m.section}>
                                    <Text style={[m.sectionLabel, { fontFamily: Q }]}>Descrição</Text>
                                    <View style={m.descBox}>
                                        <Text style={[m.descText, { fontFamily: Q }]}>{selectedDenuncia.descricao}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Ação arquivar */}
                            {podeArquivar && (
                                <TouchableOpacity
                                    style={m.archiveBtn}
                                    onPress={handleArquivar}
                                    activeOpacity={0.8}
                                    disabled={archiving}
                                >
                                    {archiving ? (
                                        <ActivityIndicator size="small" color="#9e9e9e" />
                                    ) : (
                                        <>
                                            <Ionicons name="archive-outline" size={18} color="#9e9e9e" style={{ marginRight: 8 }} />
                                            <Text style={[m.archiveBtnText, { fontFamily: Q }]}>Arquivar denúncia</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            {selectedDenuncia?.status === "arquivada" && (
                                <View style={m.archivedNotice}>
                                    <Ionicons name="archive" size={16} color="#9e9e9e" style={{ marginRight: 8 }} />
                                    <Text style={[m.archivedNoticeText, { fontFamily: Q }]}>Esta denúncia foi arquivada.</Text>
                                </View>
                            )}

                            {selectedDenuncia?.status === "resolvida" && (
                                <View style={[m.archivedNotice, { backgroundColor: "#e8f5e9" }]}>
                                    <Ionicons name="checkmark-circle" size={16} color="#388e3c" style={{ marginRight: 8 }} />
                                    <Text style={[m.archivedNoticeText, { fontFamily: Q, color: "#388e3c" }]}>
                                        Esta denúncia foi resolvida pela equipe técnica.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: SURFACE },
    headerGradient: {},
    headerSafe: { paddingBottom: 16 },
    headerRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 10, gap: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginTop: 4 },
    headerTextWrap: { flex: 1 },
    headerTitle: { fontSize: 20, color: "#fff", fontWeight: "700" },
    headerSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, lineHeight: 18 },

    searchWrapper: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT, paddingHorizontal: 20, paddingVertical: 12 },
    searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: SURFACE, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: BORDER_LIGHT },
    searchInput: { flex: 1, fontSize: 14, color: "#333" },

    filtersScroll: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT },
    filtersWrap: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER_LIGHT },
    chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    chipText: { fontSize: 12, color: TEXT_MUTED, fontWeight: "600" },
    chipTextActive: { color: "#fff" },

    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 14, color: TEXT_MUTED },

    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
    resultados: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12, fontWeight: "600" },

    emptyWrap: { alignItems: "center", paddingTop: 40, gap: 12 },
    emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: BORDER_LIGHT, alignItems: "center", justifyContent: "center" },
    emptyText: { fontSize: 14, color: TEXT_MUTED },

    card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
    cardDenuncia: { borderLeftWidth: 3, borderLeftColor: "#e05252" },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 14, color: "#1a1a1a", fontWeight: "700", marginBottom: 3 },
    cardDetalhe: { fontSize: 12, color: TEXT_MUTED, marginBottom: 3 },
    cardData: { fontSize: 11, color: "#aaa" },
    cardRight: { alignItems: "flex-end" },
    statusPill: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 11, fontWeight: "700" },
});

const { height: SCREEN_H } = Dimensions.get("window");

const m = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_H * 0.85, paddingBottom: 32 },
    handle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
    sheetScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },

    sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
    sheetIconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(224,123,30,0.12)", alignItems: "center", justifyContent: "center" },
    sheetTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1a1a1a", lineHeight: 22 },
    closeBtn: { padding: 4 },

    tipoTag: { marginTop: 4, alignSelf: "flex-start", backgroundColor: "rgba(224,123,30,0.12)", borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
    tipoTagText: { fontSize: 11, color: ORANGE, fontWeight: "700" },

    divider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 14 },

    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    statusBadge: { flexDirection: "row", alignItems: "center", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 },
    statusBadgeText: { fontSize: 13, fontWeight: "700" },
    dataText: { fontSize: 11, color: TEXT_MUTED },

    section: { marginBottom: 16 },
    sectionLabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },

    infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
    infoText: { fontSize: 13, color: "#333", flex: 1 },

    descBox: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER_LIGHT },
    descText: { fontSize: 13, color: "#333", lineHeight: 20 },

    archiveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 12, paddingVertical: 14, marginTop: 8 },
    archiveBtnText: { fontSize: 14, color: "#9e9e9e", fontWeight: "600" },

    archivedNotice: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 12, padding: 14, marginTop: 8 },
    archivedNoticeText: { fontSize: 13, color: "#9e9e9e", flex: 1 },
});
