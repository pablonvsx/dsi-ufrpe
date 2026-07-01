import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { LineChart } from "react-native-chart-kit";

import { useAuth } from "@/contexts/auth-context";
import {
  getDailyQualityLevels,
  getColetasSimplesPorNivel,
  DailyLevelData,
} from "@/services/coletas";
import {
  buscarOcorrenciasPrioritarias,
  buscarRankingRegioes,
  buscarCorposHidricosParaMapa,
  OcorrenciaDashboard,
  RegiaoOcorrencia,
  CorpoHidricoComNivel,
} from "@/services/firestore/dashboard";
import { buscarAlertasDoUsuario } from "@/services/firestore/alerts";
import ManagerBottomNav from "@/components/managerbottomnav";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIMARY = "#004d48";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BODY_PAD = 16;
const CARD_PAD = 14;
const CHART_W = SCREEN_WIDTH - BODY_PAD * 2 - CARD_PAD * 2;
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nivelParaCor(nivel: number): string {
  if (nivel === 4) return "#EF4444";
  if (nivel === 3) return "#F97316";
  if (nivel === 2) return "#F59E0B";
  if (nivel === 1) return "#22C55E";
  return "#9CA3AF";
}

function formatarDataOcorrencia(criadoEm: any): string {
  if (!criadoEm) return "—";
  const date = criadoEm.toDate ? criadoEm.toDate() : new Date(criadoEm);
  const now = new Date();
  const ontem = new Date(now);
  ontem.setDate(now.getDate() - 1);
  const hora = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (date.toDateString() === now.toDateString()) return `Hoje • ${hora}`;
  if (date.toDateString() === ontem.toDateString()) return `Ontem • ${hora}`;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function LegendaLinha({ cor, label }: { cor: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: cor }} />
      <Text style={{ fontSize: 10, color: "#6b7a7a" }}>{label}</Text>
    </View>
  );
}

function DonutChart({
  critico, atencao, normal, boa, semDados, total, questrial,
}: {
  critico: number; atencao: number; normal: number; boa: number;
  semDados: number; total: number; questrial?: string;
}) {
  const dominante =
    critico > 0 ? "#EF4444" : atencao > 0 ? "#F97316" : total > 0 ? "#22C55E" : "#9CA3AF";
  const segmentos = [
    { v: critico, cor: "#EF4444" },
    { v: atencao, cor: "#F97316" },
    { v: normal + boa, cor: "#22C55E" },
    { v: semDados, cor: "#9CA3AF" },
  ].filter((s) => s.v > 0);

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 90, height: 90, borderRadius: 45,
          borderWidth: 13, borderColor: dominante,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: PRIMARY, fontFamily: questrial }}>
          {total}
        </Text>
        <Text style={{ fontSize: 8, color: "#6b7a7a", textAlign: "center" }}>Total</Text>
      </View>
      <View
        style={{
          flexDirection: "row", width: 82, height: 5,
          borderRadius: 3, overflow: "hidden", marginTop: 8, backgroundColor: "#E5E7EB",
        }}
      >
        {segmentos.map((s, i) => (
          <View key={i} style={{ flex: s.v, backgroundColor: s.cor }} />
        ))}
      </View>
      <View style={{ marginTop: 10, gap: 4, width: "100%" }}>
        {[
          { cor: "#EF4444", label: "Críticos", v: critico },
          { cor: "#F97316", label: "Atenção", v: atencao },
          { cor: "#22C55E", label: "Normais", v: normal + boa },
          { cor: "#9CA3AF", label: "Sem dados", v: semDados },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.cor }} />
            <Text style={{ fontSize: 9, color: "#374151" }}>
              {item.label}{" "}
              <Text style={{ color: "#6b7a7a" }}>
                {item.v} ({total > 0 ? Math.round((item.v / total) * 100) : 0}%)
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BarraHorizontal({
  nome, total, max, cor, questrial,
}: {
  nome: string; total: number; max: number; cor: string; questrial?: string;
}) {
  const pct = max > 0 ? (total / max) * 100 : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: "#374151", fontFamily: questrial, flex: 1 }} numberOfLines={1}>
          {nome}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: PRIMARY, marginLeft: 8 }}>{total}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: cor, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function OcorrenciaCard({
  item, questrial, onVerAnalise,
}: {
  item: OcorrenciaDashboard; questrial?: string; onVerAnalise: () => void;
}) {
  const isCritico = item.nivel === "Crítico";
  const cor = isCritico ? "#EF4444" : "#F97316";
  const bg = isCritico ? "#FEE2E2" : "#FFF3E0";

  return (
    <View style={styles.ocorrenciaCard}>
      <View style={[styles.ocorrenciaIconBox, { backgroundColor: bg }]}>
        <Ionicons name={isCritico ? "water" : "analytics"} size={22} color={cor} />
      </View>
      <View style={styles.ocorrenciaContent}>
        <Text style={[styles.ocorrenciaNome, { fontFamily: questrial }]} numberOfLines={1}>
          {item.nomeCorpo}
        </Text>
        <View style={styles.ocorrenciaMetaRow}>
          <Ionicons name="person-outline" size={10} color="#9CA3AF" />
          <Text style={styles.ocorrenciaMeta}>{item.tipo}</Text>
          <Text style={styles.ocorrenciaMetaSep}>•</Text>
          <Ionicons name="time-outline" size={10} color="#9CA3AF" />
          <Text style={styles.ocorrenciaMeta}>{formatarDataOcorrencia(item.criadoEm)}</Text>
        </View>
        <View style={[styles.nivelBadge, { backgroundColor: bg }]}>
          <View style={[styles.nivelDot, { backgroundColor: cor }]} />
          <Text style={[styles.nivelBadgeText, { color: cor }]}>{item.nivel}</Text>
          <Text style={[styles.nivelRisco, { color: cor }]}> • {item.descricaoRisco}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.verAnaliseBtn} onPress={onVerAnalise} activeOpacity={0.8}>
        <Text style={[styles.verAnaliseBtnText, { fontFamily: questrial }]}>Ver análise</Text>
        <Ionicons name="chevron-forward" size={13} color={PRIMARY} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardManager() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [timeFilter, setTimeFilter] = useState<7 | 14 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [loadingFilter, setLoadingFilter] = useState(false);

  const [locationText, setLocationText] = useState("Região Metropolitana do Recife");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [bellCount, setBellCount] = useState(0);

  const [dailyLevels, setDailyLevels] = useState<DailyLevelData[]>([]);
  const [distribuicao, setDistribuicao] = useState({
    boa: 0, normal: 0, atencao: 0, critico: 0, total: 0,
  });
  const [regioes, setRegioes] = useState<RegiaoOcorrencia[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaDashboard[]>([]);
  const [corposHidricos, setCorposHidricos] = useState<CorpoHidricoComNivel[]>([]);
  const [totalCorpos, setTotalCorpos] = useState(0);

  // ── Dados iniciais ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [ocorrs, corpos] = await Promise.all([
          buscarOcorrenciasPrioritarias(3),
          buscarCorposHidricosParaMapa(),
        ]);
        setOcorrencias(ocorrs);
        setCorposHidricos(corpos);
        setTotalCorpos(corpos.length);

        if (userProfile?.uid) {
          const alertas = await buscarAlertasDoUsuario(userProfile.uid);
          setBellCount(
            alertas.filter((a) => !(a.lidoPor ?? []).includes(userProfile.uid)).length
          );
        }
        setLastUpdated(new Date());
      } catch (err) {
        console.error("[dashboard_manager] init:", err);
      } finally {
        setLoading(false);
      }
    })();

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
          setLocationText(
            city && state ? `${city} • ${state}` : city || state || "Região Metropolitana do Recife"
          );
        }
      } catch { /* mantém default */ }
    })();
  }, [userProfile?.uid]);

  // ── Dados filtrados por período ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingFilter(true);
      try {
        const [daily, dist, ranking] = await Promise.all([
          getDailyQualityLevels(timeFilter),
          getColetasSimplesPorNivel(timeFilter),
          buscarRankingRegioes(timeFilter),
        ]);
        setDailyLevels(daily);
        setDistribuicao(dist);
        setRegioes(ranking);
      } catch (err) {
        console.error("[dashboard_manager] filter:", err);
      } finally {
        setLoadingFilter(false);
      }
    })();
  }, [timeFilter]);

  // ── Dados derivados para o gráfico de linhas ──────────────────────────────
  const MAX_PONTOS = 7;
  const step = dailyLevels.length > MAX_PONTOS
    ? Math.floor(dailyLevels.length / MAX_PONTOS)
    : 1;
  const amostras = dailyLevels.filter((_, i) => i % step === 0).slice(-MAX_PONTOS);

  const labels = amostras.length > 0
    ? amostras.map((d) => {
        const date = new Date(d.date + "T00:00:00");
        return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
      })
    : ["—"];

  const lineData = {
    labels,
    datasets: [
      {
        data: amostras.length > 0 ? amostras.map((d) => d.critico) : [0],
        color: (o = 1) => `rgba(239,68,68,${o})`,
        strokeWidth: 2,
      },
      {
        data: amostras.length > 0 ? amostras.map((d) => d.atencao) : [0],
        color: (o = 1) => `rgba(249,115,22,${o})`,
        strokeWidth: 2,
      },
      {
        data: amostras.length > 0 ? amostras.map((d) => d.normal + d.boa) : [0],
        color: (o = 1) => `rgba(34,197,94,${o})`,
        strokeWidth: 2,
      },
    ],
  };

  const comDados = distribuicao.boa + distribuicao.normal + distribuicao.atencao + distribuicao.critico;
  const semDados = Math.max(0, totalCorpos - comDados);
  const totalDonut = comDados + semDados;
  const maxRegiao = regioes.length > 0 ? Math.max(...regioes.map((r) => r.total)) : 1;

  const centroMapa = corposHidricos.length > 0
    ? {
        latitude:
          corposHidricos.reduce((s, c) => s + c.latitude, 0) / corposHidricos.length,
        longitude:
          corposHidricos.reduce((s, c) => s + c.longitude, 0) / corposHidricos.length,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }
    : { latitude: -8.05, longitude: -34.95, latitudeDelta: 0.4, longitudeDelta: 0.4 };

  // ── Render ────────────────────────────────────────────────────────────────
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
            {/* Linha superior: localização + ações */}
            <View style={styles.headerTopRow}>
              <View style={styles.headerLocBlock}>
                <View style={styles.headerLocRow}>
                  <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={[styles.headerLocCity, { fontFamily: questrial }]}>
                    {locationText}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.65)" />
                </View>
                <Text style={[styles.headerLocSub, { fontFamily: questrial }]}>
                  {userProfile?.nome?.split(" ").slice(0, 2).join(" ") ?? "Gestor"}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.bellBtn}
                  onPress={() => router.push("/(tabs)/alerts_manager" as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                  {bellCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{bellCount > 9 ? "9+" : bellCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => router.push("/(tabs)/profile" as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.profileCircle}>
                    <Ionicons name="person" size={17} color={PRIMARY} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Linha inferior: título + chip */}
            <View style={styles.headerTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                  Dashboard Estratégico
                </Text>
                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Monitoramento operacional e analítico dos corpos hídricos
                </Text>
              </View>
              <View style={styles.updateChip}>
                <Ionicons name="time-outline" size={11} color={PRIMARY} />
                <View style={{ marginLeft: 4 }}>
                  <Text style={styles.updateChipTitle}>Atualizado agora</Text>
                  <Text style={styles.updateChipTime}>Hoje, {formatTime(lastUpdated)}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ CONTEÚDO ══ */}
        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* ── Visão ambiental da região ──────────────────────────────── */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { fontFamily: questrial }]}>
                    Visão ambiental da região
                  </Text>
                </View>

                {/* Filtro de tempo */}
                <View style={styles.filterRow}>
                  {([7, 14, 30] as const).map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.filterChip, timeFilter === d && styles.filterChipActive]}
                      onPress={() => setTimeFilter(d)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          timeFilter === d && styles.filterChipTextActive,
                        ]}
                      >
                        Últimos {d} dias
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {loadingFilter ? (
                  <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 30 }} />
                ) : (
                  <>
                    {/* Gráfico de linhas — Evolução de alertas */}
                    <Text style={[styles.chartSectionTitle, { fontFamily: questrial }]}>
                      Evolução de alertas
                    </Text>
                    <View style={styles.legendaRow}>
                      <LegendaLinha cor="#EF4444" label="Críticos" />
                      <LegendaLinha cor="#F97316" label="Atenção" />
                      <LegendaLinha cor="#22C55E" label="Normais" />
                    </View>

                    {amostras.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <LineChart
                          data={lineData}
                          width={Math.max(CHART_W, amostras.length * 52)}
                          height={150}
                          chartConfig={{
                            backgroundColor: "#ffffff",
                            backgroundGradientFrom: "#ffffff",
                            backgroundGradientTo: "#ffffff",
                            decimalPlaces: 0,
                            color: (o = 1) => `rgba(0,77,72,${o})`,
                            labelColor: (o = 1) => `rgba(107,122,122,${o})`,
                            propsForDots: { r: "3", strokeWidth: "1" },
                            propsForLabels: { fontSize: 9 },
                          }}
                          withInnerLines={false}
                          withOuterLines={false}
                          withVerticalLines={false}
                          withDots={false}
                          bezier
                          style={{ borderRadius: 8 }}
                          fromZero
                        />
                      </ScrollView>
                    ) : (
                      <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>Sem dados no período</Text>
                      </View>
                    )}

                    {/* Distribuição + Regiões */}
                    <View style={styles.chartsRow}>
                      {/* Distribuição atual */}
                      <View style={styles.donutSection}>
                        <Text style={[styles.chartSectionTitle, { fontFamily: questrial }]}>
                          Distribuição atual
                        </Text>
                        <DonutChart
                          critico={distribuicao.critico}
                          atencao={distribuicao.atencao}
                          normal={distribuicao.normal}
                          boa={distribuicao.boa}
                          semDados={semDados}
                          total={totalDonut}
                          questrial={questrial}
                        />
                      </View>

                      {/* Regiões */}
                      <View style={styles.regioesSection}>
                        <Text style={[styles.chartSectionTitle, { fontFamily: questrial }]}>
                          Regiões com mais ocorrências
                        </Text>
                        {regioes.length > 0 ? (
                          regioes.map((r) => (
                            <BarraHorizontal
                              key={r.nome}
                              nome={r.nome}
                              total={r.total}
                              max={maxRegiao}
                              cor={r.corDominante}
                              questrial={questrial}
                            />
                          ))
                        ) : (
                          <Text style={styles.emptyChartText}>
                            Sem dados no período
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* ── Ocorrências prioritárias ───────────────────────────────── */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { fontFamily: questrial }]}>
                    Ocorrências prioritárias
                  </Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                    onPress={() => router.push("/(tabs)/alerts_manager" as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.verTodasLink}>Ver todas</Text>
                    <Ionicons name="chevron-forward" size={13} color={PRIMARY} />
                  </TouchableOpacity>
                </View>

                {ocorrencias.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={28} color="#22C55E" />
                    <Text style={[styles.emptyStateText, { fontFamily: questrial }]}>
                      Nenhuma ocorrência prioritária
                    </Text>
                  </View>
                ) : (
                  ocorrencias.map((item) => (
                    <OcorrenciaCard
                      key={item.id}
                      item={item}
                      questrial={questrial}
                      onVerAnalise={() => router.push("/(tabs)/alerts_manager" as any)}
                    />
                  ))
                )}
              </View>

              {/* ── Mapa estratégico da região ────────────────────────────── */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { fontFamily: questrial }]}>
                    Mapa estratégico da região
                  </Text>
                  <TouchableOpacity
                    style={styles.expandMapBtn}
                    onPress={() => router.push("/(tabs)/map_manager" as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.expandMapText, { fontFamily: questrial }]}>
                      Expandir mapa
                    </Text>
                    <Ionicons name="expand-outline" size={14} color={PRIMARY} />
                  </TouchableOpacity>
                </View>

                <View style={styles.miniMapContainer}>
                  <MapView
                    style={styles.miniMap}
                    initialRegion={centroMapa}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    {corposHidricos.map((corpo) => (
                      <Marker
                        key={corpo.id}
                        coordinate={{
                          latitude: corpo.latitude,
                          longitude: corpo.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View
                          style={{
                            width: 14, height: 14, borderRadius: 7,
                            backgroundColor: nivelParaCor(corpo.nivelAtual),
                            borderWidth: 2, borderColor: "#fff",
                          }}
                        />
                      </Marker>
                    ))}
                  </MapView>
                </View>

                <View style={styles.mapaLegendaRow}>
                  {[
                    { cor: "#EF4444", label: "Críticos" },
                    { cor: "#F97316", label: "Atenção" },
                    { cor: "#22C55E", label: "Normais" },
                    { cor: "#9CA3AF", label: "Sem dados" },
                  ].map((item) => (
                    <View key={item.label} style={styles.mapaLegendaItem}>
                      <View style={[styles.mapaLegendaDot, { backgroundColor: item.cor }]} />
                      <Text style={[styles.mapaLegendaText, { fontFamily: questrial }]}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <ManagerBottomNav activeTab="dashboard" fontFamily={questrial} />
      </View>
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9F8" },

  // Header
  headerGradient: {},
  headerSafe: { paddingBottom: 0 },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLocBlock: { flex: 1 },
  headerLocRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  headerLocCity: { fontSize: 13, fontWeight: "600", color: "#fff" },
  headerLocSub: { fontSize: 11, color: "rgba(255,255,255,0.75)" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellBtn: { position: "relative", padding: 4 },
  bellBadge: {
    position: "absolute", top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
  },
  bellBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  profileBtn: { padding: 2 },
  profileCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 3 },
  headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: 16 },
  updateChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
    flexShrink: 0,
  },
  updateChipTitle: { fontSize: 9, fontWeight: "600", color: PRIMARY },
  updateChipTime: { fontSize: 9, color: "#6b7a7a" },

  // Body
  body: { flex: 1, paddingHorizontal: BODY_PAD, paddingTop: 16 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: CARD_PAD,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },

  // Filtro de tempo
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  filterChip: {
    flex: 1, paddingVertical: 7, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: "#E8F5F3",
    borderWidth: 1, borderColor: "#B0C4C2", alignItems: "center",
  },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 10, fontWeight: "600", color: PRIMARY, textAlign: "center" },
  filterChipTextActive: { color: "#fff" },

  // Seções do gráfico
  chartSectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8,
  },
  legendaRow: { flexDirection: "row", gap: 14, marginBottom: 8 },
  emptyChart: {
    height: 100, alignItems: "center", justifyContent: "center",
    backgroundColor: "#F9FAFB", borderRadius: 8, marginBottom: 12,
  },
  emptyChartText: { fontSize: 12, color: "#9CA3AF" },

  // Row distribuição + regiões
  chartsRow: { flexDirection: "row", gap: 14, marginTop: 14 },
  donutSection: { flex: 0.9 },
  regioesSection: { flex: 1.1 },

  // Ocorrências
  ocorrenciaCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  ocorrenciaIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  ocorrenciaContent: { flex: 1, minWidth: 0 },
  ocorrenciaNome: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 3 },
  ocorrenciaMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 5 },
  ocorrenciaMeta: { fontSize: 10, color: "#9CA3AF" },
  ocorrenciaMetaSep: { fontSize: 10, color: "#D1D5DB" },
  nivelBadge: {
    flexDirection: "row", alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  nivelDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  nivelBadgeText: { fontSize: 10, fontWeight: "700" },
  nivelRisco: { fontSize: 10, fontWeight: "500" },
  verAnaliseBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, flexShrink: 0,
  },
  verAnaliseBtnText: { fontSize: 11, fontWeight: "600", color: PRIMARY },

  // Links
  verTodasLink: { fontSize: 12, fontWeight: "600", color: PRIMARY },

  // Mapa
  expandMapBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  expandMapText: { fontSize: 11, fontWeight: "600", color: PRIMARY },
  miniMapContainer: {
    height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 10,
  },
  miniMap: { flex: 1 },
  mapaLegendaRow: {
    flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 14, marginTop: 4,
  },
  mapaLegendaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  mapaLegendaDot: { width: 8, height: 8, borderRadius: 4 },
  mapaLegendaText: { fontSize: 10, color: "#374151" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyStateText: { fontSize: 13, color: "#9CA3AF" },
} as const);