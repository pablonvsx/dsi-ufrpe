import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  Image,
  Linking,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";

import { useAuth } from "@/contexts/auth-context";
import { getValidatedWaterBodies } from "@/services/firestore/water_bodies";
import { CorpoHidrico } from "@/types/water_bodies";
import { createCollaboratorMeasurement } from "@/services/firestore/measurements";
import { salvarObservacao } from "@/services/firestore/observations";

type TipoContribuicao = "medicao" | "observacao";

type CorMedicao = "Clara" | "Levemente turva" | "Turva" | "Muito turva";
type OdorMedicao = "Sem odor" | "Odor leve" | "Odor forte";

type CorObservacao = "Transparente" | "Esverdeada" | "Turva" | "Marrom" | "Outra";
type OdorObservacao = "Sem odor" | "Cheiro químico" | "Cheiro de esgoto" | "Outro";

interface FormData {
  tipo: TipoContribuicao;
  corpoHidricoId?: string;
  corpoHidricoNome: string;
  cidade?: string;
  estado?: string;
  bairro?: string | null;
  areaChave?: string;
  pH: number;
  temperatura: number;
  corMedicao: CorMedicao;
  odorMedicao: OdorMedicao;
  corObservacao: CorObservacao;
  odorObservacao: OdorObservacao;
  animaisPresentes: boolean | null;
  descricaoAnimais: string;
  lixoPresente: boolean | null;
  descricaoLixo: string;
  descricao: string;
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  type?: "success" | "error" | "warning";
  onClose: () => void;
  fontFamily?: string;
}

const PRIMARY = "#004D48";
const PRIMARY_2 = "#00695C";
const ACCENT = "#00A98F";
const WHITE = "#FFFFFF";
const BACKGROUND = "#F5F5F5";
const BORDER = "#E0E0E0";
const TEXT = "#0F2F2D";
const MUTED = "#9E9E9E";
const SOFT = "#F9F9F9";

function CustomAlert({
  visible,
  title,
  message,
  buttonLabel = "Entendi",
  type = "success",
  onClose,
  fontFamily,
}: CustomAlertProps) {
  const iconName =
    type === "success"
      ? "checkmark-circle"
      : type === "warning"
      ? "alert-circle"
      : "close-circle";

  const iconColor =
    type === "success" ? "#1a8c80" : type === "warning" ? "#e6a817" : "#e05252";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={alertStyles.overlay} onPress={onClose}>
        <Pressable style={alertStyles.box} onPress={(e) => e.stopPropagation()}>
          <View style={alertStyles.iconWrapper}>
            <Ionicons name={iconName as any} size={48} color={iconColor} />
          </View>

          <Text style={[alertStyles.title, { fontFamily }]}>{title}</Text>

          <View style={alertStyles.divider} />

          <Text style={[alertStyles.message, { fontFamily }]}>{message}</Text>

          <TouchableOpacity style={alertStyles.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={[alertStyles.buttonText, { fontFamily }]}>
              {buttonLabel}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function NewEnvironmentalContribution() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [localizacao, setLocalizacao] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [fotos, setFotos] = useState<string[]>([]);
  const [modalFotosVisible, setModalFotosVisible] = useState(false);
  const [corposHidricos, setCorposHidricos] = useState<CorpoHidrico[]>([]);
  const [modalCorposVisible, setModalCorposVisible] = useState(false);
  const [searchCorpos, setSearchCorpos] = useState("");

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "warning";
    onClose?: () => void;
  }>({
    title: "",
    message: "",
    type: "success",
  });

  const profile: any = userProfile ?? {};

  const [formData, setFormData] = useState<FormData>({
    tipo: "medicao",
    corpoHidricoNome: "",
    cidade: profile.cidade ?? undefined,
    estado: profile.estado ?? "PE",
    bairro: profile.bairro ?? null,
    areaChave: profile.areaChave ?? undefined,
    pH: 6.8,
    temperatura: 26,
    corMedicao: "Clara",
    odorMedicao: "Sem odor",
    corObservacao: "Transparente",
    odorObservacao: "Sem odor",
    animaisPresentes: null,
    descricaoAnimais: "",
    lixoPresente: null,
    descricaoLixo: "",
    descricao: "",
  });

  useEffect(() => {
    obterLocalizacao();
    carregarCorposHidricos();
  }, []);

  function showAlert(
    title: string,
    message: string,
    type: "success" | "error" | "warning" = "error",
    onClose?: () => void
  ) {
    setAlertConfig({ title, message, type, onClose });
    setAlertVisible(true);
  }

  function handleAlertClose() {
    setAlertVisible(false);
    alertConfig.onClose?.();
  }

  const obterLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        showAlert(
          "Localização necessária",
          "Permita o acesso à localização para registrar o ponto exato da contribuição.",
          "warning"
        );
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
      showAlert(
        "Erro de localização",
        "Não foi possível obter sua localização. Tente novamente antes de enviar.",
        "error"
      );
    }
  };

  const carregarCorposHidricos = async () => {
    try {
      setLoading(true);
      const corpos = await getValidatedWaterBodies();
      setCorposHidricos(corpos);
    } catch (error) {
      console.error("Erro ao carregar corpos hídricos:", error);
      showAlert("Erro", "Não foi possível carregar os corpos hídricos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const corposFiltrados = useMemo(() => {
    return corposHidricos.filter((corpo) =>
      `${corpo.nome} ${(corpo as any).municipio ?? ""} ${(corpo as any).cidade ?? ""}`
        .toLowerCase()
        .includes(searchCorpos.toLowerCase())
    );
  }, [corposHidricos, searchCorpos]);

  const handleSelecionarCorpo = (corpo: CorpoHidrico) => {
    const corpoAny: any = corpo;

    setFormData((prev) => ({
      ...prev,
      corpoHidricoId: corpo.id,
      corpoHidricoNome: corpo.nome,
      cidade: corpoAny.municipio ?? corpoAny.cidade ?? prev.cidade,
      estado: corpoAny.estado ?? corpoAny.uf ?? "PE",
      bairro: corpoAny.bairro ?? prev.bairro ?? null,
      areaChave: corpoAny.areaChave ?? prev.areaChave,
    }));

    setModalCorposVisible(false);
  };

  const escolherFotoCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showAlert("Permissão necessária", "Permita o acesso à câmera.", "warning");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setFotos((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      setModalFotosVisible(false);
    }
  };

  const escolherFotoGaleria = async () => {
    const { status, canAskAgain } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      if (!canAskAgain) {
        showAlert(
          "Permissão negada",
          "O acesso à galeria foi bloqueado. Abra as configurações do app para permitir.",
          "warning",
          () => Linking.openSettings()
        );
      } else {
        showAlert(
          "Permissão necessária",
          "Permita o acesso à galeria de fotos.",
          "warning"
        );
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - fotos.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((asset) => asset.uri);
      setFotos((prev) => [...prev, ...uris].slice(0, 5));
      setModalFotosVisible(false);
    }
  };

  const removerFoto = (uri: string) =>
    setFotos((prev) => prev.filter((foto) => foto !== uri));

  const validarFormulario = () => {
    if (!user) {
      showAlert("Erro", "Usuário não autenticado.", "error");
      return false;
    }

    if (!formData.corpoHidricoId || !formData.corpoHidricoNome.trim()) {
      showAlert("Atenção", "Selecione um corpo hídrico.", "warning");
      return false;
    }

    if (!localizacao) {
      showAlert(
        "Localização não encontrada",
        "Não foi possível obter sua localização. Ela é necessária para registrar o ponto exato da contribuição.",
        "warning",
        obterLocalizacao
      );
      return false;
    }

    if (formData.tipo === "observacao") {
      if (formData.animaisPresentes === null) {
        showAlert("Atenção", "Informe se há presença de animais.", "warning");
        return false;
      }

      if (formData.lixoPresente === null) {
        showAlert("Atenção", "Informe se há presença de lixo.", "warning");
        return false;
      }
    }

    return true;
  };

  const getUsuarioNome = () =>
    user?.displayName || profile.nome || profile.name || profile.email || "Usuário";

  const handleEnviar = async () => {
    if (!validarFormulario() || !user || !localizacao) return;

    try {
      setSubmitting(true);

      if (formData.tipo === "medicao") {
        await createCollaboratorMeasurement({
          usuarioId: user.uid,
          usuarioNome: getUsuarioNome(),

          corpoHidricoId: formData.corpoHidricoId,
          corpoHidricoNome: formData.corpoHidricoNome,

          cidade: formData.cidade ?? profile.cidade ?? null,
          estado: formData.estado ?? profile.estado ?? "PE",
          bairro: formData.bairro ?? profile.bairro ?? null,
          areaChave: formData.areaChave ?? profile.areaChave ?? undefined,

          latitude: localizacao.latitude,
          longitude: localizacao.longitude,

          ph: formData.pH,
          temperatura: formData.temperatura,
          turbidez: formData.corMedicao,
          observacao: formData.descricao || formData.odorMedicao,
        });
      }

      if (formData.tipo === "observacao") {
        await salvarObservacao({
          corpoHidricoId: formData.corpoHidricoId!,
          corpoHidricoNome: formData.corpoHidricoNome,

          criadoPor: user.uid,
          usuarioId: user.uid,
          usuarioNome: getUsuarioNome(),

          cidade: formData.cidade ?? profile.cidade ?? undefined,
          estado: formData.estado ?? profile.estado ?? "PE",
          bairro: formData.bairro ?? profile.bairro ?? null,
          areaChave: formData.areaChave ?? profile.areaChave ?? undefined,

          latitude: localizacao.latitude,
          longitude: localizacao.longitude,

          cor: formData.corObservacao,
          corDesc: formData.corObservacao,

          odor: formData.odorObservacao,
          odorDesc: formData.odorObservacao,

          animais: formData.animaisPresentes ? "sim" : "nao",
          animaisDesc: formData.descricaoAnimais,

          lixo: formData.lixoPresente ? "sim" : "nao",
          lixoDesc: formData.descricaoLixo,
        });
      }

      showAlert(
        "Contribuição enviada!",
        "Sua contribuição foi registrada e aparecerá no painel comunitário.",
        "success",
        () => router.back()
      );
    } catch (error: any) {
      console.error("Erro ao enviar contribuição:", error);

      showAlert(
        "Erro ao enviar",
        error?.message || "Falha ao enviar contribuição. Tente novamente.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        <View style={styles.headerTextArea}>
          <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
            Nova contribuição
          </Text>
          <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
            Ajude a monitorar a qualidade da água da sua comunidade.
          </Text>
        </View>

        <Image
          source={require("@/assets/images/aquasense.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mainPanel}>
          <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
            Corpo hídrico
          </Text>

          <TouchableOpacity
            style={styles.waterBodyRow}
            onPress={() => setModalCorposVisible(true)}
          >
            <View style={styles.circleIcon}>
              <Ionicons name="location-outline" size={22} color={PRIMARY} />
            </View>

            <View style={styles.waterBodyInput}>
              <Text
                style={[
                  styles.waterBodyName,
                  { fontFamily: questrial },
                  !formData.corpoHidricoNome && styles.placeholder,
                ]}
              >
                {formData.corpoHidricoNome || "Selecione um corpo hídrico"}
              </Text>

              <Text style={[styles.waterBodyCity, { fontFamily: questrial }]}>
                {formData.cidade ? `${formData.cidade} - PE` : "Pernambuco - PE"}
              </Text>
            </View>

            <Ionicons name="chevron-down" size={24} color={MUTED} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
            Tipo de contribuição
          </Text>

          <View style={styles.tipoGrid}>
            <TouchableOpacity
              style={[
                styles.tipoCard,
                formData.tipo === "medicao" && styles.tipoCardActive,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, tipo: "medicao" }))}
            >
              {formData.tipo === "medicao" && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={13} color={WHITE} />
                </View>
              )}

              <View style={styles.tipoCardInner}>
                <View style={styles.tipoIcon}>
                  <Ionicons name="flask-outline" size={24} color={ACCENT} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipoTitle, { fontFamily: questrial }]}>
                    Medição simples
                  </Text>
                  <Text style={[styles.tipoDescription, { fontFamily: questrial }]}>
                    Dados numéricos da água
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tipoCard,
                formData.tipo === "observacao" && styles.tipoCardActive,
              ]}
              onPress={() =>
                setFormData((prev) => ({ ...prev, tipo: "observacao" }))
              }
            >
              {formData.tipo === "observacao" && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={13} color={WHITE} />
                </View>
              )}

              <View style={styles.tipoCardInner}>
                <View style={styles.tipoIconBlue}>
                  <Ionicons name="eye-outline" size={24} color={PRIMARY} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipoTitle, { fontFamily: questrial }]}>
                    Observação visual
                  </Text>
                  <Text style={[styles.tipoDescription, { fontFamily: questrial }]}>
                    O que você observou no ambiente
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {formData.tipo === "medicao" ? (
            <View style={styles.innerCard}>
              <View style={styles.innerHeader}>
                <Ionicons name="flask-outline" size={20} color={ACCENT} />
                <Text style={[styles.innerTitle, { fontFamily: questrial }]}>
                  Medição simples
                </Text>
              </View>

              <View style={styles.measureRow}>
                <View style={styles.measureBox}>
                  <InfoLabel label="pH da água" questrial={questrial} />

                  <View style={styles.phRow}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() =>
                        setFormData((prev) => ({
                          ...prev,
                          pH: Math.max(0, parseFloat((prev.pH - 0.1).toFixed(1))),
                        }))
                      }
                    >
                      <Text style={[styles.smallButtonText, { fontFamily: questrial }]}>
                        −
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.phValue, { fontFamily: questrial }]}>
                      {formData.pH.toFixed(1)}
                    </Text>

                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() =>
                        setFormData((prev) => ({
                          ...prev,
                          pH: Math.min(14, parseFloat((prev.pH + 0.1).toFixed(1))),
                        }))
                      }
                    >
                      <Text style={[styles.smallButtonText, { fontFamily: questrial }]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.hint, { fontFamily: questrial }]}>
                    Intervalo ideal: 6.0 – 8.5
                  </Text>
                </View>

                <View style={styles.measureDivider} />

                <View style={styles.measureBox}>
                  <InfoLabel label="Temperatura da água (° C)" questrial={questrial} />

                  <View style={styles.phRow}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() =>
                        setFormData((prev) => ({
                          ...prev,
                          temperatura: Math.max(-50, prev.temperatura - 1),
                        }))
                      }
                    >
                      <Text style={[styles.smallButtonText, { fontFamily: questrial }]}>
                        −
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.phValue, { fontFamily: questrial }]}>
                      {formData.temperatura}°C
                    </Text>

                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() =>
                        setFormData((prev) => ({
                          ...prev,
                          temperatura: Math.min(100, prev.temperatura + 1),
                        }))
                      }
                    >
                      <Text style={[styles.smallButtonText, { fontFamily: questrial }]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.hint, { fontFamily: questrial }]}>
                    Intervalo: −50°C – 100°C
                  </Text>
                </View>
              </View>

              <InfoLabel label="Cor da água" questrial={questrial} />

              <View style={styles.optionGridFour}>
                {[
                  ["Clara", "Clara", "water-outline", "#6EC6FF"],
                  ["Levemente turva", "Lev. turva", "water-outline", "#F2C94C"],
                  ["Turva", "Turva", "water-outline", "#F2994A"],
                  ["Muito turva", "Muito turva", "water-outline", "#EB5757"],
                ].map(([id, label, icon, color]) => (
                  <OptionCard
                    key={id}
                    label={label}
                    icon={icon}
                    iconColor={color}
                    selected={formData.corMedicao === id}
                    questrial={questrial}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        corMedicao: id as CorMedicao,
                      }))
                    }
                  />
                ))}
              </View>

              <InfoLabel label="Odor da água" questrial={questrial} />

              <View style={styles.optionGridThree}>
                {[
                  ["Sem odor", "Sem odor", "happy-outline", "#00A98F"],
                  ["Odor leve", "Odor leve", "remove-circle-outline", "#F2C94C"],
                  ["Odor forte", "Odor forte", "sad-outline", "#EB5757"],
                ].map(([id, label, icon, color]) => (
                  <OptionCard
                    key={id}
                    label={label}
                    icon={icon}
                    iconColor={color}
                    selected={formData.odorMedicao === id}
                    questrial={questrial}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        odorMedicao: id as OdorMedicao,
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.innerCard}>
              <View style={styles.innerHeader}>
                <Ionicons name="eye-outline" size={20} color={PRIMARY} />
                <Text style={[styles.innerTitle, { fontFamily: questrial }]}>
                  Observação visual
                </Text>
              </View>

              <InfoLabel label="Cor da água" questrial={questrial} />

              <View style={styles.optionGridFive}>
                {[
                  ["Transparente", "Incolor"],
                  ["Esverdeada", "Verde"],
                  ["Turva", "Turva"],
                  ["Marrom", "Marrom"],
                  ["Outra", "Outra"],
                ].map(([id, label]) => (
                  <ChipOption
                    key={id}
                    label={label}
                    selected={formData.corObservacao === id}
                    questrial={questrial}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        corObservacao: id as CorObservacao,
                      }))
                    }
                  />
                ))}
              </View>

              <InfoLabel label="Odor da água" questrial={questrial} />

              <View style={styles.optionGridTwo}>
                {[
                  ["Sem odor", "Sem odor"],
                  ["Cheiro químico", "Cheiro químico"],
                  ["Cheiro de esgoto", "Cheiro de esgoto"],
                  ["Outro", "Outro"],
                ].map(([id, label]) => (
                  <ChipOption
                    key={id}
                    label={label}
                    selected={formData.odorObservacao === id}
                    questrial={questrial}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        odorObservacao: id as OdorObservacao,
                      }))
                    }
                  />
                ))}
              </View>

              <InfoLabel label="Presença de animais" questrial={questrial} />

              <View style={styles.yesNoRow}>
                <YesNoButton
                  label="Sim"
                  selected={formData.animaisPresentes === true}
                  questrial={questrial}
                  onPress={() =>
                    setFormData((prev) => ({ ...prev, animaisPresentes: true }))
                  }
                />

                <YesNoButton
                  label="Não"
                  selected={formData.animaisPresentes === false}
                  questrial={questrial}
                  onPress={() =>
                    setFormData((prev) => ({
                      ...prev,
                      animaisPresentes: false,
                      descricaoAnimais: "",
                    }))
                  }
                />
              </View>

              {formData.animaisPresentes === true && (
                <TextArea
                  placeholder="Descreva quais animais foram observados..."
                  value={formData.descricaoAnimais}
                  questrial={questrial}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, descricaoAnimais: text }))
                  }
                />
              )}

              <InfoLabel label="Presença de lixo" questrial={questrial} />

              <View style={styles.yesNoRow}>
                <YesNoButton
                  label="Sim"
                  selected={formData.lixoPresente === true}
                  questrial={questrial}
                  onPress={() =>
                    setFormData((prev) => ({ ...prev, lixoPresente: true }))
                  }
                />

                <YesNoButton
                  label="Não"
                  selected={formData.lixoPresente === false}
                  questrial={questrial}
                  onPress={() =>
                    setFormData((prev) => ({
                      ...prev,
                      lixoPresente: false,
                      descricaoLixo: "",
                    }))
                  }
                />
              </View>

              {formData.lixoPresente === true && (
                <TextArea
                  placeholder="Descreva o tipo de lixo observado..."
                  value={formData.descricaoLixo}
                  questrial={questrial}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, descricaoLixo: text }))
                  }
                />
              )}
            </View>
          )}

          <View style={styles.descriptionArea}>
            <Text style={[styles.descriptionTitle, { fontFamily: questrial }]}>
              Descrição complementar{" "}
              <Text style={[styles.optional, { fontFamily: questrial }]}>
                (opcional)
              </Text>
            </Text>

            <View style={styles.textAreaWrapper}>
              <Feather
                name="edit-2"
                size={18}
                color={MUTED}
                style={{ marginTop: 2 }}
              />

              <TextInput
                style={[styles.descriptionInput, { fontFamily: questrial }]}
                placeholder="Descreva o que você observou..."
                placeholderTextColor={MUTED}
                value={formData.descricao}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, descricao: text }))
                }
                maxLength={300}
                multiline
              />

              <Text style={[styles.counter, { fontFamily: questrial }]}>
                {formData.descricao.length}/300
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.photoRow}
            onPress={() => setModalFotosVisible(true)}
          >
            <View style={styles.photoIcon}>
              <Ionicons name="camera-outline" size={22} color={ACCENT} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.photoTitle, { fontFamily: questrial }]}>
                Fotos{" "}
                <Text style={[styles.optional, { fontFamily: questrial }]}>
                  (opcional)
                </Text>
              </Text>

              <Text style={[styles.photoSubtitle, { fontFamily: questrial }]}>
                {fotos.length > 0
                  ? `${fotos.length}/5 foto(s) adicionada(s)`
                  : "Adicione fotos para ajudar na análise"}
              </Text>
            </View>

            <View style={styles.plusBox}>
              <Ionicons name="add" size={24} color={MUTED} />
            </View>
          </TouchableOpacity>

          {fotos.length > 0 && (
            <View style={styles.previewRow}>
              {fotos.map((uri) => (
                <View key={uri} style={styles.previewItem}>
                  <Image source={{ uri }} style={styles.previewImage} />

                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => removerFoto(uri)}
                  >
                    <Ionicons name="close" size={14} color={WHITE} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleEnviar}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={22} color={WHITE} />
              <Text style={[styles.submitText, { fontFamily: questrial }]}>
                Enviar contribuição
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={22} color={PRIMARY} />
          <Text style={[styles.infoText, { fontFamily: questrial }]}>
            Seus dados ajudam a monitorar a qualidade da água em Pernambuco.
            Obrigado por contribuir!
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={modalFotosVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFotosVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModal}>
            <Text style={[styles.modalPhotoTitle, { fontFamily: questrial }]}>
              Adicionar foto
            </Text>

            <TouchableOpacity
              style={styles.modalPhotoButton}
              onPress={escolherFotoCamera}
            >
              <Ionicons name="camera-outline" size={24} color={WHITE} />
              <Text style={[styles.modalPhotoButtonText, { fontFamily: questrial }]}>
                Câmera
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalPhotoButton, styles.galleryButton]}
              onPress={escolherFotoGaleria}
            >
              <Ionicons name="images-outline" size={24} color={WHITE} />
              <Text style={[styles.modalPhotoButtonText, { fontFamily: questrial }]}>
                Galeria
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalFotosVisible(false)}>
              <Text style={[styles.cancelText, { fontFamily: questrial }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalCorposVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalCorposVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalCorposVisible(false)}>
              <Ionicons name="close" size={28} color={PRIMARY} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
              Selecione um corpo hídrico
            </Text>

            <View style={{ width: 28 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={MUTED} />
            <TextInput
              style={[styles.searchInput, { fontFamily: questrial }]}
              placeholder="Buscar por nome ou município..."
              placeholderTextColor={MUTED}
              value={searchCorpos}
              onChangeText={setSearchCorpos}
            />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={[styles.loadingText, { fontFamily: questrial }]}>
                Carregando corpos hídricos...
              </Text>
            </View>
          ) : (
            <FlatList
              data={corposFiltrados}
              keyExtractor={(item, index) => item.id ?? `corpo-${index}`}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const itemAny: any = item;

                return (
                  <TouchableOpacity
                    style={styles.corpoItem}
                    onPress={() => handleSelecionarCorpo(item)}
                  >
                    <View>
                      <Text style={[styles.corpoNome, { fontFamily: questrial }]}>
                        {item.nome}
                      </Text>

                      <Text
                        style={[styles.corpoMunicipio, { fontFamily: questrial }]}
                      >
                        {itemAny.municipio ?? itemAny.cidade ?? "Pernambuco"} - PE
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={22} color={MUTED} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={handleAlertClose}
        fontFamily={questrial}
      />
    </SafeAreaView>
  );
}

function InfoLabel({ label, questrial }: { label: string; questrial?: string }) {
  return (
    <View style={styles.infoLabel}>
      <Text style={[styles.infoLabelText, { fontFamily: questrial }]}>
        {label}
      </Text>
    </View>
  );
}

function OptionCard({
  label,
  icon,
  iconColor,
  selected,
  onPress,
  questrial,
}: {
  label: string;
  icon: any;
  iconColor: string;
  selected: boolean;
  onPress: () => void;
  questrial?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={26} color={iconColor} />
      <Text style={[styles.optionCardText, { fontFamily: questrial }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ChipOption({
  label,
  selected,
  onPress,
  questrial,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  questrial?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chipOption, selected && styles.chipOptionSelected]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          { fontFamily: questrial },
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function YesNoButton({
  label,
  selected,
  onPress,
  questrial,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  questrial?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.yesNoButton, selected && styles.yesNoButtonSelected]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.yesNoText,
          { fontFamily: questrial },
          selected && styles.yesNoTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TextArea({
  placeholder,
  value,
  onChangeText,
  questrial,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  questrial?: string;
}) {
  return (
    <TextInput
      style={[styles.smallTextArea, { fontFamily: questrial }]}
      placeholder={placeholder}
      placeholderTextColor={MUTED}
      value={value}
      onChangeText={onChangeText}
      multiline
    />
  );
}

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrapper: {
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: PRIMARY,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#e0f2f1",
    marginBottom: 14,
  },
  message: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextArea: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },
  headerLogo: {
    width: 48,
    height: 48,
  },
  scroll: {
    flex: 1,
    marginTop: -36,
    backgroundColor: BACKGROUND,
  },
  scrollContent: {
    paddingBottom: 36,
    backgroundColor: BACKGROUND,
  },
  mainPanel: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 12,
  },
  waterBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: WHITE,
  },
  circleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E5F7F4",
    justifyContent: "center",
    alignItems: "center",
  },
  waterBodyInput: { flex: 1, justifyContent: "center" },
  waterBodyName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
  },
  waterBodyCity: {
    marginTop: 2,
    fontSize: 13,
    color: MUTED,
  },
  placeholder: { color: MUTED, fontWeight: "400" },
  tipoGrid: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  tipoCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 14,
    position: "relative",
    backgroundColor: WHITE,
  },
  tipoCardActive: {
    borderColor: ACCENT,
    backgroundColor: "#F0FFFC",
  },
  tipoCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DDF7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  tipoIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAF4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  tipoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  tipoDescription: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  innerCard: {
    backgroundColor: SOFT,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  innerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  innerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  measureRow: {
    flexDirection: "row",
    backgroundColor: WHITE,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  measureBox: { flex: 1 },
  measureDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginHorizontal: 10,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  infoLabelText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
  },
  phRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  smallButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
  },
  smallButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: PRIMARY,
    lineHeight: 24,
  },
  phValue: {
    fontSize: 24,
    fontWeight: "800",
    color: PRIMARY,
  },
  hint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
  },
  optionGridFour: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  optionGridThree: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  optionGridFive: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  optionGridTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  optionCard: {
    flex: 1,
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  optionCardSelected: {
    borderColor: ACCENT,
    backgroundColor: "#F0FFFC",
  },
  optionCardText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    color: TEXT,
    textAlign: "center",
  },
  chipOption: {
    width: "48%",
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  chipOptionSelected: {
    borderColor: ACCENT,
    backgroundColor: "#F0FFFC",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT,
    textAlign: "center",
  },
  chipTextSelected: { color: PRIMARY },
  yesNoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  yesNoButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    justifyContent: "center",
    alignItems: "center",
  },
  yesNoButtonSelected: {
    borderColor: ACCENT,
    backgroundColor: "#F0FFFC",
  },
  yesNoText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  yesNoTextSelected: { color: PRIMARY },
  smallTextArea: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    padding: 12,
    fontSize: 14,
    color: TEXT,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  descriptionArea: { marginBottom: 16 },
  descriptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 8,
  },
  optional: {
    fontSize: 13,
    fontWeight: "400",
    color: MUTED,
  },
  textAreaWrapper: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    position: "relative",
  },
  descriptionInput: {
    flex: 1,
    minHeight: 50,
    fontSize: 14,
    color: TEXT,
    textAlignVertical: "top",
    paddingRight: 40,
  },
  counter: {
    position: "absolute",
    right: 12,
    bottom: 10,
    color: MUTED,
    fontSize: 11,
  },
  photoRow: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: WHITE,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  photoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DDF7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  photoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  photoSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: MUTED,
  },
  plusBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: SOFT,
  },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  previewItem: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: { width: "100%", height: "100%" },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    marginHorizontal: 20,
    marginTop: 20,
    height: 54,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
    color: WHITE,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  photoModal: {
    backgroundColor: WHITE,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  modalPhotoTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 4,
  },
  modalPhotoButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  galleryButton: { backgroundColor: PRIMARY_2 },
  modalPhotoButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },
  cancelText: {
    textAlign: "center",
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: MUTED,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: SOFT,
  },
  modalHeader: {
    height: 58,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  searchContainer: {
    margin: 14,
    height: 46,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: MUTED,
  },
  corpoItem: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: BORDER,
  },
  corpoNome: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  corpoMunicipio: {
    marginTop: 3,
    fontSize: 13,
    color: MUTED,
  },
  infoBox: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#CFEDEA",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: PRIMARY,
  },
});