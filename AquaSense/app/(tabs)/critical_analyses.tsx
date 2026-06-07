import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import * as Location from "expo-location";

import {
  CriticalAnalysis,
  getCriticalAnalyses,
} from "@/services/firestore/critical_analyses";

const PRIMARY = "#004d48";
const PRIMARY_DARK = "#003d39";
const TEAL = "#0a6b5e";
const SURFACE = "#F5F9F8";
const TEXT_MUTED = "#6b7a7a";
const RED = "#e53935";
const ORANGE = "#ff8a00";
const BORDER_LIGHT = "#e0f2f1";

function minutosAtras(date: Date) {
  const diff = Date.now() - date.getTime();
  const min = Math.max(0, Math.floor(diff / 60000));

  if (min < 1) return "Agora";
  if (min < 60) return `Há ${min} min`;

  const horas = Math.floor(min / 60);
  if (horas === 1) return "Há 1 h";

  return `Há ${horas} h`;
}

function formatarHora(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDataCurta(date: Date) {
  const hoje = new Date();
  const mesmoDia =
    date.getDate() === hoje.getDate() &&
    date.getMonth() === hoje.getMonth() &&
    date.getFullYear() === hoje.getFullYear();

  if (mesmoDia) return `Hoje, ${formatarHora(date)}`;

  return `${date.toLocaleDateString("pt-BR")} · ${formatarHora(date)}`;
}

function origemLabel(origem: CriticalAnalysis["origem"]) {
  if (origem === "medicao") return "Medição simples";
  if (origem === "observacao") return "Observação";
  return "Denúncia";
}

export default function CriticalAnalysesScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [cityLabel, setCityLabel] = useState("Localizando...");
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<CriticalAnalysis[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    carregarLocalizacao();
    carregarAnalises();
  }, []);

  async function carregarLocalizacao() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setCityLabel("Olinda - PE");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(loc.coords);

      const city = place?.city ?? place?.subregion ?? "Olinda";
      const state = place?.region ?? "PE";

      setCityLabel(`${city} - ${state}`);
    } catch {
      setCityLabel("Olinda - PE");
    }
  }

  async function carregarAnalises() {
    setLoading(true);

    try {
      const dados = await getCriticalAnalyses(50);
      setAnalyses(dados);
    } catch (error) {
      console.error("Erro ao carregar análises críticas:", error);
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }

  const filtradas = useMemo(() => {
    const termo = search.trim().toLowerCase();

    if (!termo) return analyses;

    return analyses.filter((item) => {
      return (
        item.corpoHidricoNome.toLowerCase().includes(termo) ||
        item.colaboradorNome.toLowerCase().includes(termo) ||
        origemLabel(item.origem).toLowerCase().includes(termo) ||
        item.cidade?.toLowerCase().includes(termo)
      );
    });
  }, [analyses, search]);

  const criticasCount = analyses.filter((item) => item.status === "critico").length;
  const atencaoCount = analyses.filter((item) => item.status === "atencao_alta").length;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[PRIMARY, "#005a52", PRIMARY_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back-outline" size={25} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.locationArea}>
              <Ionicons name="location-outline" size={28} color="#FFFFFF" />
              <View>
                <Text style={[styles.locationText, { fontFamily: questrial }]}>
                  {cityLabel}
                </Text>
                <Text style={[styles.teamText, { fontFamily: questrial }]}>
                  Equipe Técnica
                </Text>
              </View>
            </View>

            <Image
              source={require("../../assets/images/aquasense.png")}
              style={styles.logo}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>

          <View style={styles.headerBottom}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { fontFamily: questrial }]}>
                Análises Técnicas
              </Text>
              <Text style={[styles.pageSubtitle, { fontFamily: questrial }]}>
                Registros aguardando avaliação técnica
              </Text>
            </View>

            <View style={styles.criticalSummary}>
              <Ionicons name="warning" size={22} color="#ff4b28" />
              <View>
                <Text style={[styles.criticalSummaryTitle, { fontFamily: questrial }]}>
                  {criticasCount} análises críticas
                </Text>
                <Text style={[styles.criticalSummarySub, { fontFamily: questrial }]}>
                  Requerem atenção imediata
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentPanel}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={24} color={PRIMARY} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por corpo hídrico, origem ou colaborador..."
              placeholderTextColor="#8a9696"
              style={[styles.searchInput, { fontFamily: questrial }]}
            />
          </View>

          <TouchableOpacity style={styles.filterButton} activeOpacity={0.75}>
            <Ionicons name="filter-outline" size={22} color={PRIMARY} />
            <Text style={[styles.filterText, { fontFamily: questrial }]}>
              Filtros
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity style={styles.tabInactive} activeOpacity={0.75}>
            <Text style={[styles.tabInactiveText, { fontFamily: questrial }]}>
              Pendentes
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>—</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.tabActive}>
            <Text style={[styles.tabActiveText, { fontFamily: questrial }]}>
              Críticas
            </Text>
            <View style={styles.tabBadgeActive}>
              <Text style={styles.tabBadgeActiveText}>{criticasCount}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.tabInactive} activeOpacity={0.75}>
            <Text style={[styles.tabInactiveText, { fontFamily: questrial }]}>
              Histórico
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>—</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons name="warning" size={28} color="#f23b22" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeTitle, { fontFamily: questrial }]}>
                Ocorrências críticas priorizadas
              </Text>
              <Text style={[styles.noticeText, { fontFamily: questrial }]}>
                Estas análises apresentam risco elevado para o corpo hídrico e requerem avaliação técnica imediata.
              </Text>
            </View>

            <View style={styles.noticeTime}>
              <Ionicons name="time-outline" size={17} color={TEXT_MUTED} />
              <Text style={[styles.noticeTimeText, { fontFamily: questrial }]}>
                Atualizado agora
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <Text style={[styles.loadingText, { fontFamily: questrial }]}>
                Carregando análises críticas...
              </Text>
            </View>
          ) : filtradas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={48} color={PRIMARY} />
              <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
                Nenhuma análise crítica encontrada
              </Text>
              <Text style={[styles.emptyText, { fontFamily: questrial }]}>
                Quando houver registros com risco elevado, eles aparecerão nesta tela.
              </Text>
            </View>
          ) : (
            filtradas.map((item) => (
              <AnalysisCard
                key={`${item.origem}-${item.id}`}
                item={item}
                fontFamily={questrial}
              />
            ))
          )}
        </ScrollView>
      </View>

      <SafeAreaView edges={["bottom"]} style={styles.navWrapper}>
        <View style={styles.navBar}>
          <NavItem
            icon="home-outline"
            label="Home"
            active={false}
            onPress={() => router.replace("/(tabs)/home_technician" as any)}
            fontFamily={questrial}
          />

          <NavItem
            icon="list"
            label="Análises"
            active
            onPress={() => {}}
            fontFamily={questrial}
          />

          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPress={() => router.push("/(tabs)/register_observation" as any)}
          >
            <Ionicons name="add" size={34} color="#FFFFFF" />
          </TouchableOpacity>

          <NavItem
            icon="map-outline"
            label="Mapa"
            active={false}
            onPress={() => router.push("/(tabs)/mapa" as any)}
            fontFamily={questrial}
          />

          <NavItem
            icon="person-outline"
            label="Perfil"
            active={false}
            onPress={() => router.push("/(tabs)/profile" as any)}
            fontFamily={questrial}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function AnalysisCard({
  item,
  fontFamily,
}: {
  item: CriticalAnalysis;
  fontFamily?: string;
}) {
  const isCritical = item.status === "critico";
  const accent = isCritical ? RED : ORANGE;
  const statusLabel = isCritical ? "CRÍTICO" : "ATENÇÃO ALTA";

  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.analysisCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.mainIconCircle, { backgroundColor: isCritical ? "#fdecea" : "#fff3df" }]}>
            <Ionicons name="flask-outline" size={29} color={accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { fontFamily }]} numberOfLines={1}>
              {item.corpoHidricoNome}
            </Text>

            <View style={styles.originRow}>
              <Text style={[styles.originText, { fontFamily }]}>
                {origemLabel(item.origem)}
              </Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={[styles.collaboratorText, { fontFamily }]} numberOfLines={1}>
                {item.colaboradorNome}
              </Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: isCritical ? "#fdecea" : "#fff3df" }]}>
            <Text style={[styles.statusBadgeText, { fontFamily, color: accent }]}>
              {statusLabel}
            </Text>
          </View>

          <Ionicons name="chevron-down" size={19} color={PRIMARY} />
        </View>

        {item.parametros.length > 0 ? (
          <View style={styles.paramsGrid}>
            {item.parametros.slice(0, 4).map((param, index) => (
              <View key={`${param.label}-${index}`} style={styles.paramBox}>
                <Ionicons
                  name={param.icon as any}
                  size={24}
                  color={param.severity === "critico" ? RED : TEAL}
                />

                <View>
                  <Text style={[styles.paramLabel, { fontFamily }]}>
                    {param.label}
                  </Text>
                  <Text
                    style={[
                      styles.paramValue,
                      {
                        fontFamily,
                        color: param.severity === "critico" ? RED : PRIMARY,
                      },
                    ]}
                  >
                    {param.value}
                  </Text>
                  {param.hint ? (
                    <Text
                      style={[
                        styles.paramHint,
                        {
                          fontFamily,
                          color: param.severity === "critico" ? RED : ORANGE,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {param.hint}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {item.descricao && item.origem !== "medicao" ? (
          <View style={styles.descriptionBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={PRIMARY} />
            <Text style={[styles.descriptionText, { fontFamily }]} numberOfLines={2}>
              {item.descricao}
            </Text>
          </View>
        ) : null}

        <View style={styles.alertChipsRow}>
          {item.alertas.slice(0, 2).map((alerta, index) => (
            <View key={`${alerta}-${index}`} style={styles.alertChip}>
              <Ionicons name="warning-outline" size={15} color={RED} />
              <Text style={[styles.alertChipText, { fontFamily }]}>{alerta}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={17} color="#526a6a" />
            <Text style={[styles.metaText, { fontFamily }]}>
              {formatarDataCurta(item.dataCriacao)}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={17} color="#526a6a" />
            <Text style={[styles.metaText, { fontFamily }]} numberOfLines={1}>
              {item.colaboradorNome}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={17} color="#526a6a" />
            <Text style={[styles.metaText, { fontFamily }]} numberOfLines={1}>
              {[item.cidade, item.estado].filter(Boolean).join(" - ") || "—"}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={17} color="#526a6a" />
            <Text style={[styles.metaText, { fontFamily }]}>
              {minutosAtras(item.dataCriacao)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.analyzeButton, { backgroundColor: accent }]} activeOpacity={0.85}>
          <Text style={[styles.analyzeButtonText, { fontFamily }]}>
            Analisar agora
          </Text>
          <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active,
  onPress,
  fontFamily,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  fontFamily?: string;
}) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={25} color={active ? PRIMARY : "#8aa6a3"} />
      <Text
        style={[
          styles.navLabel,
          {
            fontFamily,
            color: active ? PRIMARY : "#8aa6a3",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  header: {
    paddingBottom: 46,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },

  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  locationArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },

  locationText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  teamText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 1,
  },

  logo: {
    width: 56,
    height: 56,
  },

  headerBottom: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 26,
    gap: 14,
  },

  pageTitle: {
    fontSize: 34,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  pageSubtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
  },

  criticalSummary: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(63,243,231,0.45)",
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    minWidth: 240,
  },

  criticalSummaryTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  criticalSummarySub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    marginTop: 2,
  },

  contentPanel: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: -24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
  },

  searchRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
  },

  searchBox: {
    flex: 1,
    height: 58,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: "#334",
  },

  filterButton: {
    height: 58,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },

  filterText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },

  tabsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 18,
  },

  tabInactive: {
    flex: 1,
    height: 52,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    backgroundColor: "#FFFFFF",
  },

  tabActive: {
    flex: 1,
    height: 52,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    backgroundColor: PRIMARY,
  },

  tabInactiveText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },

  tabActiveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  tabBadge: {
    backgroundColor: "#dcefeb",
    borderRadius: 16,
    minWidth: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  tabBadgeText: {
    color: PRIMARY,
    fontWeight: "700",
    fontSize: 13,
  },

  tabBadgeActive: {
    backgroundColor: "#ff6b1a",
    borderRadius: 16,
    minWidth: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  tabBadgeActiveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
  },

  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffc9bf",
    backgroundColor: "#fff3f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 14,
  },

  noticeIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fde1dc",
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    color: RED,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  noticeText: {
    color: "#334",
    fontSize: 13,
    lineHeight: 18,
  },

  noticeTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  noticeTimeText: {
    color: TEXT_MUTED,
    fontSize: 13,
  },

  loadingArea: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },

  loadingText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 28,
    marginTop: 20,
  },

  emptyTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },

  emptyText: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  cardWrapper: {
    position: "relative",
    marginBottom: 18,
  },

  cardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 7,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    zIndex: 2,
  },

  analysisCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    paddingLeft: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  mainIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 22,
    color: PRIMARY,
    fontWeight: "700",
  },

  originRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 7,
  },

  originText: {
    fontSize: 14,
    color: "#405060",
    fontWeight: "600",
  },

  dotSeparator: {
    color: "#405060",
  },

  collaboratorText: {
    fontSize: 14,
    color: "#009b85",
    fontWeight: "700",
    flex: 1,
  },

  statusBadge: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },

  statusBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },

  paramsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },

  paramBox: {
    width: "48%",
    minHeight: 74,
    borderWidth: 1,
    borderColor: "#edf0f0",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  paramLabel: {
    color: "#405060",
    fontSize: 13,
  },

  paramValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 1,
  },

  paramHint: {
    fontSize: 10,
    marginTop: 1,
    maxWidth: 110,
  },

  descriptionBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#edf0f0",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  descriptionText: {
    flex: 1,
    color: "#334",
    fontSize: 13,
    lineHeight: 18,
  },

  alertChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  alertChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff2f0",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },

  alertChipText: {
    color: RED,
    fontSize: 13,
    fontWeight: "700",
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f2f2",
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "47%",
  },

  metaText: {
    color: "#526a6a",
    fontSize: 12,
  },

  analyzeButton: {
    marginTop: 16,
    alignSelf: "flex-end",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  analyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  navWrapper: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 14,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 4 : 10,
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },

  navLabel: {
    fontSize: 11,
    marginTop: 3,
  },

  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 8,
  },
});