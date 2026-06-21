import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    Alert,
    Animated,
    BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/auth-context";
import { validateWaterBody, rejectWaterBody } from "@/services/firestore/water_bodies";
import ManagerBottomNav from "@/components/managerbottomnav";
import {
    buscarRegistrosPendentes,
    buscarCorposHidricosComStatus,
    contarEnviadosHoje,
    solicitarAjuste,
    RegistroPendente,
    CorpoHidricoComStatus,
    StatusQualidade,
} from "@/services/firestore/novos_registros";

const PRIMARY = "#004d48";
const ORANGE = "#F97316";
const SUCCESS = "#1a8c80";
const DANGER = "#e05252";

type ActiveTab = "pendentes" | "validados" | "todos";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    if (diffDays === 0) return `Hoje • ${hh}:${mm}`;
    if (diffDays === 1) return `Ontem • ${hh}:${mm}`;
    return `${diffDays} dias atrás • ${hh}:${mm}`;
}

function statusConfig(status: StatusQualidade) {
    switch (status) {
        case "Crítico":
            return { bg: "#FEE2E2", text: "#DC2626", iconColor: "#EF4444" };
        case "Atenção":
            return { bg: "#FFF3E0", text: "#EA580C", iconColor: "#F97316" };
        case "Normal":
            return { bg: "#DCFCE7", text: "#16A34A", iconColor: "#22C55E" };
        default:
            return { bg: "#F3F4F6", text: "#6B7280", iconColor: "#9CA3AF" };
    }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
    icon,
    iconBg,
    iconColor,
    value,
    label,
    fontFamily,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    value: number;
    label: string;
    fontFamily?: string;
}) {
    return (
        <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[styles.statValue, { fontFamily }]}>{value}</Text>
            <Text style={[styles.statLabel, { fontFamily }]}>{label}</Text>
        </View>
    );
}

function PendingCard({
    item,
    questrial,
    onValidar,
    onVerDetalhes,
    onSolicitarAjuste,
    processing,
}: {
    item: RegistroPendente;
    questrial?: string;
    onValidar: (id: string) => void;
    onVerDetalhes: (item: RegistroPendente) => void;
    onSolicitarAjuste: (item: RegistroPendente) => void;
    processing: boolean;
}) {
    const isPending = item.statusRegistro === "aguardando_validacao";
    const tipoFormatado =
        item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1);

    return (
        <View style={styles.pendingCard}>
            {/* Cabeçalho do card */}
            <View style={styles.pendingCardHeader}>
                <View style={styles.pendingAvatar}>
                    <Ionicons name="water" size={22} color={PRIMARY} />
                </View>
                <View style={styles.pendingCardInfo}>
                    <View style={styles.pendingCardTitleRow}>
                        <Text
                            style={[styles.pendingCardTitle, { fontFamily: questrial }]}
                            numberOfLines={1}
                        >
                            {item.nome}
                        </Text>
                        <View style={[styles.statusBadge, isPending ? styles.statusBadgePending : styles.statusBadgeRevisao]}>
                            <Text
                                style={[
                                    styles.statusBadgeText,
                                    { color: isPending ? "#F57C00" : "#E65100", fontFamily: questrial },
                                ]}
                            >
                                {isPending ? "Aguardando validação" : "Necessita revisão"}
                            </Text>
                        </View>
                        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="ellipsis-horizontal" size={16} color="#b0c4c2" />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.pendingCardType, { fontFamily: questrial }]}>
                        {tipoFormatado}
                    </Text>
                </View>
            </View>

            {/* Meta */}
            <View style={styles.pendingMeta}>
                <View style={styles.pendingMetaRow}>
                    <Ionicons name="person-outline" size={13} color="#6b7a7a" />
                    <Text style={[styles.pendingMetaText, { fontFamily: questrial }]}>
                        {`Enviado por ${item.criadoPorTipo}${item.criadoPorNome ? " " + item.criadoPorNome : ""}`}
                    </Text>
                </View>
                <View style={styles.pendingMetaRow}>
                    <Ionicons name="location-outline" size={13} color="#6b7a7a" />
                    <Text style={[styles.pendingMetaText, { fontFamily: questrial }]}>
                        {item.municipio || "Localidade"}
                    </Text>
                    <Text style={[styles.pendingMetaSep, { fontFamily: questrial }]}> | </Text>
                    <Ionicons name="time-outline" size={13} color="#6b7a7a" />
                    <Text style={[styles.pendingMetaText, { fontFamily: questrial }]}>
                        {formatDate(item.dataCriacao)}
                    </Text>
                </View>
            </View>

            {/* Alerta + contadores */}
            <View style={styles.pendingWarningRow}>
                <View style={styles.pendingWarningTag}>
                    <Ionicons name="warning-outline" size={13} color={ORANGE} />
                    <Text style={[styles.pendingWarningLabel, { fontFamily: questrial }]}>
                        Atenção
                    </Text>
                </View>
                <View style={styles.pendingCounters}>
                    <View style={styles.pendingCounter}>
                        <Ionicons name="chatbubble-outline" size={13} color="#6b7a7a" />
                        <Text style={[styles.pendingCounterText, { fontFamily: questrial }]}>
                            {item.comentariosCount}
                        </Text>
                    </View>
                    <View style={styles.pendingCounter}>
                        <Ionicons name="camera-outline" size={13} color="#6b7a7a" />
                        <Text style={[styles.pendingCounterText, { fontFamily: questrial }]}>
                            {item.fotosCount}
                        </Text>
                    </View>
                    <View style={styles.pendingCounter}>
                        <Ionicons name="analytics-outline" size={13} color="#6b7a7a" />
                        <Text style={[styles.pendingCounterText, { fontFamily: questrial }]}>
                            {item.analisesCount}
                        </Text>
                    </View>
                </View>
            </View>
            {item.observacaoAlerta ? (
                <Text style={[styles.pendingWarningText, { fontFamily: questrial }]}>
                    {item.observacaoAlerta}
                </Text>
            ) : null}

            {/* Botões de ação */}
            <View style={styles.pendingActions}>
                <TouchableOpacity
                    style={styles.pendingBtnOutline}
                    onPress={() => onVerDetalhes(item)}
                    activeOpacity={0.75}
                >
                    <Text style={[styles.pendingBtnOutlineText, { fontFamily: questrial }]}>
                        {isPending ? "Ver detalhes" : "Revisar"}
                    </Text>
                </TouchableOpacity>
                {isPending ? (
                    <TouchableOpacity
                        style={[
                            styles.pendingBtnFilled,
                            styles.pendingBtnValidar,
                            processing && styles.btnDisabled,
                        ]}
                        onPress={() => onValidar(item.id)}
                        disabled={processing}
                        activeOpacity={0.75}
                    >
                        {processing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={15} color="#fff" />
                                <Text style={[styles.pendingBtnFilledText, { fontFamily: questrial }]}>
                                    Validar
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.pendingBtnFilled, styles.pendingBtnAjuste]}
                        onPress={() => onSolicitarAjuste(item)}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="create-outline" size={15} color="#fff" />
                        <Text style={[styles.pendingBtnFilledText, { fontFamily: questrial }]}>
                            Solicitar ajuste
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

function ValidatedBodyRow({
    item,
    questrial,
}: {
    item: CorpoHidricoComStatus;
    questrial?: string;
}) {
    const cfg = statusConfig(item.statusQualidade);
    return (
        <View style={styles.validatedRow}>
            <View style={[styles.validatedIcon, { backgroundColor: cfg.bg }]}>
                <Ionicons name="water" size={18} color={cfg.iconColor} />
            </View>
            <View style={styles.validatedInfo}>
                <Text
                    style={[styles.validatedName, { fontFamily: questrial }]}
                    numberOfLines={1}
                >
                    {item.nome}
                </Text>
                <View style={[styles.validatedBadge, { backgroundColor: cfg.bg }]}>
                    <Text
                        style={[
                            styles.validatedBadgeText,
                            { color: cfg.text, fontFamily: questrial },
                        ]}
                    >
                        {item.statusQualidade}
                    </Text>
                </View>
            </View>
            <View style={styles.validatedMeta}>
                <Text style={[styles.validatedMetaDate, { fontFamily: questrial }]}>
                    {formatDate(item.ultimaAtualizacao)}
                </Text>
                <Text style={[styles.validatedMetaDateLabel, { fontFamily: questrial }]}>
                    Última atualização
                </Text>
            </View>
            <View style={styles.validatedCountBox}>
                <Text style={[styles.validatedCount, { fontFamily: questrial }]}>
                    {item.totalAnalises}
                </Text>
                <Text style={[styles.validatedCountLabel, { fontFamily: questrial }]}>
                    Análises
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#b0c4c2" />
        </View>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function NovosRegistros() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [locationText, setLocationText] = useState("Região Metropolitana do Recife");
    const [activeTab, setActiveTab] = useState<ActiveTab>("pendentes");
    const [searchText, setSearchText] = useState("");

    const [pendentes, setPendentes] = useState<RegistroPendente[]>([]);
    const [validados, setValidados] = useState<CorpoHidricoComStatus[]>([]);
    const [enviadosHoje, setEnviadosHoje] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Modal de detalhes / validação
    const [detailItem, setDetailItem] = useState<RegistroPendente | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    // Modal de ajuste
    const [ajusteItem, setAjusteItem] = useState<RegistroPendente | null>(null);
    const [ajusteModalVisible, setAjusteModalVisible] = useState(false);
    const [ajusteMotivo, setAjusteMotivo] = useState("");

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    useFocusEffect(
        React.useCallback(() => {
            const back = BackHandler.addEventListener("hardwareBackPress", () => {
                router.replace("/(tabs)/home_manager" as any);
                return true;
            });
            return () => back.remove();
        }, [])
    );

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]).start();

        fetchData();

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
                    if (city || state)
                        setLocationText(`${city}${state ? " • " + state : ""}`);
                }
            } catch {
                // mantém o default
            }
        })();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [pend, val, hoje] = await Promise.all([
                buscarRegistrosPendentes(),
                buscarCorposHidricosComStatus(),
                contarEnviadosHoje(),
            ]);
            setPendentes(pend);
            setValidados(val);
            setEnviadosHoje(hoje);
        } catch (err) {
            console.error("[novos_registros] fetch:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleValidar(id: string) {
        if (!userProfile) return;
        setProcessingId(id);
        try {
            await validateWaterBody(id, userProfile.uid);
            setPendentes((prev) => prev.filter((p) => p.id !== id));
            Alert.alert("Sucesso", "Corpo hídrico validado com sucesso!");
        } catch {
            Alert.alert("Erro", "Não foi possível validar o corpo hídrico.");
        } finally {
            setProcessingId(null);
        }
    }

    async function handleRejeitar() {
        if (!userProfile || !detailItem || !rejectReason.trim()) {
            Alert.alert("Atenção", "Informe um motivo para rejeitar.");
            return;
        }
        setProcessingId(detailItem.id);
        try {
            await rejectWaterBody(detailItem.id, userProfile.uid, rejectReason);
            setPendentes((prev) => prev.filter((p) => p.id !== detailItem.id));
            setModalVisible(false);
            setDetailItem(null);
            setRejectReason("");
            Alert.alert("Concluído", "Cadastro rejeitado.");
        } catch {
            Alert.alert("Erro", "Não foi possível rejeitar o cadastro.");
        } finally {
            setProcessingId(null);
        }
    }

    async function handleSolicitarAjuste() {
        if (!ajusteItem || !ajusteMotivo.trim()) {
            Alert.alert("Atenção", "Informe o motivo do ajuste.");
            return;
        }
        try {
            await solicitarAjuste(ajusteItem.id, ajusteMotivo);
            setPendentes((prev) =>
                prev.map((p) =>
                    p.id === ajusteItem.id
                        ? { ...p, statusRegistro: "necessita_revisao" as const }
                        : p
                )
            );
            setAjusteModalVisible(false);
            setAjusteItem(null);
            setAjusteMotivo("");
            Alert.alert("Concluído", "Ajuste solicitado com sucesso.");
        } catch {
            Alert.alert("Erro", "Não foi possível solicitar ajuste.");
        }
    }

    const filteredPendentes = pendentes.filter(
        (p) =>
            p.nome.toLowerCase().includes(searchText.toLowerCase()) ||
            p.municipio.toLowerCase().includes(searchText.toLowerCase()) ||
            p.criadoPorNome.toLowerCase().includes(searchText.toLowerCase())
    );
    const filteredValidados = validados.filter(
        (v) =>
            v.nome.toLowerCase().includes(searchText.toLowerCase()) ||
            v.municipio.toLowerCase().includes(searchText.toLowerCase())
    );

    const showPendentes = activeTab === "pendentes" || activeTab === "todos";
    const showValidados = activeTab === "validados" || activeTab === "todos";

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
                    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
                        <Animated.View
                            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
                        >
                            <View style={styles.headerTopRow}>
                                <TouchableOpacity
                                    onPress={() => router.replace("/(tabs)/home_manager" as any)}
                                    style={styles.backBtn}
                                >
                                    <Ionicons name="chevron-back" size={26} color="#fff" />
                                </TouchableOpacity>
                                <View style={styles.gestorBadge}>
                                    <Text style={styles.gestorBadgeText}>Gestor</Text>
                                </View>
                            </View>
                            <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                                Novos registros
                            </Text>
                            <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                                Cadastros e corpos hídricos da sua região
                            </Text>
                            <View style={styles.headerLocRow}>
                                <Ionicons
                                    name="location-outline"
                                    size={13}
                                    color="rgba(255,255,255,0.75)"
                                />
                                <Text style={[styles.headerLocText, { fontFamily: questrial }]}>
                                    {locationText}
                                </Text>
                            </View>
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ BUSCA ══ */}
                <View style={styles.searchRow}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                        <TextInput
                            style={[styles.searchInput, { fontFamily: questrial }]}
                            placeholder="Buscar corpo hídrico, região ou usuário..."
                            placeholderTextColor="#9CA3AF"
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchText("")}>
                                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity style={styles.filterBtn} activeOpacity={0.75}>
                        <Ionicons name="options-outline" size={18} color={PRIMARY} />
                        <Text style={[styles.filterBtnText, { fontFamily: questrial }]}>
                            Filtros
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ══ ABAS ══ */}
                <View style={styles.tabsRow}>
                    {(["pendentes", "validados", "todos"] as ActiveTab[]).map((tab) => {
                        const count =
                            tab === "pendentes"
                                ? pendentes.length
                                : tab === "validados"
                                ? validados.length
                                : pendentes.length + validados.length;
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, isActive && styles.tabActive]}
                                onPress={() => setActiveTab(tab)}
                                activeOpacity={0.75}
                            >
                                <Ionicons
                                    name={
                                        tab === "pendentes"
                                            ? isActive ? "time" : "time-outline"
                                            : tab === "validados"
                                            ? isActive ? "checkmark-circle" : "checkmark-circle-outline"
                                            : "list"
                                    }
                                    size={14}
                                    color={isActive ? PRIMARY : "#9CA3AF"}
                                />
                                <Text
                                    style={[
                                        styles.tabText,
                                        { fontFamily: questrial },
                                        isActive && styles.tabTextActive,
                                    ]}
                                >
                                    {tab === "pendentes"
                                        ? "Pendentes"
                                        : tab === "validados"
                                        ? "Validados"
                                        : "Todos"}
                                </Text>
                                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                                    <Text
                                        style={[
                                            styles.tabBadgeText,
                                            isActive && styles.tabBadgeTextActive,
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ══ CONTEÚDO ══ */}
                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={PRIMARY} />
                    </View>
                ) : (
                    <ScrollView
                        style={styles.body}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 32 }}
                    >
                        <Animated.View style={{ opacity: fadeAnim }}>

                            {/* ── Estatísticas ── */}
                            <View style={styles.statsRow}>
                                <StatCard
                                    icon="time-outline"
                                    iconBg="#FFF3E0"
                                    iconColor="#F57C00"
                                    value={pendentes.length}
                                    label={"Aguardando\nvalidação"}
                                    fontFamily={questrial}
                                />
                                <StatCard
                                    icon="water-outline"
                                    iconBg="#E0F2F1"
                                    iconColor={SUCCESS}
                                    value={pendentes.length + validados.length}
                                    label={"Corpos\nregistrados"}
                                    fontFamily={questrial}
                                />
                                <StatCard
                                    icon="paper-plane-outline"
                                    iconBg="#EDE9FE"
                                    iconColor="#7C3AED"
                                    value={enviadosHoje}
                                    label={"Enviados\nhoje"}
                                    fontFamily={questrial}
                                />
                            </View>

                            {/* ── Pendentes ── */}
                            {showPendentes && (
                                <View style={styles.section}>
                                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                        Aguardando validação
                                    </Text>
                                    {filteredPendentes.length === 0 ? (
                                        <View style={styles.emptyState}>
                                            <Ionicons
                                                name="checkmark-circle-outline"
                                                size={48}
                                                color="#22C55E"
                                            />
                                            <Text style={[styles.emptyStateText, { fontFamily: questrial }]}>
                                                Nenhum registro pendente
                                            </Text>
                                        </View>
                                    ) : (
                                        filteredPendentes.map((item) => (
                                            <PendingCard
                                                key={item.id}
                                                item={item}
                                                questrial={questrial}
                                                onValidar={handleValidar}
                                                onVerDetalhes={(it) => {
                                                    setDetailItem(it);
                                                    setRejectReason("");
                                                    setModalVisible(true);
                                                }}
                                                onSolicitarAjuste={(it) => {
                                                    setAjusteItem(it);
                                                    setAjusteMotivo("");
                                                    setAjusteModalVisible(true);
                                                }}
                                                processing={processingId === item.id}
                                            />
                                        ))
                                    )}
                                </View>
                            )}

                            {/* ── Validados ── */}
                            {showValidados && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text
                                            style={[styles.sectionTitle, { fontFamily: questrial }]}
                                        >
                                            Corpos hídricos registrados na sua região
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setActiveTab("validados")}
                                            activeOpacity={0.75}
                                        >
                                            <Text style={[styles.verTodosText, { fontFamily: questrial }]}>
                                                Ver todos ›
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    {filteredValidados.length === 0 ? (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="water-outline" size={48} color="#b0c4c2" />
                                            <Text style={[styles.emptyStateText, { fontFamily: questrial }]}>
                                                Nenhum corpo validado ainda
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.validatedList}>
                                            {filteredValidados.map((item) => (
                                                <ValidatedBodyRow
                                                    key={item.id}
                                                    item={item}
                                                    questrial={questrial}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                        </Animated.View>
                    </ScrollView>
                )}

                {/* ══ BOTTOM NAV ══ */}
                <ManagerBottomNav fontFamily={questrial} />

                {/* ══ MODAL DE DETALHES ══ */}
                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setModalVisible(false)}
                >
                    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(false);
                                    setDetailItem(null);
                                }}
                            >
                                <Ionicons name="close" size={26} color={PRIMARY} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                Detalhes do Registro
                            </Text>
                            <View style={{ width: 26 }} />
                        </View>
                        <ScrollView
                            style={styles.modalContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {detailItem && (
                                <>
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.modalSectionTitle, { fontFamily: questrial }]}>
                                            Identificação
                                        </Text>
                                        <View style={styles.modalField}>
                                            <Text style={[styles.modalLabel, { fontFamily: questrial }]}>Nome</Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {detailItem.nome}
                                            </Text>
                                        </View>
                                        <View style={styles.modalField}>
                                            <Text style={[styles.modalLabel, { fontFamily: questrial }]}>Tipo</Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {detailItem.tipo}
                                            </Text>
                                        </View>
                                        <View style={styles.modalField}>
                                            <Text style={[styles.modalLabel, { fontFamily: questrial }]}>
                                                Localidade
                                            </Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {detailItem.municipio || "Não informado"}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.modalSectionTitle, { fontFamily: questrial }]}>
                                            Envio
                                        </Text>
                                        <View style={styles.modalField}>
                                            <Text style={[styles.modalLabel, { fontFamily: questrial }]}>
                                                Enviado por
                                            </Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {detailItem.criadoPorTipo}
                                                {detailItem.criadoPorNome
                                                    ? " " + detailItem.criadoPorNome
                                                    : ""}
                                            </Text>
                                        </View>
                                        <View style={styles.modalField}>
                                            <Text style={[styles.modalLabel, { fontFamily: questrial }]}>Data</Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {formatDate(detailItem.dataCriacao)}
                                            </Text>
                                        </View>
                                    </View>
                                    {detailItem.observacaoAlerta ? (
                                        <View style={styles.modalSection}>
                                            <Text
                                                style={[styles.modalSectionTitle, { fontFamily: questrial }]}
                                            >
                                                Observações
                                            </Text>
                                            <Text style={[styles.modalValue, { fontFamily: questrial }]}>
                                                {detailItem.observacaoAlerta}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.modalSectionTitle, { fontFamily: questrial }]}>
                                            Rejeitar cadastro
                                        </Text>
                                        <Text style={[styles.modalLabel, { fontFamily: questrial }]}>
                                            Motivo da rejeição (obrigatório para rejeitar):
                                        </Text>
                                        <TextInput
                                            style={[styles.rejectInput, { fontFamily: questrial }]}
                                            placeholder="Ex: Localização incorreta, dados incompletos..."
                                            placeholderTextColor="#b0c4c2"
                                            multiline
                                            numberOfLines={3}
                                            value={rejectReason}
                                            onChangeText={setRejectReason}
                                        />
                                    </View>
                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.btnRejeitar,
                                                processingId === detailItem.id && styles.btnDisabled,
                                            ]}
                                            onPress={handleRejeitar}
                                            disabled={processingId === detailItem.id}
                                            activeOpacity={0.75}
                                        >
                                            {processingId === detailItem.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="trash-outline" size={16} color="#fff" />
                                                    <Text style={[styles.btnText, { fontFamily: questrial }]}>
                                                        Rejeitar
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.btnValidar,
                                                processingId === detailItem.id && styles.btnDisabled,
                                            ]}
                                            onPress={() => {
                                                const id = detailItem.id;
                                                setModalVisible(false);
                                                setDetailItem(null);
                                                handleValidar(id);
                                            }}
                                            disabled={processingId === detailItem.id}
                                            activeOpacity={0.75}
                                        >
                                            {processingId === detailItem.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                                    <Text style={[styles.btnText, { fontFamily: questrial }]}>
                                                        Validar
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>

                {/* ══ MODAL DE AJUSTE ══ */}
                <Modal
                    visible={ajusteModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setAjusteModalVisible(false)}
                >
                    <View style={styles.ajusteOverlay}>
                        <View style={styles.ajusteBox}>
                            <View style={styles.ajusteBoxHeader}>
                                <Text style={[styles.modalTitle, { fontFamily: questrial, textAlign: "left" }]}>
                                    Solicitar Ajuste
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setAjusteModalVisible(false);
                                        setAjusteItem(null);
                                    }}
                                >
                                    <Ionicons name="close" size={24} color={PRIMARY} />
                                </TouchableOpacity>
                            </View>
                            {ajusteItem && (
                                <Text style={[styles.modalLabel, { fontFamily: questrial, marginBottom: 4 }]}>
                                    {ajusteItem.nome}
                                </Text>
                            )}
                            <Text style={[styles.modalLabel, { fontFamily: questrial, marginBottom: 8, marginTop: 12 }]}>
                                Descreva o que precisa ser corrigido:
                            </Text>
                            <TextInput
                                style={[styles.rejectInput, { fontFamily: questrial }]}
                                placeholder="Ex: Corrija a localização do ponto, adicione fotos do local..."
                                placeholderTextColor="#b0c4c2"
                                multiline
                                numberOfLines={4}
                                value={ajusteMotivo}
                                onChangeText={setAjusteMotivo}
                            />
                            <View style={[styles.modalActions, { marginTop: 16 }]}>
                                <TouchableOpacity
                                    style={styles.btnCancelar}
                                    onPress={() => {
                                        setAjusteModalVisible(false);
                                        setAjusteItem(null);
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.btnCancelarText, { fontFamily: questrial }]}>
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.pendingBtnFilled, styles.pendingBtnAjuste, { flex: 1, paddingVertical: 12 }]}
                                    onPress={handleSolicitarAjuste}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="create-outline" size={16} color="#fff" />
                                    <Text style={[styles.btnText, { fontFamily: questrial }]}>
                                        Confirmar ajuste
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </View>
        </>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },

    // Header
    headerGradient: {},
    headerSafe: { paddingBottom: 16 },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        marginBottom: 8,
    },
    backBtn: { padding: 4 },
    gestorBadge: {
        backgroundColor: "rgba(255,255,255,0.18)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    gestorBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
    headerTitle: { fontSize: 24, fontWeight: "700", color: "#FFFFFF", paddingHorizontal: 16, marginBottom: 4 },
    headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", paddingHorizontal: 16, marginBottom: 8 },
    headerLocRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 4 },
    headerLocText: { fontSize: 12, color: "rgba(255,255,255,0.75)" },

    // Busca
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F5F9F8",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 13, color: "#1a1a1a", padding: 0 },
    filterBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E0F2F1",
    },
    filterBtnText: { fontSize: 13, color: PRIMARY, fontWeight: "600" },

    // Abas
    tabsRow: {
        flexDirection: "row",
        backgroundColor: "#fff",
        paddingHorizontal: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        gap: 4,
        borderRadius: 8,
    },
    tabActive: { backgroundColor: "#E0F2F1" },
    tabText: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
    tabTextActive: { color: PRIMARY, fontWeight: "700" },
    tabBadge: { backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    tabBadgeActive: { backgroundColor: PRIMARY },
    tabBadgeText: { fontSize: 10, color: "#6B7280", fontWeight: "600" },
    tabBadgeTextActive: { color: "#FFFFFF" },

    // Loading / body
    loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
    body: { flex: 1 },

    // Estatísticas
    statsRow: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        gap: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    statValue: { fontSize: 20, fontWeight: "700", color: PRIMARY },
    statLabel: { fontSize: 10, color: "#6B7280", textAlign: "center", lineHeight: 14 },

    // Seção
    section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 12, flexShrink: 1 },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        gap: 8,
    },
    verTodosText: { fontSize: 13, color: PRIMARY, fontWeight: "600" },

    // Card pendente
    pendingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    pendingCardHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
    pendingAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#E0F2F1",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    pendingCardInfo: { flex: 1 },
    pendingCardTitleRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 6,
        marginBottom: 4,
    },
    pendingCardTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", flex: 1 },
    statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
    statusBadgePending: { backgroundColor: "#FFF3E0" },
    statusBadgeRevisao: { backgroundColor: "#FEF3E0", borderWidth: 1, borderColor: "#F97316" },
    statusBadgeText: { fontSize: 9, fontWeight: "700" },
    pendingCardType: { fontSize: 12, color: "#6b7a7a" },
    pendingMeta: { gap: 4, marginBottom: 10 },
    pendingMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    pendingMetaText: { fontSize: 11, color: "#6b7a7a" },
    pendingMetaSep: { fontSize: 11, color: "#c4cfcf" },
    pendingWarningRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    pendingWarningTag: { flexDirection: "row", alignItems: "center", gap: 4 },
    pendingWarningLabel: { fontSize: 12, color: ORANGE, fontWeight: "600" },
    pendingCounters: { flexDirection: "row", gap: 10 },
    pendingCounter: { flexDirection: "row", alignItems: "center", gap: 3 },
    pendingCounterText: { fontSize: 12, color: "#6b7a7a" },
    pendingWarningText: { fontSize: 12, color: "#6b7a7a", lineHeight: 17, marginBottom: 10 },
    pendingActions: {
        flexDirection: "row",
        gap: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#E0F2F1",
    },
    pendingBtnOutline: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#d0d8d8",
        alignItems: "center",
        justifyContent: "center",
    },
    pendingBtnOutlineText: { fontSize: 13, color: "#6b7a7a", fontWeight: "600" },
    pendingBtnFilled: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    pendingBtnFilledText: { fontSize: 13, color: "#fff", fontWeight: "700" },
    pendingBtnValidar: { backgroundColor: PRIMARY },
    pendingBtnAjuste: { backgroundColor: ORANGE },
    btnDisabled: { opacity: 0.6 },

    // Lista de validados
    validatedList: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    validatedRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F9F8",
        gap: 10,
    },
    validatedIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    validatedInfo: { flex: 1, gap: 4 },
    validatedName: { fontSize: 13, fontWeight: "700", color: "#1a1a1a" },
    validatedBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" },
    validatedBadgeText: { fontSize: 9, fontWeight: "700" },
    validatedMeta: { alignItems: "flex-end" },
    validatedMetaDate: { fontSize: 10, color: "#6b7a7a", fontWeight: "600" },
    validatedMetaDateLabel: { fontSize: 9, color: "#b0c4c2" },
    validatedCountBox: { alignItems: "flex-end", minWidth: 46 },
    validatedCount: { fontSize: 13, fontWeight: "700", color: PRIMARY },
    validatedCountLabel: { fontSize: 9, color: "#b0c4c2" },

    // Empty
    emptyState: { paddingVertical: 32, alignItems: "center", gap: 10 },
    emptyStateText: { fontSize: 14, color: "#9CA3AF" },

    // Modal detalhes
    modal: { flex: 1, backgroundColor: "#F5F9F8" },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#E0F2F1",
    },
    modalTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY, flex: 1, textAlign: "center" },
    modalContent: { flex: 1, padding: 16 },
    modalSection: { marginBottom: 24 },
    modalSectionTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 10 },
    modalField: { marginBottom: 10 },
    modalLabel: { fontSize: 11, color: "#6b7a7a", fontWeight: "600", marginBottom: 3 },
    modalValue: { fontSize: 13, color: "#1a1a1a", lineHeight: 18 },
    rejectInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#d0d8d8",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 80,
        textAlignVertical: "top",
        color: "#1a1a1a",
        fontSize: 13,
        marginTop: 6,
    },
    modalActions: { flexDirection: "row", gap: 10, paddingBottom: 24 },
    btnRejeitar: {
        flex: 1,
        backgroundColor: DANGER,
        borderRadius: 10,
        paddingVertical: 12,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
    btnValidar: {
        flex: 1,
        backgroundColor: SUCCESS,
        borderRadius: 10,
        paddingVertical: 12,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
    btnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
    btnCancelar: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "#d0d8d8",
        alignItems: "center",
        justifyContent: "center",
    },
    btnCancelarText: { fontSize: 13, color: "#6b7a7a", fontWeight: "600" },

    // Modal ajuste
    ajusteOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    ajusteBox: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 32,
    },
    ajusteBoxHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
});