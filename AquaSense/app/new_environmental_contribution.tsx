/**
 * Tela: Nova Contribuição Ambiental
 * Permite colaboradores registrarem medições simples ou observações visuais
 * Integração: Firestore + Supabase Storage
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  Platform,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Slider from "@react-native-community/slider";

import { useAuth } from "@/contexts/auth-context";
import { GaleriaUpload } from "@/components/GaleriaUpload";
import { contributionHelper } from "@/services";
import { ambientalInfo } from "@/services";
import { getValidatedWaterBodies } from "@/services/firestore/water_bodies";
import { CorpoHidrico } from "@/types/water_bodies";

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

type TipoContribuicao = "medicao" | "observacao";
type CordoAQua = "clara" | "levemente_turva" | "turva" | "muito_turva";
type OdorAgua = "sem_odor" | "leve" | "forte";

interface FormData {
  tipo: TipoContribuicao;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  latitude?: number;
  longitude?: number;
  // Medição simples
  pH?: number;
  temperatura?: number;
  cor?: CordoAQua;
  odor?: OdorAgua;
  descricao: string;
  // Observação visual
  observacaoVisual?: {
    lixo: boolean;
    animaisMortos: boolean;
    despejosEsgoto: boolean;
    esgotoVisivel: boolean;
    coloracaoAnormal: boolean;
    odorAnormal: boolean;
    espumaOuResiduos: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CORES E ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const PRIMARY = "#004d48";
const PRIMARY_LIGHT = "#00695c";
const ACCENT = "#00897b";
const SUCCESS = "#10b981";
const WARNING = "#fbbf24";
const DANGER = "#ef4444";
const BORDER_LIGHT = "#e0f2f1";
const TEXT_MUTED = "#6b7a7a";
const SURFACE = "#f9fafb";
const WHITE = "#ffffff";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function NewEnvironmentalContribution() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localizacao, setLocalizacao] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [corposHidricos, setCorposHidricos] = useState<CorpoHidrico[]>([]);
  const [modalCorposVisible, setModalCorposVisible] = useState(false);
  const [searchCorpos, setSearchCorpos] = useState("");

  const [formData, setFormData] = useState<FormData>({
    tipo: "medicao",
    corpoHidricoNome: "",
    descricao: "",
    pH: 7.0,
    temperatura: 25,
    cor: "clara",
    odor: "sem_odor",
    observacaoVisual: {
      lixo: false,
      animaisMortos: false,
      despejosEsgoto: false,
      esgotoVisivel: false,
      coloracaoAnormal: false,
      odorAnormal: false,
      espumaOuResiduos: false,
    },
  });

  const [descricaoLength, setDescricaoLength] = useState(0);
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

    // Obter localização e corpos hídricos ao montar
    obterLocalizacao();
    carregarCorposHidricos();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FUNÇÕES
  // ─────────────────────────────────────────────────────────────

  const obterLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("Permissão de localização negada");
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocalizacao({
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      });
    } catch (error) {
      console.error("Erro ao obter localização:", error);
    }
  };

  const carregarCorposHidricos = async () => {
    try {
      setLoading(true);
      const corpos = await getValidatedWaterBodies();
      setCorposHidricos(corpos);
    } catch (error) {
      console.error("Erro ao carregar corpos hídricos:", error);
      Alert.alert("Erro", "Não foi possível carregar os corpos hídricos");
    } finally {
      setLoading(false);
    }
  };

  const handleFotosChange = (urls: string[]) => {
    setFotosUrls(urls);
  };

  const handleSelecionarCorpo = (corpo: CorpoHidrico) => {
    setFormData({
      ...formData,
      corpoHidricoNome: `${corpo.nome}, ${corpo.municipio} - PE`,
      corpoHidricoId: corpo.id,
      latitude: corpo.latitude,
      longitude: corpo.longitude,
    });
    setModalCorposVisible(false);
  };

  const corposFiltrados = corposHidricos.filter((corpo) =>
    `${corpo.nome} ${corpo.municipio}`
      .toLowerCase()
      .includes(searchCorpos.toLowerCase())
  );

  const validarFormulario = (): boolean => {
    if (!formData.corpoHidricoNome.trim()) {
      Alert.alert("Erro", "Selecione um corpo hídrico");
      return false;
    }

    if (!localizacao) {
      Alert.alert("Erro", "Localização não disponível");
      return false;
    }

    if (formData.tipo === "medicao") {
      if (!formData.pH || formData.pH < 0 || formData.pH > 14) {
        Alert.alert("Erro", "pH deve estar entre 0 e 14");
        return false;
      }
      if (!formData.temperatura) {
        Alert.alert("Erro", "Temperatura é obrigatória");
        return false;
      }
    }

    return true;
  };

  const handleEnviar = async () => {
    if (!validarFormulario()) return;

    if (!user) {
      Alert.alert("Erro", "Usuário não autenticado");
      return;
    }

    try {
      setSubmitting(true);

      const contribuicaoData = {
        latitude: localizacao!.latitude,
        longitude: localizacao!.longitude,
        usuarioId: user.uid,
        usuarioNome: user.displayName || userProfile?.name || "Usuário",
        tipo: formData.tipo as "medicao" | "observacao",
        descricao: formData.descricao || `${formData.tipo} ambiental`,
        ...(formData.tipo === "medicao" && {
          pH: formData.pH,
          temperatura: formData.temperatura,
          cor: formData.cor === "clara" ? "clara" : formData.cor,
          odor: formData.odor === "sem_odor" ? "sem cheiro" : formData.odor,
        }),
        ...(formData.tipo === "observacao" && {
          observacaoVisual: formData.observacaoVisual,
        }),
      };

      console.log("📤 Enviando contribuição:", contribuicaoData);
      console.log("📷 Fotos URLs:", fotosUrls.length);

      // Criar contribuição
      const idCriado = await contributionHelper.criarContribuicaoCompleta(
        contribuicaoData
      );

      // Atualizar com URLs de fotos se houver
      if (fotosUrls.length > 0) {
        const contributions = await import("@/services/firestore/contributions");
        await contributions.complementarContribuicao(
          idCriado,
          { novasFotos: fotosUrls },
          user.uid
        );
      }

      Alert.alert(
        "🎉 Sucesso!",
        `Contribuição enviada para validação. ID: ${idCriado}`,
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Erro ao enviar:", error);

      let mensagem = error.message || "Falha ao enviar contribuição";

      if (mensagem.includes("Pernambuco")) {
        mensagem = "Localização deve ser em Pernambuco";
      } else if (mensagem.includes("Supabase")) {
        mensagem = "Erro ao fazer upload de fotos";
      }

      Alert.alert("Erro", mensagem);
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color={WHITE} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Nova contribuição</Text>
            <Text style={styles.headerSubtitle}>
              Ajude a monitorar a qualidade da água da sua comunidade.
            </Text>
          </View>

          <MaterialIcons name="water-drop" size={32} color={WHITE} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* ═════════════════════════════════════════════════════════════ */}
        {/* CORPO HÍDRICO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-sharp" size={20} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Corpo hídrico</Text>
          </View>

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setModalCorposVisible(true)}
          >
            <Text
              style={[
                styles.selectButtonText,
                !formData.corpoHidricoNome && styles.selectButtonPlaceholder,
              ]}
            >
              {formData.corpoHidricoNome || "Selecione um corpo hídrico..."}
            </Text>
            <Ionicons name="chevron-down" size={24} color={PRIMARY} />
          </TouchableOpacity>

          {localizacao && (
            <View style={styles.locationInfo}>
              <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
              <Text style={styles.locationText}>
                Lat: {localizacao.latitude.toFixed(4)}, Lon:{" "}
                {localizacao.longitude.toFixed(4)}
              </Text>
              <TouchableOpacity onPress={obterLocalizacao}>
                <Ionicons name="refresh" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TIPO DE CONTRIBUIÇÃO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="category" size={20} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Tipo de contribuição</Text>
          </View>

          <View style={styles.tipoGrid}>
            {/* Medição Simples */}
            <TouchableOpacity
              style={[
                styles.tipoCard,
                formData.tipo === "medicao" && styles.tipoCardActive,
              ]}
              onPress={() => setFormData({ ...formData, tipo: "medicao" })}
            >
              <View
                style={[
                  styles.tipoIcon,
                  formData.tipo === "medicao" && styles.tipoIconActive,
                ]}
              >
                <Ionicons name="flask" size={24} color={WHITE} />
              </View>
              <Text style={styles.tipoTitle}>Medição simples</Text>
              <Text style={styles.tipoDesc}>Dados numéricos da água</Text>
              {formData.tipo === "medicao" && (
                <View style={styles.tipoCheck}>
                  <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                </View>
              )}
            </TouchableOpacity>

            {/* Observação Visual */}
            <TouchableOpacity
              style={[
                styles.tipoCard,
                formData.tipo === "observacao" && styles.tipoCardActive,
              ]}
              onPress={() => setFormData({ ...formData, tipo: "observacao" })}
            >
              <View
                style={[
                  styles.tipoIcon,
                  formData.tipo === "observacao" && styles.tipoIconActive,
                ]}
              >
                <Ionicons name="eye" size={24} color={WHITE} />
              </View>
              <Text style={styles.tipoTitle}>Observação visual</Text>
              <Text style={styles.tipoDesc}>O que você observou</Text>
              {formData.tipo === "observacao" && (
                <View style={styles.tipoCheck}>
                  <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* MEDIÇÃO SIMPLES */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {formData.tipo === "medicao" && (
          <Animated.View
            style={[
              styles.section,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="flask" size={20} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Medição simples</Text>
            </View>

            {/* pH */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabel}>
                <Text style={styles.fieldTitle}>pH da água</Text>
                <Ionicons name="information-circle" size={18} color={TEXT_MUTED} />
              </View>

              <View style={styles.pHContainer}>
                <TouchableOpacity
                  style={styles.pHButton}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      pH: Math.max(0, (formData.pH || 7) - 0.1),
                    })
                  }
                >
                  <Text style={styles.pHButtonText}>−</Text>
                </TouchableOpacity>

                <Text style={styles.pHValue}>
                  {(formData.pH || 7).toFixed(1)}
                </Text>

                <TouchableOpacity
                  style={styles.pHButton}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      pH: Math.min(14, (formData.pH || 7) + 0.1),
                    })
                  }
                >
                  <Text style={styles.pHButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldHint}>Intervalo ideal: 6.0 - 8.5</Text>
            </View>

            {/* Temperatura */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabel}>
                <Text style={styles.fieldTitle}>
                  Temperatura da água (°C)
                </Text>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={TEXT_MUTED}
                />
              </View>

              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>15°C</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={15}
                  maximumValue={35}
                  step={0.1}
                  value={formData.temperatura || 25}
                  onValueChange={(value) =>
                    setFormData({ ...formData, temperatura: value })
                  }
                  minimumTrackTintColor={PRIMARY}
                  maximumTrackTintColor={BORDER_LIGHT}
                  thumbTintColor={PRIMARY}
                />
                <Text style={styles.sliderLabel}>35°C</Text>
              </View>

              <Text style={styles.temperatureValue}>
                {(formData.temperatura || 25).toFixed(1)}°C
              </Text>
            </View>

            {/* Cor */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabel}>
                <Text style={styles.fieldTitle}>Cor da água</Text>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={TEXT_MUTED}
                />
              </View>

              <View style={styles.colorGrid}>
                {[
                  {
                    id: "clara",
                    label: "Clara",
                    icon: "💧",
                    color: "#e0f2f1",
                  },
                  {
                    id: "levemente_turva",
                    label: "Levemente\nturva",
                    icon: "💛",
                    color: "#fff3e0",
                  },
                  {
                    id: "turva",
                    label: "Turva",
                    icon: "🧡",
                    color: "#ffe0b2",
                  },
                  {
                    id: "muito_turva",
                    label: "Muito\nturva",
                    icon: "❤️",
                    color: "#ffcccc",
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.colorOption,
                      { backgroundColor: item.color },
                      formData.cor === item.id && styles.colorOptionSelected,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        cor: item.id as CordoAQua,
                      })
                    }
                  >
                    <Text style={styles.colorIcon}>{item.icon}</Text>
                    <Text style={styles.colorLabel}>{item.label}</Text>
                    {formData.cor === item.id && (
                      <View style={styles.colorCheck}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={PRIMARY}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Odor */}
            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabel}>
                <Text style={styles.fieldTitle}>Odor da água</Text>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={TEXT_MUTED}
                />
              </View>

              <View style={styles.odorGrid}>
                {[
                  { id: "sem_odor", label: "Sem odor", emoji: "😊" },
                  { id: "leve", label: "Odor leve", emoji: "😐" },
                  { id: "forte", label: "Odor forte", emoji: "😖" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.odorOption,
                      formData.odor === item.id && styles.odorOptionSelected,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        odor: item.id as OdorAgua,
                      })
                    }
                  >
                    <Text style={styles.odorEmoji}>{item.emoji}</Text>
                    <Text style={styles.odorLabel}>{item.label}</Text>
                    {formData.odor === item.id && (
                      <View style={styles.odorCheck}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={PRIMARY}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* OBSERVAÇÃO VISUAL */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {formData.tipo === "observacao" && (
          <Animated.View
            style={[
              styles.section,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="eye" size={20} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Observação visual</Text>
            </View>

            {[
              { key: "lixo", label: "Lixo na água ou margem", emoji: "🗑️" },
              { key: "animaisMortos", label: "Animais mortos", emoji: "🐟" },
              { key: "despejosEsgoto", label: "Despejos/Esgoto", emoji: "💧" },
              {
                key: "esgotoVisivel",
                label: "Esgoto visível",
                emoji: "⚠️",
              },
              {
                key: "coloracaoAnormal",
                label: "Coloração anormal",
                emoji: "🎨",
              },
              { key: "odorAnormal", label: "Odor anormal", emoji: "👃" },
              {
                key: "espumaOuResiduos",
                label: "Espuma ou resíduos",
                emoji: "🫧",
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.checkboxItem}
                onPress={() =>
                  setFormData({
                    ...formData,
                    observacaoVisual: {
                      ...formData.observacaoVisual!,
                      [item.key]:
                        !formData.observacaoVisual![
                          item.key as keyof typeof formData.observacaoVisual
                        ],
                    },
                  })
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    formData.observacaoVisual![
                      item.key as keyof typeof formData.observacaoVisual
                    ] && styles.checkboxChecked,
                  ]}
                >
                  {formData.observacaoVisual![
                    item.key as keyof typeof formData.observacaoVisual
                  ] && (
                    <Ionicons name="checkmark" size={18} color={PRIMARY} />
                  )}
                </View>

                <Text style={styles.checkboxLabel}>
                  {item.emoji} {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* DESCRIÇÃO COMPLEMENTAR */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="description" size={20} color={PRIMARY} />
            <Text style={styles.sectionTitle}>
              Descrição complementar{" "}
              <Text style={styles.optional}>(opcional)</Text>
            </Text>
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Descreva o que você observou..."
              placeholderTextColor={TEXT_MUTED}
              value={formData.descricao}
              onChangeText={(text) => {
                setFormData({ ...formData, descricao: text });
                setDescricaoLength(text.length);
              }}
              maxLength={300}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.textInputCounter}>
              {descricaoLength}/300
            </Text>
          </View>
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* FOTOS */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <GaleriaUpload
            contribuicaoId={`temp_${Date.now()}`}
            maxFotos={5}
            maxTamanhoMB={5}
            onFotosChange={handleFotosChange}
          />
        </View>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* BOTÃO ENVIAR */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleEnviar}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={WHITE} size="large" />
          ) : (
            <>
              <Ionicons name="send" size={20} color={WHITE} />
              <Text style={styles.submitButtonText}>Enviar contribuição</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={PRIMARY} />
          <Text style={styles.infoText}>
            Seus dados ajudam a monitorar a qualidade da água em Pernambuco.
            Obrigado por contribuir!
          </Text>
        </View>
      </ScrollView>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: SELEÇÃO DE CORPO HÍDRICO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalCorposVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalCorposVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalCorposVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={28} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Selecione um corpo hídrico</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={TEXT_MUTED} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome ou município..."
              placeholderTextColor={TEXT_MUTED}
              value={searchCorpos}
              onChangeText={setSearchCorpos}
            />
          </View>

          {/* Lista de Corpos */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>Carregando corpos hídricos...</Text>
            </View>
          ) : corposFiltrados.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="water-outline" size={48} color={TEXT_MUTED} />
              <Text style={styles.emptyText}>Nenhum corpo hídrico encontrado</Text>
            </View>
          ) : (
            <FlatList
              data={corposFiltrados}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.corpoItem}
                  onPress={() => handleSelecionarCorpo(item)}
                >
                  <View style={styles.corpoInfo}>
                    <Text style={styles.corpoNome}>{item.nome}</Text>
                    <Text style={styles.corpoMunicipio}>
                      📍 {item.municipio} - PE
                    </Text>
                    {item.tipo && (
                      <Text style={styles.corpoTipo}>{item.tipo}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={PRIMARY} />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled
              contentContainerStyle={{ paddingVertical: 12 }}
            />
          )}
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

  section: {
    marginBottom: 24,
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

  optional: {
    fontSize: 12,
    fontWeight: "400",
    color: TEXT_MUTED,
  },

  // ─────────────────────────────────────────────────────────────
  // SELETOR
  // ─────────────────────────────────────────────────────────────
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    backgroundColor: "rgba(0, 105, 92, 0.02)",
  },

  selectButtonText: {
    fontSize: 15,
    color: "#1f2937",
    fontWeight: "500",
  },

  selectButtonPlaceholder: {
    color: TEXT_MUTED,
  },

  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
  },

  locationText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    fontFamily: "monospace",
  },

  // ─────────────────────────────────────────────────────────────
  // TIPO DE CONTRIBUIÇÃO
  // ─────────────────────────────────────────────────────────────
  tipoGrid: {
    flexDirection: "row",
    gap: 12,
  },

  tipoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER_LIGHT,
    alignItems: "center",
    backgroundColor: "rgba(0, 105, 92, 0.02)",
  },

  tipoCardActive: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(0, 105, 92, 0.1)",
  },

  tipoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  tipoIconActive: {
    backgroundColor: ACCENT,
  },

  tipoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },

  tipoDesc: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 4,
  },

  tipoCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // CAMPO GENÉRICO
  // ─────────────────────────────────────────────────────────────
  fieldContainer: {
    marginBottom: 24,
  },

  fieldLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  fieldTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },

  fieldHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // pH
  // ─────────────────────────────────────────────────────────────
  pHContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },

  pHButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BORDER_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  pHButtonText: {
    fontSize: 28,
    fontWeight: "bold",
    color: PRIMARY,
  },

  pHValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: PRIMARY,
    minWidth: 80,
    textAlign: "center",
  },

  // ─────────────────────────────────────────────────────────────
  // SLIDER (TEMPERATURA)
  // ─────────────────────────────────────────────────────────────
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  slider: {
    flex: 1,
    height: 40,
  },

  sliderLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    minWidth: 35,
    textAlign: "center",
  },

  temperatureValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: PRIMARY,
    textAlign: "center",
    marginTop: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // COR
  // ─────────────────────────────────────────────────────────────
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },

  colorOption: {
    width: "48%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    gap: 8,
  },

  colorOptionSelected: {
    borderColor: PRIMARY,
  },

  colorIcon: {
    fontSize: 32,
  },

  colorLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1f2937",
    textAlign: "center",
  },

  colorCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // ODOR
  // ─────────────────────────────────────────────────────────────
  odorGrid: {
    flexDirection: "row",
    gap: 12,
  },

  odorOption: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    backgroundColor: "rgba(0, 105, 92, 0.05)",
  },

  odorOptionSelected: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(0, 105, 92, 0.1)",
  },

  odorEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },

  odorLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1f2937",
    textAlign: "center",
  },

  odorCheck: {
    position: "absolute",
    top: 4,
    right: 4,
  },

  // ─────────────────────────────────────────────────────────────
  // TEXT INPUT
  // ─────────────────────────────────────────────────────────────
  textInputContainer: {
    position: "relative",
  },

  textInput: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    fontSize: 14,
    color: "#1f2937",
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: "rgba(0, 105, 92, 0.02)",
  },

  textInputCounter: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 12,
    color: TEXT_MUTED,
  },

  // ─────────────────────────────────────────────────────────────
  // CHECKBOX (OBSERVAÇÃO VISUAL)
  // ─────────────────────────────────────────────────────────────
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    gap: 12,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
  },

  // ─────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 16,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: WHITE,
  },

  // ─────────────────────────────────────────────────────────────
  // INFO BOX
  // ─────────────────────────────────────────────────────────────
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 105, 92, 0.1)",
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: PRIMARY,
    lineHeight: 18,
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL: SELEÇÃO DE CORPO HÍDRICO
  // ─────────────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: SURFACE,
  },

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

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "rgba(0, 105, 92, 0.02)",
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

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  emptyText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },

  corpoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },

  corpoInfo: {
    flex: 1,
    gap: 4,
  },

  corpoNome: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },

  corpoMunicipio: {
    fontSize: 13,
    color: TEXT_MUTED,
  },

  corpoTipo: {
    fontSize: 12,
    color: PRIMARY,
    fontStyle: "italic",
    marginTop: 2,
  },
});
