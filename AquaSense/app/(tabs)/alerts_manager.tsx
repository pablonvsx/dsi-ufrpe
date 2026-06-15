import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

import {
  buscarAlertasParaGestor,
  criarAlertaOperacional,
  encerrarAlertaGestor,
  Alerta,
  NivelAlerta,
} from "@/services/firestore/alerts";

import ManagerBottomNav from "@/components/managerbottomnav";

type FilterTab =
  | "todos"
  | "criticos"
  | "atencao"
  | "recorrentes"
  | "operacionais"
  | "encerrados";

const PRIMARY = "#004d48";
const SURFACE = "#F5F9F8";
const TEXT_MUTED = "#6b7a7a";

function formatarDataAlerta(timestamp: any): string {
  if (!timestamp) return "";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();

  const ontem = new Date(now);
  ontem.setDate(ontem.getDate() - 1);

  const isHoje =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isOntem =
    date.getDate() === ontem.getDate() &&
    date.getMonth() === ontem.getMonth() &&
    date.getFullYear() === ontem.getFullYear();

  const hora = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

  if (isHoje) return `Hoje, ${hora}`;
  if (isOntem) return `Ontem, ${hora}`;

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

function getBadgeConfig(alerta: Alerta) {
  if (alerta.ativo === false) {
    return { label: "ENCERRADO", bg: "#E5E7EB", text: "#6B7280" };
  }

  if (alerta.tipoOrigem === "operacional") {
    return { label: "OPERACIONAL", bg: "#DBEAFE", text: "#1D4ED8" };
  }

  if (alerta.recorrente) {
    return { label: "RECORRENTE", bg: "#D1FAE5", text: "#065F46" };
  }

  if (alerta.nivel === "Crítico") {
    return { label: "CRÍTICO", bg: "#FEE2E2", text: "#DC2626" };
  }

  if (alerta.nivel === "Atenção") {
    return { label: "ATENÇÃO", bg: "#FEF3C7", text: "#D97706" };
  }

  return { label: "INFORMATIVO", bg: "#E0F2F1", text: PRIMARY };
}

function getIconConfig(alerta: Alerta) {
  if (alerta.ativo === false) {
    return { icon: "remove-circle", bg: "#F3F4F6", color: "#9CA3AF" };
  }

  if (alerta.tipoOrigem === "operacional") {
    return { icon: "megaphone", bg: "#DBEAFE", color: "#1D4ED8" };
  }

  if (alerta.recorrente) {
    return { icon: "refresh-circle", bg: "#D1FAE5", color: "#059669" };
  }

  if (alerta.nivel === "Crítico") {
    return { icon: "alert-circle", bg: "#FEE2E2", color: "#DC2626" };
  }

  if (alerta.nivel === "Atenção") {
    return { icon: "warning", bg: "#FEF3C7", color: "#D97706" };
  }

  return { icon: "information-circle", bg: "#E0F2F1", color: PRIMARY };
}

function getStatusText(alerta: Alerta): { text: string; color: string } {
  if (alerta.subtitulo) {
    return { text: alerta.subtitulo, color: PRIMARY };
  }

  if (alerta.ativo === false) {
    return { text: "Alerta encerrado", color: "#9CA3AF" };
  }

  if (alerta.tipoOrigem === "operacional") {
    return { text: "Ação operacional ativa", color: "#1D4ED8" };
  }

  if (alerta.recorrente) {
    return { text: "Padrão recorrente identificado", color: "#059669" };
  }

  if (alerta.nivel === "Crítico") {
    return { text: "Risco ambiental elevado", color: "#DC2626" };
  }

  if (alerta.nivel === "Atenção") {
    return { text: "Qualidade da água comprometida", color: "#D97706" };
  }

  return { text: "Monitoramento ativo", color: PRIMARY };
}

function getDetalhes(alerta: Alerta): string[] {
  if (alerta.detalhes && alerta.detalhes.length > 0) {
    return alerta.detalhes.slice(0, 3);
  }

  if (alerta.ativo === false) {
    return ["Situação normalizada", "Monitoramento contínuo", "Sem novos registros"];
  }

  if (alerta.tipoOrigem === "operacional") {
    return [
      alerta.mensagem || "Em andamento",
      "Criado pelo gestor",
      "Ação operacional",
    ];
  }

  if (alerta.recorrente) {
    return [
      "Ocorrências recorrentes",
      "Padrão identificado",
      "5 alertas nos últimos 30 dias",
    ];
  }

  if (alerta.nivel === "Crítico") {
    return [
      alerta.mensagem || "Risco detectado",
      "Análise em andamento",
      "Requer ação imediata",
    ];
  }

  if (alerta.nivel === "Atenção") {
    return [
      alerta.mensagem || "Qualidade comprometida",
      "Monitoramento ativo",
      "3 observações negativas",
    ];
  }

  return [alerta.mensagem || "Alerta ativo", "Monitoramento contínuo", ""];
}

export default function AlertsManagerScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoCorpo, setNovoCorpo] = useState("");
  const [novaMensagem, setNovaMensagem] = useState("");
  const [novoNivel, setNovoNivel] = useState<NivelAlerta>("Atenção");
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    carregarAlertas();
  }, []);

  async function carregarAlertas() {
    setLoading(true);

    try {
      const dados = await buscarAlertasParaGestor();
      setAlertas(dados);
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      setLoading(false);
    }
  }

  function getAlertasFiltrados(): Alerta[] {
    let filtrados = alertas;

    switch (activeTab) {
      case "criticos":
        filtrados = alertas.filter(
          (a) =>
            a.nivel === "Crítico" &&
            a.ativo !== false &&
            !a.recorrente &&
            a.tipoOrigem !== "operacional"
        );
        break;

      case "atencao":
        filtrados = alertas.filter(
          (a) =>
            a.nivel === "Atenção" &&
            a.ativo !== false &&
            !a.recorrente &&
            a.tipoOrigem !== "operacional"
        );
        break;

      case "recorrentes":
        filtrados = alertas.filter((a) => a.recorrente && a.ativo !== false);
        break;

      case "operacionais":
        filtrados = alertas.filter(
          (a) => a.tipoOrigem === "operacional" && a.ativo !== false
        );
        break;

      case "encerrados":
        filtrados = alertas.filter((a) => a.ativo === false);
        break;

      default:
        filtrados = alertas;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();

      filtrados = filtrados.filter(
        (a) =>
          a.titulo?.toLowerCase().includes(q) ||
          a.corpoHidricoNome?.toLowerCase().includes(q) ||
          a.mensagem?.toLowerCase().includes(q)
      );
    }

    return filtrados;
  }

  async function handleCriarAlerta() {
    if (!novoTitulo.trim() || !userProfile) return;

    setCriando(true);

    try {
      await criarAlertaOperacional({
        titulo: novoTitulo.trim(),
        mensagem: novaMensagem.trim(),
        nivel: novoNivel,
        corpoHidricoNome: novoCorpo.trim() || undefined,
        criadorId: userProfile.uid,
      });

      setModalVisible(false);
      setNovoTitulo("");
      setNovoCorpo("");
      setNovaMensagem("");
      setNovoNivel("Atenção");

      await carregarAlertas();
    } catch (error) {
      console.error("Erro ao criar alerta:", error);
    } finally {
      setCriando(false);
    }
  }

  async function handleEncerrar(alerta: Alerta) {
    await encerrarAlertaGestor(alerta.id);

    setAlertas((prev) =>
      prev.map((a) => (a.id === alerta.id ? { ...a, ativo: false } : a))
    );
  }

  const ativos = alertas.filter((a) => a.ativo !== false);

  const countCriticos = ativos.filter(
    (a) =>
      a.nivel === "Crítico" &&
      !a.recorrente &&
      a.tipoOrigem !== "operacional"
  ).length;

  const countAtencao = ativos.filter(
    (a) =>
      a.nivel === "Atenção" &&
      !a.recorrente &&
      a.tipoOrigem !== "operacional"
  ).length;

  const countRecorrentes = ativos.filter((a) => a.recorrente).length;

  const countEncerrados = alertas.filter((a) => a.ativo === false).length;

  const countOperacionais = ativos.filter(
    (a) => a.tipoOrigem === "operacional"
  ).length;

  const alertasFiltrados = getAlertasFiltrados();
    return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={["#004d48", "#0a6b5e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <SafeAreaView edges={["top"]} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back-outline" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTexts}>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                Alertas
              </Text>

              <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                Monitore e gerencie os alertas do sistema e operacionais.
              </Text>
            </View>

            <Image
              source={require("../../assets/images/aquasense.png")}
              style={styles.headerLogo}
              resizeMode="contain"
              tintColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={styles.novoAlertaBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />

            <Text style={[styles.novoAlertaBtnText, { fontFamily: questrial }]}>
              Novo alerta operacional
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <SummaryCard
            icon="alert-circle"
            iconBg="#FEE2E2"
            iconColor="#DC2626"
            borderColor="#DC2626"
            count={countCriticos}
            label="Críticos"
            sub="Risco elevado"
            questrial={questrial}
          />

          <SummaryCard
            icon="warning"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            borderColor="#D97706"
            count={countAtencao}
            label="Em atenção"
            sub="Monitoramento ativo"
            questrial={questrial}
          />

          <SummaryCard
            icon="refresh-circle"
            iconBg="#D1FAE5"
            iconColor="#059669"
            borderColor="#059669"
            count={countRecorrentes}
            label="Recorrentes"
            sub="Padrões identificados"
            questrial={questrial}
          />

          <SummaryCard
            icon="time"
            iconBg="#F3F4F6"
            iconColor="#6B7280"
            borderColor="#D1D5DB"
            count={countEncerrados}
            label="Encerrados"
            sub="Últimos 30 dias"
            questrial={questrial}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "criticos", label: "Críticos", count: countCriticos },
              { key: "atencao", label: "Em atenção", count: countAtencao },
              { key: "recorrentes", label: "Recorrentes", count: countRecorrentes },
              { key: "operacionais", label: "Operacionais", count: countOperacionais },
              { key: "encerrados", label: "Encerrados" },
            ] as { key: FilterTab; label: string; count?: number }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabText,
                  { fontFamily: questrial },
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>

              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === tab.key && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === tab.key && styles.tabBadgeTextActive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={TEXT_MUTED} />

            <TextInput
              style={[styles.searchInput, { fontFamily: questrial }]}
              placeholder="Buscar por corpo hídrico, região ou tipo de alerta..."
              placeholderTextColor={TEXT_MUTED}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.sortBtn}>
            <Ionicons name="funnel-outline" size={13} color={PRIMARY} />

            <Text style={[styles.sortBtnText, { fontFamily: questrial }]}>
              Mais recentes
            </Text>

            <Ionicons name="chevron-down" size={13} color={PRIMARY} />
          </View>
        </View>

        <View style={styles.listSection}>
          {loading ? (
            <View style={styles.centeredFeedback}>
              <ActivityIndicator color={PRIMARY} size="large" />

              <Text style={[styles.feedbackText, { fontFamily: questrial }]}>
                Carregando alertas...
              </Text>
            </View>
          ) : alertasFiltrados.length === 0 ? (
            <View style={styles.centeredFeedback}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-outline" size={32} color={PRIMARY} />
              </View>

              <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
                Nenhum alerta encontrado
              </Text>

              <Text style={[styles.feedbackText, { fontFamily: questrial }]}>
                Não há alertas para o filtro selecionado.
              </Text>
            </View>
          ) : (
            alertasFiltrados.map((alerta) => (
              <AlertCard
                key={alerta.id}
                alerta={alerta}
                questrial={questrial}
                uid={userProfile?.uid}
                onEncerrar={() => handleEncerrar(alerta)}
              />
            ))
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={PRIMARY}
            style={{ marginTop: 1 }}
          />

          <View style={styles.infoTexts}>
            <Text style={[styles.infoTitle, { fontFamily: questrial }]}>
              Como os alertas são gerados?
            </Text>

            <Text style={[styles.infoDesc, { fontFamily: questrial }]}>
              Alertas automáticos são gerados com base em análises técnicas,
              medições, denúncias e padrões de recorrência identificados pelo
              sistema.
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.7} style={styles.infoLinkBtn}>
            <Text style={[styles.infoLink, { fontFamily: questrial }]}>
              Saiba mais
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
              Novo alerta operacional
            </Text>

            <Text style={[styles.modalSubtitle, { fontFamily: questrial }]}>
              Crie um alerta de ação operacional para sua equipe.
            </Text>

            <Text style={[styles.inputLabel, { fontFamily: questrial }]}>
              Título *
            </Text>

            <TextInput
              style={[styles.inputField, { fontFamily: questrial }]}
              placeholder="Ex: Monitoramento intensivo"
              placeholderTextColor={TEXT_MUTED}
              value={novoTitulo}
              onChangeText={setNovoTitulo}
            />

            <Text style={[styles.inputLabel, { fontFamily: questrial }]}>
              Corpo hídrico
            </Text>

            <TextInput
              style={[styles.inputField, { fontFamily: questrial }]}
              placeholder="Ex: Rio Beberibe"
              placeholderTextColor={TEXT_MUTED}
              value={novoCorpo}
              onChangeText={setNovoCorpo}
            />

            <Text style={[styles.inputLabel, { fontFamily: questrial }]}>
              Descrição
            </Text>

            <TextInput
              style={[styles.inputField, styles.inputMultiline, { fontFamily: questrial }]}
              placeholder="Descreva a ação operacional..."
              placeholderTextColor={TEXT_MUTED}
              value={novaMensagem}
              onChangeText={setNovaMensagem}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.inputLabel, { fontFamily: questrial }]}>
              Nível de prioridade
            </Text>

            <View style={styles.nivelRow}>
              {(["Crítico", "Atenção", "Informativo"] as NivelAlerta[]).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.nivelChip, novoNivel === n && styles.nivelChipActive]}
                  onPress={() => setNovoNivel(n)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.nivelChipText,
                      { fontFamily: questrial },
                      novoNivel === n && styles.nivelChipTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={[styles.modalCancelText, { fontFamily: questrial }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  (!novoTitulo.trim() || criando) && styles.modalSaveBtnDisabled,
                ]}
                onPress={handleCriarAlerta}
                disabled={!novoTitulo.trim() || criando}
                activeOpacity={0.85}
              >
                {criando ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalSaveText, { fontFamily: questrial }]}>
                    Criar alerta
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ManagerBottomNav activeTab="home" fontFamily={questrial} />
    </View>
  );
}
 function SummaryCard({
  icon,
  iconBg,
  iconColor,
  borderColor,
  count,
  label,
  sub,
  questrial,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  count: number;
  label: string;
  sub: string;
  questrial: string | undefined;
}) {
  return (
    <View style={[styles.summaryCard, { borderBottomColor: borderColor }]}>
      <View style={[styles.summaryIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <Text style={[styles.summaryCount, { fontFamily: questrial }]}>
        {count}
      </Text>

      <Text style={[styles.summaryLabel, { fontFamily: questrial }]}>
        {label}
      </Text>

      <Text style={[styles.summarySub, { fontFamily: questrial }]}>
        {sub}
      </Text>
    </View>
  );
}

function AlertCard({
  alerta,
  questrial,
  uid,
  onEncerrar,
}: {
  alerta: Alerta;
  questrial: string | undefined;
  uid?: string;
  onEncerrar: () => void;
}) {
  const badge = getBadgeConfig(alerta);
  const iconCfg = getIconConfig(alerta);
  const status = getStatusText(alerta);
  const detalhes = getDetalhes(alerta).filter(Boolean);

  const encerrado = alerta.ativo === false;

  const criadoPorMim =
    alerta.tipoOrigem === "operacional" && uid && alerta.criadorId === uid;

  const detalheIcons: (keyof typeof Ionicons.glyphMap)[] = [
    "megaphone-outline",
    "water-outline",
    "shield-outline",
  ];

  return (
    <TouchableOpacity
      style={[styles.alertCard, encerrado && styles.alertCardEncerrado]}
      activeOpacity={0.82}
    >
      <View style={styles.alertCardInner}>
        <View style={[styles.alertIcon, { backgroundColor: iconCfg.bg }]}>
          <Ionicons name={iconCfg.icon as any} size={22} color={iconCfg.color} />
        </View>

        <View style={styles.alertCenter}>
          <Text
            style={[styles.alertTitle, { fontFamily: questrial }]}
            numberOfLines={1}
          >
            {alerta.titulo}
          </Text>

          {alerta.corpoHidricoNome ? (
            <Text
              style={[styles.alertLocation, { fontFamily: questrial }]}
              numberOfLines={1}
            >
              {alerta.corpoHidricoNome}
            </Text>
          ) : null}

          <Text
            style={[
              styles.alertStatus,
              {
                fontFamily: questrial,
                color: status.color,
              },
            ]}
            numberOfLines={1}
          >
            {status.text}
          </Text>

          <View style={[styles.alertBadge, { backgroundColor: badge.bg }]}>
            <Text
              style={[
                styles.alertBadgeText,
                {
                  fontFamily: questrial,
                  color: badge.text,
                },
              ]}
            >
              {badge.label}
            </Text>
          </View>

          <Text style={[styles.alertBadgeSub, { fontFamily: questrial }]}>
            {criadoPorMim ? "Criado por você" : "Alerta automático"}
          </Text>
        </View>

        <View style={styles.alertRight}>
          <Text style={[styles.alertTime, { fontFamily: questrial }]}>
            {formatarDataAlerta(alerta.criadoEm)}
          </Text>

          <View style={styles.alertDetails}>
            {detalhes.map((d, i) => (
              <View key={i} style={styles.alertDetailRow}>
                <Ionicons
                  name={detalheIcons[i] ?? "ellipse-outline"}
                  size={11}
                  color={TEXT_MUTED}
                />

                <Text
                  style={[styles.alertDetailText, { fontFamily: questrial }]}
                  numberOfLines={1}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <Ionicons
            name="chevron-forward"
            size={15}
            color="#C0C8C8"
            style={{
              alignSelf: "flex-end",
              marginTop: 6,
            }}
          />
        </View>
      </View>

      {alerta.tipoOrigem === "operacional" && alerta.ativo !== false && (
        <TouchableOpacity
          style={styles.encerrarBtn}
          onPress={onEncerrar}
          activeOpacity={0.7}
        >
          <Text style={[styles.encerrarBtnText, { fontFamily: questrial }]}>
            Encerrar
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
  const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  headerSafe: {
    paddingTop: Platform.OS === "android" ? 40 : 10,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  headerTexts: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    marginTop: 4,
    lineHeight: 18,
  },

  headerLogo: {
    width: 44,
    height: 44,
  },

  novoAlertaBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  novoAlertaBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  body: {
    flex: 1,
  },

  bodyContent: {
    paddingBottom: 110,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderBottomWidth: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },

  summaryCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 24,
  },

  summaryLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
    marginTop: 2,
  },

  summarySub: {
    fontSize: 8,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 1,
  },

  tabsScroll: {
    backgroundColor: SURFACE,
  },

  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: "row",
  },

  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },

  tabActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tabText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },

  tabTextActive: {
    color: "#fff",
  },

  tabBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },

  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  tabBadgeText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "700",
  },

  tabBadgeTextActive: {
    color: "#fff",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#111827",
    padding: 0,
  },

  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  sortBtnText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "600",
  },

  listSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  centeredFeedback: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },

  feedbackText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
  },

  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: "700",
    textAlign: "center",
  },

  alertCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },

  alertCardEncerrado: {
    opacity: 0.72,
  },

  alertCardInner: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    alignItems: "flex-start",
  },

  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  alertCenter: {
    flex: 1,
    minWidth: 0,
  },

  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 1,
  },

  alertLocation: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 2,
  },

  alertStatus: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },

  alertBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 3,
  },

  alertBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  alertBadgeSub: {
    fontSize: 10,
    color: TEXT_MUTED,
  },

  alertRight: {
    alignItems: "flex-end",
    flexShrink: 0,
    width: 115,
  },

  alertTime: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginBottom: 6,
    textAlign: "right",
  },

  alertDetails: {
    gap: 4,
    width: "100%",
  },

  alertDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  alertDetailText: {
    fontSize: 10,
    color: TEXT_MUTED,
    flex: 1,
  },

  encerrarBtn: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingVertical: 10,
    alignItems: "center",
  },

  encerrarBtnText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    margin: 16,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E0F2F1",
  },

  infoTexts: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  infoDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 16,
  },

  infoLinkBtn: {
    marginTop: 2,
  },

  infoLink: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },

  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  modalSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 20,
    lineHeight: 19,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    marginTop: 2,
  },

  inputField: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
    marginBottom: 12,
  },

  inputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },

  nivelRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  nivelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  nivelChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  nivelChipText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },

  nivelChipTextActive: {
    color: "#fff",
  },

  modalActions: {
    flexDirection: "row",
    gap: 12,
  },

  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },

  modalCancelText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "700",
  },

  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
  },

  modalSaveBtnDisabled: {
    opacity: 0.5,
  },

  modalSaveText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
});