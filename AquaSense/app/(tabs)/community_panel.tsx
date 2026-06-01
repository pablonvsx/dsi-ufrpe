/**
 * community_panel.tsx
 *
 * Painel Comunitário — AquaSense
 * Dados alimentados por: services/firestore/community.ts
 */

import React, { useRef, useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Platform,
    Animated,
    Dimensions,
    Image,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import Svg, { Polyline, Rect } from "react-native-svg";


import { useAuth } from "@/contexts/auth-context";
import {
    getCommunityPanelData,
    type AtividadeComunidade,
    type CommunityStats,
    type TipoAtividade,
} from "@/services/firestore/community";

const PRIMARY = "#004d48";
const TEAL_MED = "#0d6e52";
const TEXT_MUTED = "#6b7a7a";
const ORANGE = "#e07b1e";

type TabKey = "home" | "mapa" | "alertas" | "perfil";
type FilterKey = "todas" | "contribuicoes" | "denuncias" | "acoes";

interface CorpoHidrico {
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarData(date: Date): string {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);
    const ontemInicio = new Date(hojeInicio.getTime() - 86400000);

    if (date >= hojeInicio) {
        return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date >= ontemInicio) {
        return `Ontem, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${date.toLocaleDateString("pt-BR")} • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function tipoIcone(tipo: TipoAtividade): {
    iconName: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    thumbBg: string;
    thumbIcon: keyof typeof Ionicons.glyphMap;
} {
    switch (tipo) {
        case "contribuicao":
            return { iconName: "flask-outline", iconBg: "#e6f5ef", iconColor: TEAL_MED, thumbBg: "#b8dfc4", thumbIcon: "water" };
        case "denuncia":
            return { iconName: "megaphone-outline", iconBg: "#fff0e6", iconColor: ORANGE, thumbBg: "#f0c8a0", thumbIcon: "warning-outline" };
        case "acao":
            return { iconName: "people-outline", iconBg: "#e8f0ff", iconColor: "#2563c7", thumbBg: "#c8dff0", thumbIcon: "people" };
        case "observacao":
        default:
            return { iconName: "leaf-outline", iconBg: "#f0faf0", iconColor: "#4a9e5e", thumbBg: "#c8e8c8", thumbIcon: "leaf" };
    }
}

// ─── Mini charts ─────────────────────────────────────────────────────────────

function MiniLineChart({ color = TEAL_MED }: { color?: string }) {
    return (
        <Svg width={65} height={28} style={{ marginTop: 6 }}>
            <Polyline
                points="0,20 10,16 20,18 30,10 40,12 50,6 60,8"
                fill="none" stroke={color} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round"
            />
        </Svg>
    );
}

function MiniBarChart() {
    const bars = [10, 16, 12, 20, 14, 18, 22, 16, 20, 24, 18, 26];
    const maxH = 24;
    return (
        <Svg width={65} height={28} style={{ marginTop: 6 }}>
            {bars.map((h, i) => {
                const barH = (h / 30) * maxH;
                return <Rect key={i} x={i * 5.5} y={maxH - barH} width={4} height={barH} rx={1.5} fill={TEAL_MED} opacity={0.75} />;
            })}
        </Svg>
    );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
    icon, iconOutline, label, active, fontFamily, onPress, badge,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
    fontFamily?: string;
    onPress: () => void;
    badge?: number;
}) {
    return (
        <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
            <View style={{ position: "relative" }}>
                <Ionicons name={active ? icon : iconOutline} size={24} color={active ? PRIMARY : "#b0c4c2"} />
                {badge !== undefined && badge > 0 && (
                    <View style={styles.navBadge}>
                        <Text style={styles.navBadgeText}>{badge}</Text>
                    </View>
                )}
            </View>
            <Text style={[styles.navLabel, { fontFamily, color: active ? PRIMARY : "#b0c4c2" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
    iconName, titulo, descricao, fontFamily, onAction, actionLabel,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    titulo: string;
    descricao: string;
    fontFamily?: string;
    onAction?: () => void;
    actionLabel?: string;
}) {
    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
                <Ionicons name={iconName} size={26} color={TEXT_MUTED} />
            </View>
            <Text style={[styles.emptyTitulo, { fontFamily }]}>{titulo}</Text>
            <Text style={[styles.emptyDescricao, { fontFamily }]}>{descricao}</Text>
            {onAction && actionLabel && (
                <TouchableOpacity style={styles.emptyBtn} onPress={onAction} activeOpacity={0.8}>
                    <Text style={[styles.emptyBtnText, { fontFamily }]}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CommunityPanel() {
    const router = useRouter();
    const { userProfile } = useAuth();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [activeTab, setActiveTab] = useState<TabKey>("alertas");
    const [activeFilter, setActiveFilter] = useState<FilterKey>("todas");

    // ── Estado de dados ─────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [corpoHidrico, setCorpoHidrico] = useState<CorpoHidrico | null>(null);
    const [areaLabel, setAreaLabel] = useState<string | null>(null);
    const [stats, setStats] = useState<CommunityStats>({
        contribuicoes: 0,
        denuncias: 0,
        participantes: 0,
        acoes: 0,
    });
    const [atividades, setAtividades] = useState<AtividadeComunidade[]>([]);

    // ── Animações ───────────────────────────────────────────────────────────
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(cardFade, { toValue: 1, duration: 420, useNativeDriver: true }),
                Animated.timing(cardSlide, { toValue: 0, duration: 420, useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    // ── Busca de dados via service ──────────────────────────────────────────
    useEffect(() => {
        if (!userProfile?.uid) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Resolve painel em uma única chamada
                const { contexto, stats: s, atividades: a } =
                    await getCommunityPanelData(userProfile.uid);

                setStats(s);
                setAtividades(a);

                const area = [
                    contexto.bairro,
                    contexto.cidade,
                    contexto.estado,
                ].filter(Boolean).join(" - ");

                setAreaLabel(area || contexto.areaChave || null);

                
                if (contexto.corpoHidrico) {
                    setCorpoHidrico({
                        id: contexto.corpoHidrico.id,
                        nome: contexto.corpoHidrico.nome,
                        cidade: contexto.corpoHidrico.cidade ?? "",
                        estado: contexto.corpoHidrico.estado ?? "",
                    });
                } else {
                    setCorpoHidrico(null);
                }
                
            } catch (err) {
                console.error("[CommunityPanel] fetchData:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userProfile?.uid]);

    // ── Filtro local de atividades ──────────────────────────────────────────
    const atividadesFiltradas = atividades.filter((a) => {
        if (activeFilter === "todas") return true;
        if (activeFilter === "contribuicoes") return a.tipo === "contribuicao" || a.tipo === "observacao";
        if (activeFilter === "denuncias") return a.tipo === "denuncia";
        if (activeFilter === "acoes") return a.tipo === "acao";
        return true;
    });

    function handleTabPress(tab: TabKey) {
        setActiveTab(tab);
        switch (tab) {
            case "home": router.replace("/home_collaborator_update" as any); break;
            case "mapa": router.push("/map" as any); break;
            case "alertas": router.push("/alerts" as any); break;
            case "perfil": router.push("/profile_collaborator" as any); break;
        }
    }

    const FILTERS: { key: FilterKey; label: string; dotColor?: string }[] = [
        { key: "todas", label: "Todas" },
        { key: "contribuicoes", label: "Contribuições", dotColor: TEAL_MED },
        { key: "denuncias", label: "Denúncias", dotColor: ORANGE },
        { key: "acoes", label: "Ações", dotColor: "#2563c7" },
    ];

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
                            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                                <Ionicons name="arrow-back" size={20} color="#e8f5f0" />
                            </TouchableOpacity>
                            <View style={{ flex: 1, paddingLeft: 14 }}>
                                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Painel comunitário</Text>
                                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                                    Acompanhe o que está acontecendo na sua comunidade.
                                </Text>
                            </View>
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require("../../assets/images/aquasense.png")}
                                    style={styles.logoHeader}
                                    resizeMode="contain"
                                />
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

                        {/* ── CARD CORPO HÍDRICO ─────────────────────────── */}
                        {loading ? (
                            <View style={[styles.corpoCard, { alignItems: "center", justifyContent: "center", paddingVertical: 32 }]}>
                                <ActivityIndicator color={TEAL_MED} size="small" />
                            </View>
                        ) : corpoHidrico ? (
                            <View style={styles.corpoCard}>
                                <View style={styles.corpoCardContent}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.corpoLabelRow}>
                                            <View style={styles.corpoIconCircle}>
                                                <Ionicons name="water" size={16} color={TEAL_MED} />
                                            </View>
                                            <Text style={[styles.corpoLabelText, { fontFamily: questrial }]}>
                                                Comunidade monitorada
                                            </Text>
                                        </View>
                                        <Text style={[styles.corpoNome, { fontFamily: questrial }]}>{corpoHidrico.nome}</Text>
                                        {areaLabel && (
                                            <View style={styles.corpoLocRow}>
                                                <Ionicons name="location-outline" size={11} color={TEXT_MUTED} />
                                                <Text style={[styles.corpoLoc, { fontFamily: questrial }]}>
                                                    {areaLabel}
                                                </Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            style={styles.verMapaBtn}
                                            onPress={() => router.push("/map" as any)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.verMapaBtnText, { fontFamily: questrial }]}>Ver no mapa</Text>
                                            <Ionicons name="map-outline" size={14} color="#1a2e26" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.corpoIlustracao}>
                                        <LinearGradient colors={["#a8d8b8", "#7ec8a0", "#5ab888"]} style={styles.corpoIlustracaoGrad}>
                                            <Ionicons name="water" size={40} color="#2a8050" style={{ opacity: 0.6 }} />
                                            <View style={styles.bridgeDecor}>
                                                <Ionicons name="business-outline" size={18} color="#2a8050" style={{ opacity: 0.4 }} />
                                            </View>
                                        </LinearGradient>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.corpoCard}>
                                <EmptyState
                                    iconName="map-outline"
                                    titulo="Nenhuma comunidade identificada"
                                    descricao="Complete sua localização no perfil ou acesse o mapa para gerar dados comunitários."
                                    fontFamily={questrial}
                                    onAction={() => router.push("/map" as any)}
                                    actionLabel="Abrir mapa"
                                />
                            </View>
                        )}

                        {/* ── RESUMO DA COMUNIDADE ───────────────────────── */}
                        <View style={styles.resumoCard}>
                            <ResumoItem iconName="flask-outline" iconBg={TEAL_MED} value={String(stats.contribuicoes)} label="Contribuições" sub="Este mês" fontFamily={questrial} />
                            <View style={styles.resumoDivider} />
                            <ResumoItem iconName="megaphone-outline" iconBg={ORANGE} value={String(stats.denuncias)} label="Denúncias" sub="Este mês" fontFamily={questrial} />
                            <View style={styles.resumoDivider} />
                            <ResumoItem iconName="people-outline" iconBg="#2563c7" value={String(stats.participantes)} label="Participantes" sub="Ativos" fontFamily={questrial} />
                            <View style={styles.resumoDivider} />
                            <ResumoItem iconName="leaf-outline" iconBg="#4a9e5e" value={String(stats.acoes)} label="Ações realizadas" sub="Este mês" fontFamily={questrial} />
                        </View>

                        {/* ── INDICADORES ────────────────────────────────── */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Indicadores da comunidade</Text>
                            <TouchableOpacity activeOpacity={0.7}>
                                <View style={styles.verTodasRow}>
                                    <Text style={[styles.verTodasText, { fontFamily: questrial }]}>Ver detalhes</Text>
                                    <Ionicons name="chevron-forward" size={13} color={TEAL_MED} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.indicadoresRow}>
                            <View style={[styles.indicadorCard, { flex: 1 }]}>
                                <View style={styles.indicadorHeaderRow}>
                                    <View style={[styles.indicadorIconCircle, { backgroundColor: "#e0f4ee" }]}>
                                        <Ionicons name="water-outline" size={14} color={TEAL_MED} />
                                    </View>
                                    <Text style={[styles.indicadorLabel, { fontFamily: questrial }]}>Qualidade da água</Text>
                                </View>
                                {stats.contribuicoes > 0 ? (
                                    <>
                                        <Text style={[styles.indicadorValue, { fontFamily: questrial, color: TEAL_MED }]}>Boa</Text>
                                        <Text style={[styles.indicadorSub, { fontFamily: questrial }]}>Tendência: Estável</Text>
                                        <MiniLineChart color={TEAL_MED} />
                                    </>
                                ) : (
                                    <Text style={[styles.indicadorSub, { fontFamily: questrial, marginTop: 4 }]}>Sem medições</Text>
                                )}
                            </View>

                            <View style={[styles.indicadorCard, { flex: 1 }]}>
                                <View style={styles.indicadorHeaderRow}>
                                    <View style={[styles.indicadorIconCircle, { backgroundColor: "#e8f0ff" }]}>
                                        <Ionicons name="trash-outline" size={14} color="#2563c7" />
                                    </View>
                                    <Text style={[styles.indicadorLabel, { fontFamily: questrial }]}>Resíduos coletados</Text>
                                </View>
                                {stats.acoes > 0 ? (
                                    <>
                                        <Text style={[styles.indicadorValue, { fontFamily: questrial, color: "#1a2e26" }]}>
                                            {stats.acoes * 10} kg
                                        </Text>
                                        <Text style={[styles.indicadorSub, { fontFamily: questrial }]}>Este mês</Text>
                                        <MiniBarChart />
                                    </>
                                ) : (
                                    <Text style={[styles.indicadorSub, { fontFamily: questrial, marginTop: 4 }]}>Sem registros</Text>
                                )}
                            </View>

                            <View style={[styles.indicadorCard, { flex: 1 }]}>
                                <View style={styles.indicadorHeaderRow}>
                                    <View style={[styles.indicadorIconCircle, { backgroundColor: "#f0faf0" }]}>
                                        <Ionicons name="leaf-outline" size={14} color="#4a9e5e" />
                                    </View>
                                    <Text style={[styles.indicadorLabel, { fontFamily: questrial }]}>Áreas limpas</Text>
                                </View>
                                {stats.acoes > 0 ? (
                                    <>
                                        <Text style={[styles.indicadorValue, { fontFamily: questrial, color: "#1a2e26" }]}>{stats.acoes}</Text>
                                        <Text style={[styles.indicadorSub, { fontFamily: questrial }]}>Este mês</Text>
                                        <MiniLineChart color="#4a9e5e" />
                                    </>
                                ) : (
                                    <Text style={[styles.indicadorSub, { fontFamily: questrial, marginTop: 4 }]}>Sem registros</Text>
                                )}
                            </View>
                        </View>

                        {/* ── CARD DESTAQUE ──────────────────────────────── */}
                        <View style={styles.destaqueCard}>
                            <View style={styles.destaqueIconCircle}>
                                <Ionicons name="star" size={20} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.destaqueTitle, { fontFamily: questrial }]}>Parabéns, comunidade!</Text>
                                <Text style={[styles.destaqueBody, { fontFamily: questrial }]}>
                                    Sua participação está fazendo a diferença.{"\n"}Continuem assim!
                                </Text>
                            </View>
                        </View>

                        {/* ── ATIVIDADES ─────────────────────────────────── */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Atividades da comunidade</Text>
                            <TouchableOpacity activeOpacity={0.7}>
                                <View style={styles.verTodasRow}>
                                    <Text style={[styles.verTodasText, { fontFamily: questrial }]}>Ver todas</Text>
                                    <Ionicons name="chevron-forward" size={13} color={TEAL_MED} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Filtros */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginBottom: 12 }}
                            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                        >
                            {FILTERS.map((f) => {
                                const isActive = activeFilter === f.key;
                                return (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                                        onPress={() => setActiveFilter(f.key)}
                                        activeOpacity={0.8}
                                    >
                                        {f.dotColor && !isActive && (
                                            <View style={[styles.filterDot, { backgroundColor: f.dotColor }]} />
                                        )}
                                        <Text style={[styles.filterBtnText, { fontFamily: questrial }, isActive && styles.filterBtnTextActive]}>
                                            {f.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Lista */}
                        {loading ? (
                            <View style={[styles.atividadesCard, { paddingVertical: 28, alignItems: "center" }]}>
                                <ActivityIndicator color={TEAL_MED} size="small" />
                            </View>
                        ) : atividadesFiltradas.length === 0 ? (
                            <View style={styles.atividadesCard}>
                                <EmptyState
                                    iconName={activeFilter === "denuncias" ? "megaphone-outline" : "people-outline"}
                                    titulo={activeFilter === "denuncias" ? "Nenhuma denúncia registrada na região." : "Nenhuma atividade comunitária encontrada."}
                                    descricao={activeFilter === "denuncias" ? "Quando alguém registrar uma denúncia na sua região, ela aparecerá aqui." : "Quando a comunidade começar a contribuir, as atualizações aparecerão aqui."}
                                    fontFamily={questrial}
                                    onAction={activeFilter === "denuncias" ? () => router.push("/report_complaint" as any) : undefined}
                                    actionLabel={activeFilter === "denuncias" ? "Fazer denúncia" : undefined}
                                />
                            </View>
                        ) : (
                            <View style={styles.atividadesCard}>
                                {atividadesFiltradas.map((act, index) => {
                                    const { iconName, iconBg, iconColor, thumbBg, thumbIcon } = tipoIcone(act.tipo);
                                    const isDenuncia = act.tipo === "denuncia";

                                    if (isDenuncia) {
                                        return (
                                            <View
                                                key={act.id}
                                                style={[
                                                    styles.denunciaItem,
                                                    index < atividadesFiltradas.length - 1 && styles.atividadeItemBorder,
                                                ]}
                                            >
                                                <View style={styles.denunciaTop}>
                                                    <View style={[styles.atividadeIconBox, { backgroundColor: iconBg }]}>
                                                        <Ionicons name={iconName} size={17} color={iconColor} />
                                                    </View>
                                                    <View style={{ flex: 1, minWidth: 0 }}>
                                                        <Text style={[styles.atividadeTitulo, { fontFamily: questrial }]} numberOfLines={1}>
                                                            {act.titulo}
                                                        </Text>
                                                        <Text style={[styles.atividadeDetalhe, { fontFamily: questrial }]} numberOfLines={2}>
                                                            {act.descricao}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.denunciaBottom}>
                                                    <View style={styles.atividadeLocalRow}>
                                                        <Ionicons name="calendar-outline" size={10} color="#aaa" />
                                                        <Text style={[styles.atividadeData, { fontFamily: questrial }]}>
                                                            {act.corpoHidricoNome ? `${act.corpoHidricoNome} • ` : ""}{formatarData(act.dataCriacao)}
                                                        </Text>
                                                    </View>
                                                    {act.cidade && (
                                                        <View style={styles.locTag}>
                                                            <Ionicons name="location-outline" size={10} color="#888" />
                                                            <Text style={[styles.locTagText, { fontFamily: questrial }]}>{act.cidade}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    }

                                    return (
                                        <View
                                            key={act.id}
                                            style={[
                                                styles.atividadeItem,
                                                index < atividadesFiltradas.length - 1 && styles.atividadeItemBorder,
                                            ]}
                                        >
                                            <View style={[styles.atividadeIconBox, { backgroundColor: iconBg }]}>
                                                <Ionicons name={iconName} size={17} color={iconColor} />
                                            </View>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={[styles.atividadeTitulo, { fontFamily: questrial }]} numberOfLines={1}>
                                                    {act.titulo}
                                                </Text>
                                                <Text style={[styles.atividadeDetalhe, { fontFamily: questrial }]} numberOfLines={1}>
                                                    {act.descricao}
                                                </Text>
                                                <View style={styles.atividadeLocalRow}>
                                                    <Ionicons name="calendar-outline" size={10} color="#aaa" />
                                                    <Text style={[styles.atividadeData, { fontFamily: questrial }]}>
                                                        {act.corpoHidricoNome ? `${act.corpoHidricoNome} • ` : ""}{formatarData(act.dataCriacao)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <LinearGradient
                                                colors={[thumbBg, thumbBg + "cc"]}
                                                style={styles.atividadeThumb}
                                            >
                                                <Ionicons name={thumbIcon} size={20} color="#fff" style={{ opacity: 0.7 }} />
                                            </LinearGradient>
                                            <Ionicons name="chevron-forward" size={14} color="#ccc" style={{ marginLeft: 6 }} />
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* ── BOTÃO PUBLICAR ─────────────────────────────── */}
                        <TouchableOpacity
                            style={styles.publicarBtn}
                            onPress={() => router.push("/community_post" as any)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                            <Text style={[styles.publicarBtnText, { fontFamily: questrial }]}>
                                Publicar atualização na comunidade
                            </Text>
                        </TouchableOpacity>

                        {/* ── CARD CONVITE ───────────────────────────────── */}
                        <View style={styles.conviteCard}>
                            <View style={styles.conviteIconCircle}>
                                <Ionicons name="people" size={22} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.conviteTitle, { fontFamily: questrial }]}>
                                    Convide mais pessoas para participar!
                                </Text>
                                <Text style={[styles.conviteBody, { fontFamily: questrial }]}>
                                    Quanto mais pessoas engajadas, melhor cuidamos da nossa água.
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.conviteBtn} activeOpacity={0.8}>
                                <Text style={[styles.conviteBtnText, { fontFamily: questrial }]}>Convidar</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>

                {/* ── NAVBAR ─────────────────────────────────────────────── */}
                <SafeAreaView edges={["bottom"]} style={styles.navWrapper}>
                    <View style={styles.navBar}>
                        <NavItem icon="home" iconOutline="home-outline" label="Home" active={activeTab === "home"} fontFamily={questrial} onPress={() => handleTabPress("home")} />
                        <NavItem icon="map" iconOutline="map-outline" label="Mapa" active={activeTab === "mapa"} fontFamily={questrial} onPress={() => handleTabPress("mapa")} />
                        <View style={styles.fabSpacer}>
                            <TouchableOpacity style={styles.fab} onPress={() => router.push("/register_observation" as any)} activeOpacity={0.85}>
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
        </>
    );
}

// ─── ResumoItem ───────────────────────────────────────────────────────────────

function ResumoItem({
    iconName, iconBg, value, label, sub, fontFamily,
}: {
    iconName: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    value: string;
    label: string;
    sub: string;
    fontFamily?: string;
}) {
    return (
        <View style={styles.resumoItem}>
            <View style={[styles.resumoIconCircle, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={15} color="#fff" />
            </View>
            <Text style={[styles.resumoValue, { fontFamily }]}>{value}</Text>
            <Text style={[styles.resumoLabel, { fontFamily }]}>{label}</Text>
            <Text style={[styles.resumoSub, { fontFamily }]}>{sub}</Text>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#f5f7f5" },
    headerGradient: {},
    headerSafe: { paddingBottom: 18 },
    headerTopRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 18, paddingTop: 10 },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
        alignItems: "center", justifyContent: "center", marginTop: 2,
    },
    headerTitle: { fontSize: 22, color: "#ffffff", fontWeight: "700", lineHeight: 26 },
    headerSubtitle: { fontSize: 13, color: "#a8dac8", lineHeight: 18, marginTop: 3 },
    logoCircle: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
    logoHeader: { width: 50, height: 50 },
    scrollBody: { flex: 1, backgroundColor: "#f5f7f5" },
    scrollContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 100 },
    sectionHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 10, marginTop: 4,
    },
    sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1a2e26" },
    verTodasRow: { flexDirection: "row", alignItems: "center", gap: 2 },
    verTodasText: { fontSize: 13, color: TEAL_MED, fontWeight: "600" },
    corpoCard: {
        backgroundColor: "#fff", borderRadius: 18, overflow: "hidden",
        marginBottom: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
    },
    corpoCardContent: { flexDirection: "row" },
    corpoLabelRow: {
        flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6,
        paddingTop: 16, paddingLeft: 16,
    },
    corpoIconCircle: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: "#e6f5ef", alignItems: "center", justifyContent: "center",
    },
    corpoLabelText: { fontSize: 12, color: TEXT_MUTED },
    corpoNome: { fontSize: 22, fontWeight: "700", color: "#1a2e26", marginBottom: 4, paddingLeft: 16 },
    corpoLocRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 12, paddingLeft: 16 },
    corpoLoc: { fontSize: 13, color: TEXT_MUTED },
    verMapaBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        borderWidth: 1.5, borderColor: "#c8d8d0", borderRadius: 20,
        paddingVertical: 8, paddingHorizontal: 16,
        alignSelf: "flex-start", marginLeft: 16, marginBottom: 16, backgroundColor: "#fff",
    },
    verMapaBtnText: { fontSize: 13, color: "#1a2e26", fontWeight: "600" },
    corpoIlustracao: { width: 130, alignSelf: "stretch" },
    corpoIlustracaoGrad: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8 },
    bridgeDecor: { position: "absolute", bottom: 16, right: 12 },
    resumoCard: {
        backgroundColor: "#fff", borderRadius: 16, flexDirection: "row",
        alignItems: "center", paddingVertical: 14, paddingHorizontal: 6,
        marginBottom: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    resumoItem: { flex: 1, alignItems: "center" },
    resumoDivider: { width: 1, height: 48, backgroundColor: "#ebebeb" },
    resumoIconCircle: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    resumoValue: { fontSize: 18, fontWeight: "700", color: "#1a2e26", lineHeight: 22 },
    resumoLabel: { fontSize: 11, fontWeight: "600", color: "#1a2e26", textAlign: "center" },
    resumoSub: { fontSize: 10, color: TEXT_MUTED, textAlign: "center" },
    indicadoresRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    indicadorCard: {
        backgroundColor: "#fff", borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    },
    indicadorHeaderRow: {
        flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap",
    },
    indicadorIconCircle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    indicadorLabel: { fontSize: 10, color: TEXT_MUTED, flex: 1, lineHeight: 13 },
    indicadorValue: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
    indicadorSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
    destaqueCard: {
        backgroundColor: "#e8f5ef", borderRadius: 16, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12,
        marginBottom: 16, borderWidth: 1, borderColor: "#c0e0cf",
    },
    destaqueIconCircle: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: TEAL_MED,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    destaqueTitle: { fontSize: 14, fontWeight: "700", color: "#0d4a3e", marginBottom: 3 },
    destaqueBody: { fontSize: 12, color: "#2a7a5c", lineHeight: 17 },
    filterBtn: {
        flexDirection: "row", alignItems: "center", gap: 5,
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 20, borderWidth: 1.5, borderColor: "#dde8e4", backgroundColor: "#fff",
    },
    filterBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    filterDot: { width: 7, height: 7, borderRadius: 3.5 },
    filterBtnText: { fontSize: 13, color: "#1a2e26", fontWeight: "500" },
    filterBtnTextActive: { color: "#fff", fontWeight: "700" },
    atividadesCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 4, marginBottom: 14,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    atividadeItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    atividadeItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    atividadeIconBox: {
        width: 38, height: 38, borderRadius: 11,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    atividadeTitulo: { fontSize: 13, fontWeight: "700", color: "#1a2e26", marginBottom: 2 },
    atividadeDetalhe: { fontSize: 12, color: TEXT_MUTED, marginBottom: 2 },
    atividadeLocalRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    atividadeData: { fontSize: 11, color: "#aaa" },
    atividadeThumb: {
        width: 52, height: 48, borderRadius: 10,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    denunciaItem: {
        paddingVertical: 14, paddingHorizontal: 2,
        borderLeftWidth: 3, borderLeftColor: "#e07b1e",
        paddingLeft: 10, marginLeft: -2,
    },
    denunciaTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    denunciaBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 42 },
    locTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f5f5f5", borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
    locTagText: { fontSize: 10, color: "#888" },
    emptyState: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
    emptyIconCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: "#f0f4f2", alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    emptyTitulo: { fontSize: 14, fontWeight: "700", color: "#1a2e26", textAlign: "center", marginBottom: 6 },
    emptyDescricao: { fontSize: 13, color: TEXT_MUTED, textAlign: "center", lineHeight: 19 },
    emptyBtn: {
        marginTop: 12, borderWidth: 1.5, borderColor: TEAL_MED,
        borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18,
    },
    emptyBtnText: { fontSize: 13, color: TEAL_MED, fontWeight: "600" },
    publicarBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        borderWidth: 1.5, borderColor: "#c0d8cf", borderRadius: 14,
        paddingVertical: 15, backgroundColor: "#fff", marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    publicarBtnText: { fontSize: 14, fontWeight: "600", color: PRIMARY },
    conviteCard: {
        backgroundColor: "#fff9f0", borderRadius: 16, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12,
        borderWidth: 1, borderColor: "#f0e0c8",
    },
    conviteIconCircle: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    conviteTitle: { fontSize: 13, fontWeight: "700", color: "#3a2010", marginBottom: 2 },
    conviteBody: { fontSize: 11, color: "#7a5030", lineHeight: 15 },
    conviteBtn: {
        borderWidth: 1.5, borderColor: "#1a2e26", borderRadius: 20,
        paddingVertical: 8, paddingHorizontal: 16, flexShrink: 0,
    },
    conviteBtnText: { fontSize: 13, fontWeight: "600", color: "#1a2e26" },
    navWrapper: {
        backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
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
    navBadge: {
        position: "absolute", top: -4, right: -6,
        backgroundColor: "#e53935", borderRadius: 8,
        minWidth: 16, height: 16,
        alignItems: "center", justifyContent: "center",
        paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#fff",
    },
    navBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },
    fabSpacer: { width: "20%", alignItems: "center", justifyContent: "center" },
    fab: {
        width: 56, height: 56, borderRadius: 28, marginTop: -22,
        shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    },
    fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
});