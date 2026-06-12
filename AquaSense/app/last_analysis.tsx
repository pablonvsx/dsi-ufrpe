/**
 * Tela: Última Análise de Corpo Hídrico
 * Exibe análises, parâmetros, resumo comunitário e histórico completo
 * Integração: Firestore (coletaCompleta, coletaSimples)
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { buscarAnalisesPorCorpo, avaliarSaudeCorporoHidrico } from "@/services/firestore/analysis";

// ═══════════════════════════════════════════════════════════════════════════
// CORES E ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const PRIMARY = "#004d48";
const PRIMARY_LIGHT = "#00695c";
const ACCENT = "#00897b";
const SUCCESS = "#10b981";
const WARNING = "#f59e0b";
const DANGER = "#ef4444";
const BORDER_LIGHT = "#e0f2f1";
const TEXT_MUTED = "#6b7a7a";
const SURFACE = "#f9fafb";
const WHITE = "#ffffff";

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface ColetaSimples {
  id: string;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  tipo: "medicao" | "observacao";
  latitude?: number;
  longitude?: number;
  pH?: number;
  temperatura?: number;
  cor?: string;
  odor?: string;
  observacaoVisual?: {
    lixo: boolean;
    animaisMortos: boolean;
    despejosEsgoto: boolean;
    esgotoVisivel: boolean;
    coloracaoAnormal: boolean;
    odorAnormal: boolean;
    espumaOuResiduos: boolean;
  };
  descricao: string;
  usuarioNome: string;
  dataCriacao: any;
  status: "pendente" | "validado" | "revisado";
}

interface ColetaCompleta {
  id: string;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  usuarioNome: string;
  dataCriacao: any;
  [key: string]: any;
}

interface AnalisadoData {
  ultimaMedicao: ColetaSimples | ColetaCompleta | null;
  ultimaObservacao: ColetaSimples | null;
  totalMedicoes: number;
  totalObservacoes: number;
  mediacaoPH: number;
  medicaoTemperatura: number;
  todasAnalises: (ColetaSimples | ColetaCompleta)[];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function LastAnalysis() {
  const router = useRouter();
  const params = useLocalSearchParams<{ corpoHidricoId: string; corpoHidricoNome?: string }>();

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [analisado, setAnalisado] = useState<AnalisadoData | null>(null);
  const [saudeCorpo, setSaudeCorpo] = useState<{
    status: string;
    descricao: string;
    score: number;
  } | null>(null);
  const [modalDetalhesVisible, setModalDetalhesVisible] = useState(false);
  const [modalHistoricoVisible, setModalHistoricoVisible] = useState(false);
  const [selectedAnalise, setSelectedAnalise] = useState<ColetaSimples | ColetaCompleta | null>(null);

  const slideAnim = useRef(new Animated.Value(50)).current;

  // ─────────────────────────────────────────────────────────────
  // EFEITOS
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    if (params.corpoHidricoId) {
      carregarAnalises(params.corpoHidricoId);
    } else {
      Alert.alert("Erro", "Corpo hídrico não identificado");
      router.back();
    }
  }, [params.corpoHidricoId]);

  // ─────────────────────────────────────────────────────────────
  // FUNÇÕES
  // ─────────────────────────────────────────────────────────────

  const carregarAnalises = async (corpoId: string) => {
    try {
      setLoading(true);
      const data = await buscarAnalisesPorCorpo(corpoId);
      const saude = await avaliarSaudeCorporoHidrico(corpoId);
      setAnalisado(data);
      setSaudeCorpo(saude);
    } catch (error) {
      console.error("Erro ao carregar análises:", error);
      Alert.alert("Erro", "Não foi possível carregar as análises");
    } finally {
      setLoading(false);
    }
  };

  const buscarAnalisesFirestore = async (corpoId: string): Promise<AnalisadoData> => {
    return buscarAnalisesPorCorpo(corpoId);
  };

  const formatarData = (data: any): string => {
    if (!data) return "Data desconhecida";
    const date = data.toDate?.() || data;
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSituacaoStatus = (): { status: string; color: string; icon: string } => {
    if (!saudeCorpo) {
      const pH = (analisado?.ultimaMedicao as any)?.pH;
      if (pH >= 6 && pH <= 8.5) {
        return { status: "Excelente", color: SUCCESS, icon: "checkmark-circle" };
      } else if (pH >= 5 && pH <= 9) {
        return { status: "Bom", color: "#8b5cf6", icon: "checkmark" };
      } else {
        return { status: "Crítico", color: DANGER, icon: "alert-circle" };
      }
    }

    switch (saudeCorpo.status) {
      case "excelente":
        return { status: "Excelente", color: SUCCESS, icon: "checkmark-circle" };
      case "bom":
        return { status: "Bom", color: "#8b5cf6", icon: "checkmark" };
      case "alerta":
        return { status: "Alerta", color: WARNING, icon: "alert-circle" };
      case "critico":
        return { status: "Crítico", color: DANGER, icon: "alert-circle" };
      default:
        return { status: "Sem dados", color: TEXT_MUTED, icon: "help-circle" };
    }
  };

  const handleVerHistorico = () => {
    setModalHistoricoVisible(true);
  };

  const handleVerDetalhes = (analise: ColetaSimples | ColetaCompleta) => {
    setSelectedAnalise(analise);
    setModalDetalhesVisible(true);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[PRIMARY, PRIMARY_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={WHITE} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Análise da Água</Text>
            <View style={{ width: 28 }} />
          </View>
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Carregando análises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const situacao = getSituacaoStatus();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={WHITE} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Análise da Água</Text>
            <Text style={styles.headerSubtitle}>{params.corpoHidricoNome}</Text>
          </View>
          <MaterialIcons name="water-drop" size={28} color={WHITE} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CARD: SITUAÇÃO GERAL */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <Animated.View
          style={[
            styles.section,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.situacaoCard, { borderLeftColor: situacao.color }]}>
            <View style={styles.situacaoHeader}>
              <View>
                <Text style={styles.situacaoLabel}>Situação Geral</Text>
                <Text style={[styles.situacaoStatus, { color: situacao.color }]}>
                  {situacao.status}
                </Text>
              </View>
              <View
                style={[
                  styles.situacaoIconContainer,
                  { backgroundColor: `${situacao.color}20` },
                ]}
              >
                <Ionicons name={situacao.icon as any} size={32} color={situacao.color} />
              </View>
            </View>

            <View style={styles.situacaoDescription}>
              <Text style={styles.situacaoDescText}>
                {saudeCorpo?.descricao ||
                  (situacao.status === "Excelente"
                    ? "Parâmetros dentro dos limites recomendados"
                    : situacao.status === "Bom"
                    ? "Alguns parâmetros requerem atenção"
                    : "Condições críticas detectadas")}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CARD: PARÂMETROS PRINCIPAIS */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {analisado?.ultimaMedicao && (analisado.ultimaMedicao as any).tipo === "medicao" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flask" size={20} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Parâmetros Principais</Text>
            </View>

            <View style={styles.parametrosGrid}>
              {/* pH */}
              <View style={styles.parametroCard}>
                <Text style={styles.parametroLabel}>pH</Text>
                <Text style={styles.parametroValue}>
                  {((analisado.ultimaMedicao as any).pH || 0).toFixed(1)}
                </Text>
                <Text style={styles.parametroDesc}>
                  {((analisado.ultimaMedicao as any).pH || 0) >= 6 &&
                  ((analisado.ultimaMedicao as any).pH || 0) <= 8.5
                    ? "✅ Normal"
                    : "⚠️ Fora do ideal"}
                </Text>
              </View>

              {/* Temperatura */}
              <View style={styles.parametroCard}>
                <Text style={styles.parametroLabel}>Temperatura</Text>
                <Text style={styles.parametroValue}>
                  {((analisado.ultimaMedicao as any).temperatura || 0).toFixed(1)}°C
                </Text>
                <Text style={styles.parametroDesc}>Presente</Text>
              </View>

              {/* Cor */}
              <View style={styles.parametroCard}>
                <Text style={styles.parametroLabel}>Cor</Text>
                <Text style={styles.parametroValue}>
                  {(() => {
                    const cor = ((analisado.ultimaMedicao as any).cor || "clara").toLowerCase();
                    switch (cor) {
                      case "clara":
                        return "💧";
                      case "levemente_turva":
                        return "💛";
                      case "turva":
                        return "🧡";
                      case "muito_turva":
                        return "❤️";
                      default:
                        return "?";
                    }
                  })()}
                </Text>
                <Text style={styles.parametroDesc}>
                  {((analisado.ultimaMedicao as any).cor || "clara")
                    .replace(/_/g, " ")
                    .toLowerCase()}
                </Text>
              </View>

              {/* Odor */}
              <View style={styles.parametroCard}>
                <Text style={styles.parametroLabel}>Odor</Text>
                <Text style={styles.parametroValue}>
                  {((analisado.ultimaMedicao as any).odor || "sem_odor").includes("sem")
                    ? "😊"
                    : ((analisado.ultimaMedicao as any).odor || "").includes("leve")
                    ? "😐"
                    : "😖"}
                </Text>
                <Text style={styles.parametroDesc}>
                  {((analisado.ultimaMedicao as any).odor || "sem_odor")
                    .replace(/_/g, " ")
                    .toLowerCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detalhesButton}
              onPress={() => handleVerDetalhes(analisado.ultimaMedicao!)}
            >
              <Text style={styles.detalhesButtonText}>Ver detalhes completos</Text>
              <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
            </TouchableOpacity>

            <Text style={styles.dataRegistro}>
              📅 {formatarData((analisado.ultimaMedicao as any).dataCriacao)} • Por{" "}
              {(analisado.ultimaMedicao as any).usuarioNome}
            </Text>
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CARD: RESUMO DA COMUNIDADE */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Resumo da Comunidade</Text>
          </View>

          <View style={styles.resumoGrid}>
            {/* Medicões */}
            <View style={styles.resumoCard}>
              <Ionicons name="flask" size={28} color={PRIMARY} />
              <Text style={styles.resumoValue}>{analisado?.totalMedicoes || 0}</Text>
              <Text style={styles.resumoLabel}>Medições</Text>
            </View>

            {/* Observações */}
            <View style={styles.resumoCard}>
              <Ionicons name="eye" size={28} color={ACCENT} />
              <Text style={styles.resumoValue}>{analisado?.totalObservacoes || 0}</Text>
              <Text style={styles.resumoLabel}>Observações</Text>
            </View>

            {/* Total */}
            <View style={styles.resumoCard}>
              <Ionicons name="stats-chart" size={28} color={WARNING} />
              <Text style={styles.resumoValue}>
                {(analisado?.totalMedicoes || 0) + (analisado?.totalObservacoes || 0)}
              </Text>
              <Text style={styles.resumoLabel}>Total</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.historicoButton}
            onPress={handleVerHistorico}
          >
            <Ionicons name="time" size={20} color={WHITE} />
            <Text style={styles.historicoButtonText}>Ver Histórico Completo</Text>
            <Ionicons name="arrow-forward" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CARD: ÚLTIMO REGISTRO MEDIÇÃO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {analisado?.ultimaMedicao && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document" size={20} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Última Medição</Text>
            </View>

            <TouchableOpacity
              style={styles.ultimoRegistroCard}
              onPress={() => handleVerDetalhes(analisado.ultimaMedicao!)}
              activeOpacity={0.8}
            >
              <View style={styles.ultimoRegistroHeader}>
                <View>
                  <Text style={styles.ultimoRegistroTipo}>Medição Simples</Text>
                  <Text style={styles.ultimoRegistroData}>
                    {formatarData((analisado.ultimaMedicao as any).dataCriacao)}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Ionicons
                    name={
                      (analisado.ultimaMedicao as any).status === "validado"
                        ? "checkmark-circle"
                        : "time"
                    }
                    size={20}
                    color={
                      (analisado.ultimaMedicao as any).status === "validado" ? SUCCESS : WARNING
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          (analisado.ultimaMedicao as any).status === "validado"
                            ? SUCCESS
                            : WARNING,
                      },
                    ]}
                  >
                    {(analisado.ultimaMedicao as any).status === "validado"
                      ? "Validado"
                      : "Pendente"}
                  </Text>
                </View>
              </View>

              <View style={styles.ultimoRegistroParams}>
                <View style={styles.ultimoRegistroParam}>
                  <Text style={styles.ultimoRegistroParamLabel}>pH</Text>
                  <Text style={styles.ultimoRegistroParamValue}>
                    {((analisado.ultimaMedicao as any).pH || 0).toFixed(1)}
                  </Text>
                </View>
                <View style={styles.ultimoRegistroParam}>
                  <Text style={styles.ultimoRegistroParamLabel}>Temp</Text>
                  <Text style={styles.ultimoRegistroParamValue}>
                    {((analisado.ultimaMedicao as any).temperatura || 0).toFixed(1)}°C
                  </Text>
                </View>
                <View style={styles.ultimoRegistroParam}>
                  <Text style={styles.ultimoRegistroParamLabel}>Cor</Text>
                  <Text style={styles.ultimoRegistroParamValue}>
                    {(() => {
                      const cor = ((analisado.ultimaMedicao as any).cor || "clara").toLowerCase();
                      switch (cor) {
                        case "clara":
                          return "💧";
                        case "levemente_turva":
                          return "💛";
                        case "turva":
                          return "🧡";
                        case "muito_turva":
                          return "❤️";
                        default:
                          return "?";
                      }
                    })()}
                  </Text>
                </View>
              </View>

              <View style={styles.verMaisIndicator}>
                <Text style={styles.verMaisText}>Tocar para ver todos os dados</Text>
                <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CARD: ÚLTIMA OBSERVAÇÃO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {analisado?.ultimaObservacao && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="eye" size={20} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Última Observação Visual</Text>
            </View>

            <TouchableOpacity
              style={styles.ultimoRegistroCard}
              onPress={() => handleVerDetalhes(analisado.ultimaObservacao!)}
              activeOpacity={0.8}
            >
              <View style={styles.ultimoRegistroHeader}>
                <View>
                  <Text style={styles.ultimoRegistroTipo}>Observação Visual</Text>
                  <Text style={styles.ultimoRegistroData}>
                    {formatarData((analisado.ultimaObservacao as any).dataCriacao)}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={SUCCESS} />
                  <Text style={[styles.statusText, { color: SUCCESS }]}>Validado</Text>
                </View>
              </View>

              <View style={styles.observacaoList}>
                {(() => {
                  const obs = (analisado.ultimaObservacao as any).observacaoVisual || {};
                  const items = [
                    { key: "lixo", label: "Lixo", emoji: "🗑️" },
                    { key: "animaisMortos", label: "Animais mortos", emoji: "🐟" },
                    { key: "despejosEsgoto", label: "Despejos", emoji: "💧" },
                    { key: "esgotoVisivel", label: "Esgoto visível", emoji: "⚠️" },
                    { key: "coloracaoAnormal", label: "Coloração", emoji: "🎨" },
                    { key: "odorAnormal", label: "Odor", emoji: "👃" },
                    { key: "espumaOuResiduos", label: "Espuma", emoji: "🫧" },
                  ];

                  const marcados = items.filter((item) => obs[item.key]).length;
                  return (
                    <Text style={styles.observacaoText}>
                      {marcados === 0 ? (
                        <Text>
                          ✅ Nenhuma observação negativa detectada (0/7 problemas encontrados)
                        </Text>
                      ) : (
                        <Text>
                          ⚠️ {marcados} problema(s) observado(s) ({marcados}/7 itens marcados)
                        </Text>
                      )}
                    </Text>
                  );
                })()}
              </View>

              <View style={styles.verMaisIndicator}>
                <Text style={styles.verMaisText}>Tocar para ver todos os dados</Text>
                <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: DETALHES COMPLETOS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalDetalhesVisible}
        animationType="slide"
        onRequestClose={() => setModalDetalhesVisible(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalDetalhesVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={28} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detalhes da Análise</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedAnalise && (
              <>
                {/* Tipo */}
                <View style={styles.detalheSection}>
                  <Text style={styles.detalheLabel}>Tipo</Text>
                  <Text style={styles.detalheValue}>
                    {(selectedAnalise as any).tipo === "medicao"
                      ? "Medição Simples"
                      : "Observação Visual"}
                  </Text>
                </View>

                {/* Data */}
                <View style={styles.detalheSection}>
                  <Text style={styles.detalheLabel}>Data e Hora</Text>
                  <Text style={styles.detalheValue}>
                    {formatarData((selectedAnalise as any).dataCriacao)}
                  </Text>
                </View>

                {/* Usuário */}
                <View style={styles.detalheSection}>
                  <Text style={styles.detalheLabel}>Registrado por</Text>
                  <Text style={styles.detalheValue}>
                    {(selectedAnalise as any).usuarioNome}
                  </Text>
                </View>

                {/* Status */}
                <View style={styles.detalheSection}>
                  <Text style={styles.detalheLabel}>Status</Text>
                  <View style={styles.statusBadgeDetail}>
                    <Ionicons
                      name={
                        (selectedAnalise as any).status === "validado"
                          ? "checkmark-circle"
                          : (selectedAnalise as any).status === "revisado"
                          ? "alert-circle"
                          : "time"
                      }
                      size={18}
                      color={
                        (selectedAnalise as any).status === "validado"
                          ? SUCCESS
                          : (selectedAnalise as any).status === "revisado"
                          ? WARNING
                          : TEXT_MUTED
                      }
                    />
                    <Text
                      style={[
                        styles.statusTextDetail,
                        {
                          color:
                            (selectedAnalise as any).status === "validado"
                              ? SUCCESS
                              : (selectedAnalise as any).status === "revisado"
                              ? WARNING
                              : TEXT_MUTED,
                        },
                      ]}
                    >
                      {(selectedAnalise as any).status === "validado"
                        ? "Validado"
                        : (selectedAnalise as any).status === "revisado"
                        ? "Revisado"
                        : "Pendente"}
                    </Text>
                  </View>
                </View>

                {/* Se for Medição */}
                {(selectedAnalise as any).tipo === "medicao" && (
                  <>
                    <View style={styles.detalheSection}>
                      <Text style={styles.detalheLabel}>pH</Text>
                      <Text style={styles.detalheValue}>
                        {((selectedAnalise as any).pH || 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.detalheSection}>
                      <Text style={styles.detalheLabel}>Temperatura</Text>
                      <Text style={styles.detalheValue}>
                        {((selectedAnalise as any).temperatura || 0).toFixed(2)}°C
                      </Text>
                    </View>

                    <View style={styles.detalheSection}>
                      <Text style={styles.detalheLabel}>Cor da Água</Text>
                      <Text style={styles.detalheValue}>
                        {((selectedAnalise as any).cor || "clara").replace(/_/g, " ").toLowerCase()}
                      </Text>
                    </View>

                    <View style={styles.detalheSection}>
                      <Text style={styles.detalheLabel}>Odor</Text>
                      <Text style={styles.detalheValue}>
                        {((selectedAnalise as any).odor || "sem_odor")
                          .replace(/_/g, " ")
                          .toLowerCase()}
                      </Text>
                    </View>
                  </>
                )}

                {/* Se for Observação */}
                {(selectedAnalise as any).tipo === "observacao" && (
                  <View style={styles.detalheSection}>
                    <Text style={styles.detalheLabel}>Observações Visuais</Text>
                    <View style={styles.observacaoDetailList}>
                      {[
                        { key: "lixo", label: "🗑️  Lixo na água ou margem" },
                        { key: "animaisMortos", label: "🐟 Animais mortos" },
                        { key: "despejosEsgoto", label: "💧 Despejos/Esgoto" },
                        { key: "esgotoVisivel", label: "⚠️  Esgoto visível" },
                        { key: "coloracaoAnormal", label: "🎨 Coloração anormal" },
                        { key: "odorAnormal", label: "👃 Odor anormal" },
                        { key: "espumaOuResiduos", label: "🫧 Espuma ou resíduos" },
                      ].map((item) => (
                        <View key={item.key} style={styles.observacaoDetailItem}>
                          <Ionicons
                            name={
                              ((selectedAnalise as any).observacaoVisual?.[item.key] || false)
                                ? "checkbox"
                                : "checkbox-outline"
                            }
                            size={20}
                            color={
                              ((selectedAnalise as any).observacaoVisual?.[item.key] || false)
                                ? PRIMARY
                                : BORDER_LIGHT
                            }
                          />
                          <Text
                            style={[
                              styles.observacaoDetailText,
                              {
                                color:
                                  ((selectedAnalise as any).observacaoVisual?.[item.key] ||
                                    false)
                                    ? PRIMARY
                                    : TEXT_MUTED,
                                fontWeight:
                                  ((selectedAnalise as any).observacaoVisual?.[item.key] ||
                                    false)
                                    ? "600"
                                    : "400",
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Descrição */}
                {(selectedAnalise as any).descricao && (
                  <View style={styles.detalheSection}>
                    <Text style={styles.detalheLabel}>Descrição</Text>
                    <Text style={styles.detalheDescription}>
                      {(selectedAnalise as any).descricao}
                    </Text>
                  </View>
                )}

                {/* Coordenadas */}
                {(selectedAnalise as any).latitude && (
                  <View style={styles.detalheSection}>
                    <Text style={styles.detalheLabel}>Localização</Text>
                    <Text style={styles.detalheValue}>
                      Lat: {((selectedAnalise as any).latitude || 0).toFixed(4)}
                    </Text>
                    <Text style={styles.detalheValue}>
                      Lon: {((selectedAnalise as any).longitude || 0).toFixed(4)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: HISTÓRICO COMPLETO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalHistoricoVisible}
        animationType="slide"
        onRequestClose={() => setModalHistoricoVisible(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalHistoricoVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={28} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Histórico Completo</Text>
            <View style={{ width: 28 }} />
          </View>

          <FlatList
            data={analisado?.todasAnalises || []}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.historicoItem}
                onPress={() => {
                  setSelectedAnalise(item);
                  setModalDetalhesVisible(true);
                }}
              >
                <View style={styles.historicoItemHeader}>
                  <View style={styles.historicoItemContent}>
                    <View
                      style={[
                        styles.historicoItemIcon,
                        {
                          backgroundColor:
                            (item as any).tipo === "medicao"
                              ? "rgba(0, 105, 92, 0.1)"
                              : "rgba(0, 137, 123, 0.1)",
                        },
                      ]}
                    >
                      <Ionicons
                        name={(item as any).tipo === "medicao" ? "flask" : "eye"}
                        size={20}
                        color={PRIMARY}
                      />
                    </View>

                    <View style={styles.historicoItemText}>
                      <Text style={styles.historicoItemTipo}>
                        {(item as any).tipo === "medicao"
                          ? "Medição Simples"
                          : "Observação Visual"}
                      </Text>
                      <Text style={styles.historicoItemData}>
                        {formatarData((item as any).dataCriacao)}
                      </Text>
                      <Text style={styles.historicoItemUser}>
                        Por {(item as any).usuarioNome}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historicoItemArrow}>
                    <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
                  </View>
                </View>

                {/* Parâmetros resumidos */}
                {(item as any).tipo === "medicao" && (
                  <View style={styles.historicoItemParams}>
                    <View style={styles.historicoParam}>
                      <Text style={styles.historicoParamLabel}>pH</Text>
                      <Text style={styles.historicoParamValue}>
                        {((item as any).pH || 0).toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.historicoParam}>
                      <Text style={styles.historicoParamLabel}>Temp</Text>
                      <Text style={styles.historicoParamValue}>
                        {((item as any).temperatura || 0).toFixed(1)}°C
                      </Text>
                    </View>
                    <View style={styles.historicoParam}>
                      <Text style={styles.historicoParamLabel}>Cor</Text>
                      <Text style={styles.historicoParamValue}>
                        {((item as any).cor || "clara").substring(0, 3).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.historicoListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="time" size={48} color={TEXT_MUTED} />
                <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  headerGradient: {
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: WHITE,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },

  section: {
    marginBottom: 20,
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },

  // ─────────────────────────────────────────────────────────────
  // SITUAÇÃO
  // ─────────────────────────────────────────────────────────────
  situacaoCard: {
    backgroundColor: "rgba(0, 105, 92, 0.03)",
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 16,
  },

  situacaoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  situacaoLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  situacaoStatus: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 4,
  },

  situacaoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  situacaoDescription: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },

  situacaoDescText: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  // ─────────────────────────────────────────────────────────────
  // PARÂMETROS
  // ─────────────────────────────────────────────────────────────
  parametrosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },

  parametroCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(0, 105, 92, 0.05)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },

  parametroLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  parametroValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: PRIMARY,
  },

  parametroDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
  },

  detalhesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    marginTop: 12,
  },

  detalhesButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },

  dataRegistro: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 12,
    textAlign: "center",
  },

  // ─────────────────────────────────────────────────────────────
  // RESUMO
  // ─────────────────────────────────────────────────────────────
  resumoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  resumoCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 105, 92, 0.05)",
    borderRadius: 10,
    gap: 8,
  },

  resumoValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: PRIMARY,
  },

  resumoLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
  },

  historicoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY,
    borderRadius: 10,
  },

  historicoButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: WHITE,
    textAlign: "center",
  },

  // ─────────────────────────────────────────────────────────────
  // ÚLTIMO REGISTRO
  // ─────────────────────────────────────────────────────────────
  ultimoRegistroCard: {
    backgroundColor: "rgba(0, 105, 92, 0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    padding: 12,
  },

  ultimoRegistroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  ultimoRegistroTipo: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },

  ultimoRegistroData: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 6,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  ultimoRegistroParams: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  ultimoRegistroParam: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: WHITE,
    borderRadius: 8,
  },

  ultimoRegistroParamLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  ultimoRegistroParamValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: PRIMARY,
    marginTop: 2,
  },

  observacaoList: {
    marginBottom: 12,
  },

  observacaoText: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  verMaisIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },

  verMaisText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "600",
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL
  // ─────────────────────────────────────────────────────────────
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },

  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },

  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  detalheSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },

  detalheLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: "600",
  },

  detalheValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
    marginBottom: 4,
  },

  detalheDescription: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 20,
  },

  statusBadgeDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  statusTextDetail: {
    fontSize: 13,
    fontWeight: "600",
  },

  observacaoDetailList: {
    gap: 12,
  },

  observacaoDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 105, 92, 0.02)",
    borderRadius: 8,
  },

  observacaoDetailText: {
    fontSize: 14,
    flex: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // HISTÓRICO
  // ─────────────────────────────────────────────────────────────
  historicoListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  historicoItem: {
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },

  historicoItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  historicoItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  historicoItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },

  historicoItemText: {
    flex: 1,
  },

  historicoItemTipo: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },

  historicoItemData: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  historicoItemUser: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  historicoItemArrow: {
    paddingLeft: 12,
  },

  historicoItemParams: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },

  historicoParam: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(0, 105, 92, 0.05)",
    borderRadius: 6,
  },

  historicoParamLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: "600",
  },

  historicoParamValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: PRIMARY,
    marginTop: 2,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },

  emptyText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
});
