import React, { useState, useEffect } from "react";
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
  Platform,
  Image,
  RefreshControl,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

import {
  ItemValidacao,
  TipoValidacao,
  buscarValidacoesPendentes,
  aprovarValidacao,
  rejeitarValidacao,
} from "@/services/firestore/validacoes";

import ManagerBottomNav from "@/components/managerbottomnav";
import { buscarAlertasDoUsuario } from "@/services/firestore/alerts";

const PRIMARY = "#004d48";
const SURFACE = "#F5F9F8";

type TabKey = "pendentes" | "historico";

interface TipoConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}

function tipoConfig(tipo: TipoValidacao, criticidade?: string): TipoConfig {
  switch (tipo) {
    case "analise_tecnica": {
      const isCritica = criticidade === "critica";
      const isAtencao = criticidade === "atencao";

      return {
        label: "ANÁLISE TÉCNICA",
        badgeBg: "#FEE2E2",
        badgeText: "#DC2626",
        borderColor: isCritica ? "#EF4444" : isAtencao ? "#F97316" : "#22C55E",
        icon: "flask-outline",
        iconBg: "#FEE2E2",
        iconColor: "#DC2626",
      };
    }

    case "medicao_simples":
      return {
        label: "MEDIÇÃO SIMPLES",
        badgeBg: "#DBEAFE",
        badgeText: "#1D4ED8",
        borderColor: "#3B82F6",
        icon: "water-outline",
        iconBg: "#DBEAFE",
        iconColor: "#1D4ED8",
      };

    case "medicao_completa":
      return {
        label: "ANÁLISE COMPLETA",
        badgeBg: "#E0F2FE",
        badgeText: "#0369A1",
        borderColor: "#0EA5E9",
        icon: "beaker-outline",
        iconBg: "#E0F2FE",
        iconColor: "#0369A1",
      };

    case "novo_registro":
      return {
        label: "NOVO REGISTRO",
        badgeBg: "#DCFCE7",
        badgeText: "#166534",
        borderColor: "#22C55E",
        icon: "location-outline",
        iconBg: "#DCFCE7",
        iconColor: "#16A34A",
      };

    case "denuncia":
      return {
        label: "DENÚNCIA",
        badgeBg: "#FEF3C7",
        badgeText: "#92400E",
        borderColor: "#F97316",
        icon: "megaphone-outline",
        iconBg: "#FEF3C7",
        iconColor: "#F97316",
      };
  }
}
function formatarData(date?: Date): string {
  if (!date) return "-";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ValidacoesManagerScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();

  const [fontsLoaded] = useFonts({
    Questrial_400Regular,
  });

  const questrial = fontsLoaded
    ? "Questrial_400Regular"
    : undefined;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] =
    useState<TabKey>("pendentes");

  const [search, setSearch] = useState("");

  const [validacoes, setValidacoes] =
    useState<ItemValidacao[]>([]);

  const [selectedItem, setSelectedItem] =
    useState<ItemValidacao | null>(null);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [motivoRejeicao, setMotivoRejeicao] =
    useState("");

  const [notificacoes, setNotificacoes] =
    useState(0);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      setLoading(true);

      const [lista, alertas] =
        await Promise.all([
          buscarValidacoesPendentes(),
          userProfile?.uid
            ? buscarAlertasDoUsuario(
                userProfile.uid
              )
            : Promise.resolve([]),
        ]);

      setValidacoes(lista);

      setNotificacoes(
        alertas.filter(
          (a) =>
            !a.lidoPor?.includes(
              userProfile?.uid ?? ""
            )
        ).length
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await carregarDados();
    } finally {
      setRefreshing(false);
    }
  }

  async function aprovar(
    item: ItemValidacao
  ) {
    if (!userProfile) return;

    try {
      await aprovarValidacao(
        item,
        userProfile.uid
      );

      Alert.alert(
        "Validação aprovada",
        "A solicitação foi aprovada com sucesso."
      );

      await carregarDados();
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Erro",
        "Não foi possível aprovar a validação."
      );
    }
  }

  async function rejeitar() {
    if (
      !selectedItem ||
      !userProfile ||
      !motivoRejeicao.trim()
    ) {
      return;
    }

    try {
      await rejeitarValidacao(
        selectedItem,
        userProfile.uid,
        motivoRejeicao
      );

      setModalVisible(false);
      setMotivoRejeicao("");
      setSelectedItem(null);

      Alert.alert(
        "Validação rejeitada",
        "A solicitação foi rejeitada."
      );

      await carregarDados();
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Erro",
        "Não foi possível rejeitar a validação."
      );
    }
  }

  const filtradas =
    validacoes.filter((item) => {
      const termo =
        search.toLowerCase();

      return (
        item.corpoHidricoNome
          ?.toLowerCase()
          .includes(termo) ||
        item.colaboradorNome
          ?.toLowerCase()
          .includes(termo) ||
        item.descricao
          ?.toLowerCase()
          .includes(termo)
      );
    });

  const criticas =
    validacoes.filter(
      (v) =>
        v.criticidade ===
        "critica"
    ).length;

  const atencao =
    validacoes.filter(
      (v) =>
        v.criticidade ===
        "atencao"
    ).length;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent:
            "center",
          alignItems: "center",
          backgroundColor:
            SURFACE,
        }}
      >
        <ActivityIndicator
          size="large"
          color={PRIMARY}
        />
      </View>
    );
}
return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        <LinearGradient
          colors={["#004d48", "#0a6b5e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandRow}>
                <Image
                  source={require("../../assets/images/aquasense.png")}
                  style={styles.headerLogo}
                  resizeMode="contain"
                  tintColor="#FFFFFF"
                />

                <View style={styles.gestorBadge}>
                  <Text style={styles.gestorBadgeText}>Gestor</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
                  <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />

                  {notificacoes > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>
                        {notificacoes > 9 ? "9+" : notificacoes}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => router.push("/(tabs)/profile" as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.profileCircle}>
                    <Ionicons name="person" size={18} color={PRIMARY} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.headerTitleRow}>
              <View style={styles.headerTitleLeft}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                  Validações
                </Text>

                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Acompanhe e gerencie todas as validações sob sua responsabilidade.
                </Text>
              </View>

              <TouchableOpacity style={styles.filtrosBtn} activeOpacity={0.8}>
                <Ionicons name="options-outline" size={16} color={PRIMARY} />

                <Text style={[styles.filtrosBtnText, { fontFamily: questrial }]}>
                  Filtros
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsScrollContent}
          >
            <TouchableOpacity
              style={[styles.tabBtn, tab === "pendentes" && styles.tabBtnActive]}
              onPress={() => setTab("pendentes")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { fontFamily: questrial },
                  tab === "pendentes" && styles.tabBtnTextActive,
                ]}
              >
                Pendentes
              </Text>

              {validacoes.length > 0 && (
                <View
                  style={[
                    styles.tabCountBadge,
                    tab === "pendentes" && styles.tabCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      tab === "pendentes" && styles.tabCountTextActive,
                    ]}
                  >
                    {validacoes.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === "historico" && styles.tabBtnActive]}
              onPress={() => setTab("historico")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { fontFamily: questrial },
                  tab === "historico" && styles.tabBtnTextActive,
                ]}
              >
                Histórico
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por corpo hídrico, origem ou colaborador..."
                placeholderTextColor="#9CA3AF"
                style={[styles.searchInput, { fontFamily: questrial }]}
              />

              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[PRIMARY]}
                tintColor={PRIMARY}
              />
            }
          >
            {filtradas.length === 0 ? (
              <EmptyState questrial={questrial} />
            ) : (
              <>
                <View style={styles.summaryMiniRow}>
                  <View style={styles.summaryMiniCard}>
                    <Text style={[styles.summaryMiniNumber, { fontFamily: questrial }]}>
                      {validacoes.length}
                    </Text>
                    <Text style={[styles.summaryMiniLabel, { fontFamily: questrial }]}>
                      Pendentes
                    </Text>
                  </View>

                  <View style={styles.summaryMiniCard}>
                    <Text style={[styles.summaryMiniNumberRed, { fontFamily: questrial }]}>
                      {criticas}
                    </Text>
                    <Text style={[styles.summaryMiniLabel, { fontFamily: questrial }]}>
                      Críticas
                    </Text>
                  </View>

                  <View style={styles.summaryMiniCard}>
                    <Text style={[styles.summaryMiniNumberOrange, { fontFamily: questrial }]}>
                      {atencao}
                    </Text>
                    <Text style={[styles.summaryMiniLabel, { fontFamily: questrial }]}>
                      Atenção
                    </Text>
                  </View>
                </View>

                {filtradas.map((item) => (
                  <ValidationCard
                    key={`${item.tipo}-${item.id}`}
                    item={item}
                    questrial={questrial}
                    onAprovar={() => aprovar(item)}
                    onRejeitar={() => {
                      setSelectedItem(item);
                      setModalVisible(true);
                    }}
                  />
                ))}

                <Text style={[styles.totalText, { fontFamily: questrial }]}>
                  Mostrando {filtradas.length} de {validacoes.length} validações pendentes
                </Text>
              </>
            )}
          </ScrollView>
        </View>

        <ManagerBottomNav activeTab="validacoes" fontFamily={questrial} />
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                  Rejeitar validação
                </Text>

                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={PRIMARY} />
                </TouchableOpacity>
              </View>

              {selectedItem && (
                <View style={styles.modalItemPreview}>
                  <View style={styles.modalItemIcon}>
                    <Ionicons name="close-circle-outline" size={28} color="#DC2626" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemName, { fontFamily: questrial }]}>
                      {selectedItem.corpoHidricoNome}
                    </Text>

                    <Text style={[styles.modalItemColaborador, { fontFamily: questrial }]}>
                      {selectedItem.colaboradorNome}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.rejeicaoLabel, { fontFamily: questrial }]}>
                Motivo da rejeição *
              </Text>

              <TextInput
                value={motivoRejeicao}
                onChangeText={setMotivoRejeicao}
                placeholder="Descreva o motivo..."
                placeholderTextColor="#9CA3AF"
                multiline
                style={[styles.rejeicaoInput, { fontFamily: questrial }]}
              />

              <View style={styles.rejeicaoButtons}>
                <TouchableOpacity
                  style={styles.btnCancelarRejeicao}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.btnCancelarRejeicaoText, { fontFamily: questrial }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnConfirmarRejeicao}
                  onPress={rejeitar}
                >
                  <Text style={[styles.btnConfirmarRejeicaoText, { fontFamily: questrial }]}>
                    Confirmar rejeição
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

interface MetaCol {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value: string;
  valueColor?: string;
}

function criticidadeConfig(criticidade?: string): {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (criticidade === "critica") {
    return {
      label: "Crítica",
      color: "#EF4444",
      icon: "alert-circle",
    };
  }

  if (criticidade === "atencao") {
    return {
      label: "Atenção",
      color: "#F97316",
      icon: "warning",
    };
  }

  return {
    label: "Normal",
    color: "#22C55E",
    icon: "checkmark-circle",
  };
}

function buildMeta(item: ItemValidacao): MetaCol[] {
  const crit = criticidadeConfig(item.criticidade);

  return [
    {
      icon: crit.icon,
      iconColor: crit.color,
      label: "Criticidade",
      value: crit.label,
      valueColor: crit.color,
    },
    {
      icon: "calendar-outline",
      label: "Data",
      value: formatarData(item.dataCriacao),
    },
    {
      icon: "person-outline",
      label: "Colaborador",
      value: item.colaboradorNome,
    },
    {
      icon: "location-outline",
      label: "Local",
      value: item.localidade ?? item.corpoHidricoNome,
    },
  ];
}
function ValidationCard({
  item,
  questrial,
  onAprovar,
  onRejeitar,
}: {
  item: ItemValidacao;
  questrial?: string;
  onAprovar: () => void;
  onRejeitar: () => void;
}) {
  const cfg = tipoConfig(item.tipo, item.criticidade);
  const meta = buildMeta(item);

  return (
    <View style={[styles.card, { borderLeftColor: cfg.borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: cfg.iconBg }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
        </View>

        <View style={styles.cardHeaderTexts}>
          <Text style={[styles.cardTitle, { fontFamily: questrial }]} numberOfLines={1}>
            {item.corpoHidricoNome}
          </Text>

          <Text style={[styles.cardSubtitle, { fontFamily: questrial }]} numberOfLines={1}>
            {item.colaboradorNome}
          </Text>
        </View>

        <View style={[styles.typeBadge, { backgroundColor: cfg.badgeBg }]}>
          <Text style={[styles.typeBadgeText, { color: cfg.badgeText, fontFamily: questrial }]}>
            {cfg.label}
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        {meta.map((m, i) => (
          <View key={i} style={styles.metaItem}>
            <View style={styles.metaIconRow}>
              <Ionicons name={m.icon} size={13} color={m.iconColor ?? "#9CA3AF"} />

              <Text style={[styles.metaLabel, { fontFamily: questrial }]}>
                {m.label}
              </Text>
            </View>

            <Text
              style={[
                styles.metaValue,
                {
                  fontFamily: questrial,
                  color: m.valueColor ?? "#374151",
                },
              ]}
              numberOfLines={1}
            >
              {m.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        {item.descricao ? (
          <View style={styles.cardDesc}>
            <Ionicons
              name={
                item.criticidade === "critica"
                  ? "alert-circle-outline"
                  : "information-circle-outline"
              }
              size={14}
              color={item.criticidade === "critica" ? "#F97316" : "#9CA3AF"}
            />

            <Text style={[styles.cardDescText, { fontFamily: questrial }]} numberOfLines={2}>
              {item.descricao}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.cardButtons}>
          <TouchableOpacity style={styles.aprovarMiniBtn} onPress={onAprovar} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejeitarMiniBtn} onPress={onRejeitar} activeOpacity={0.85}>
            <Ionicons name="close" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ questrial }: { questrial?: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="checkmark-circle-outline" size={36} color={PRIMARY} />
      </View>

      <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
        Nenhuma validação pendente
      </Text>

      <Text style={[styles.emptySubtitle, { fontFamily: questrial }]}>
        Todas as validações foram processadas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  headerSafeArea: {
    paddingBottom: 0,
  },

  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerLogo: {
    width: 36,
    height: 36,
  },

  gestorBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  gestorBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  bellButton: {
    position: "relative",
    padding: 4,
  },

  bellBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },

  bellBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  profileButton: {
    padding: 2,
  },

  profileCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 12,
  },

  headerTitleLeft: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },

  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 17,
  },

  filtrosBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
  },

  filtrosBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  contentPanel: {
    flex: 1,
    backgroundColor: SURFACE,
    marginTop: -14,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  tabsScroll: {
    flexGrow: 0,
  },

  tabsScrollContent: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 8,
  },

  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },

  tabBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },

  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  tabCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  tabCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  tabCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },

  tabCountTextActive: {
    color: "#FFFFFF",
  },

  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
  },

  listScroll: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  summaryMiniRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  summaryMiniCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  summaryMiniNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: PRIMARY,
  },

  summaryMiniNumberRed: {
    fontSize: 22,
    fontWeight: "700",
    color: "#EF4444",
  },

  summaryMiniNumberOrange: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F97316",
  },

  summaryMiniLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },

  totalText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    overflow: "hidden",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 10,
    gap: 10,
  },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  cardHeaderTexts: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },

  cardSubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
  },

  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginLeft: 4,
    flexShrink: 0,
  },

  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
    rowGap: 10,
  },

  metaItem: {
    width: "50%",
    paddingRight: 8,
  },

  metaIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },

  metaLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  metaValue: {
    fontSize: 12,
    fontWeight: "600",
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },

  cardDesc: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  cardDescText: {
    flex: 1,
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 16,
  },

  cardButtons: {
    flexDirection: "row",
    gap: 6,
  },

  aprovarMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },

  rejeitarMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },

  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E6F4F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },

  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "75%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 30 : 22,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY,
  },

  modalItemPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    padding: 14,
    backgroundColor: SURFACE,
    borderRadius: 14,
  },

  modalItemIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: "#FEE2E2",
  },

  modalItemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },

  modalItemColaborador: {
    fontSize: 12,
    color: "#6B7280",
  },

  rejeicaoLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 8,
  },

  rejeicaoInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    fontSize: 13,
    color: "#374151",
    textAlignVertical: "top",
    marginBottom: 12,
  },

  rejeicaoButtons: {
    flexDirection: "row",
    gap: 10,
  },

  btnCancelarRejeicao: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 13,
    alignItems: "center",
  },

  btnCancelarRejeicaoText: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
  },

  btnConfirmarRejeicao: {
    flex: 2,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    alignItems: "center",
  },

  btnConfirmarRejeicaoText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});