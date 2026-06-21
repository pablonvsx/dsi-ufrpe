import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { auth } from "@/config/firebase";
import { obterContextoGeografico } from "@/services/geoService";
import { salvarCorpoHidrico } from "@/services/firestore/water_bodies";
import { CorpoHidrico, TipoCorpoHidrico } from "@/types/water_bodies";

const PRIMARY = "#004d48";
const TEAL = "#0a6b5e";
const TEAL_MID = "#0d9080";
const SURFACE = "#F5F9F8";
const BORDER_LIGHT = "#e0f2f1";
const TEXT_MUTED = "#6b7a7a";

const RECIFE_FALLBACK = {
  latitude: -8.0476,
  longitude: -34.877,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// 5 tipos visíveis: 3 na primeira linha (Rio / Canal / Lago) e 2 na segunda
// (Açude / Outro). Todos os ícones usam a cor PRIMARY (verde escuro).
const TIPOS_VISIVEIS: {
  value: TipoCorpoHidrico;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  wide?: boolean;
}[] = [
  { value: "rio", label: "Rio", icon: "water-outline", color: PRIMARY },
  { value: "canal", label: "Canal", icon: "boat-outline", color: PRIMARY },
  { value: "lago", label: "Lago", icon: "anchor-outline" as any, color: PRIMARY },
  { value: "açude", label: "Açude", icon: "business-outline", color: PRIMARY, wide: true },
  { value: "outro", label: "Outro", icon: "ellipsis-horizontal", color: PRIMARY, wide: true },
];

interface FormErrors {
  nome?: string;
  tipo?: string;
  tipoOutro?: string;
  localizacao?: string;
}

interface FormData {
  nome: string;
  tipo: TipoCorpoHidrico | "";
  tipoOutro: string;
  descricao: string;
  latitude: number | null;
  longitude: number | null;
  municipio: string;
  fotoUri: string | null;
}

export default function RegisterWaterBody() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState<FormData>({
    nome: "",
    tipo: "",
    tipoOutro: "",
    descricao: "",
    latitude: null,
    longitude: null,
    municipio: "",
    fotoUri: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationObtained, setLocationObtained] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [savedNome, setSavedNome] = useState("");
  const [savedId, setSavedId] = useState("");

  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [tempMarker, setTempMarker] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapPickerInitialRegion, setMapPickerInitialRegion] =
    useState(RECIFE_FALLBACK);

  const mapPickerRef = useRef<MapView>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGetUserLocation() {
    setGettingLocation(true);
    setErrors((prev) => ({ ...prev, localizacao: undefined }));

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setErrors((prev) => ({
          ...prev,
          localizacao: "Permissão de localização negada.",
        }));
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = loc.coords;
      const ctx = obterContextoGeografico(latitude, longitude);

      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
        municipio: ctx.municipio || prev.municipio,
      }));

      setLocationObtained(true);
    } catch {
      setErrors((prev) => ({
        ...prev,
        localizacao: "Não foi possível obter a localização. Ative o GPS.",
      }));
    } finally {
      setGettingLocation(false);
    }
  }

  async function handleOpenMapPicker() {
    if (formData.latitude && formData.longitude) {
      const region = {
        latitude: formData.latitude,
        longitude: formData.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setMapPickerInitialRegion(region);
      setTempMarker({
        latitude: formData.latitude,
        longitude: formData.longitude,
      });
      setMapPickerVisible(true);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const locPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 4000)
        );

        const loc = (await Promise.race([
          locPromise,
          timeoutPromise,
        ])) as Location.LocationObject | null;

        if (loc) {
          const region = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };

          setMapPickerInitialRegion(region);
          setTempMarker({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          setMapPickerVisible(true);
          return;
        }
      }
    } catch {}

    setMapPickerInitialRegion(RECIFE_FALLBACK);
    setTempMarker(null);
    setMapPickerVisible(true);
  }

  function handleMapPickerPress(e: any) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setTempMarker({ latitude, longitude });
  }

  function handleConfirmMapLocation() {
    if (!tempMarker) return;

    const ctx = obterContextoGeografico(
      tempMarker.latitude,
      tempMarker.longitude
    );

    setFormData((prev) => ({
      ...prev,
      latitude: tempMarker.latitude,
      longitude: tempMarker.longitude,
      municipio: ctx.municipio || prev.municipio,
    }));

    setLocationObtained(true);
    setErrors((prev) => ({ ...prev, localizacao: undefined }));
    setMapPickerVisible(false);
  }

  function handleCancelMapPicker() {
    setTempMarker(null);
    setMapPickerVisible(false);
  }

  async function handleCenterOnUser() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setTempMarker({ latitude, longitude });

      mapPickerRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800
      );
    } catch {}
  }

  function handleAddPhoto() {
    Alert.alert(
      "Foto opcional",
      "O campo de foto já está reservado na interface. A integração com upload pode ser feita depois."
    );
  }

  function validateAll(): boolean {
    const e: FormErrors = {};

    if (!formData.nome.trim()) e.nome = "Nome é obrigatório.";
    if (!formData.tipo) e.tipo = "Selecione o tipo de corpo hídrico.";
    if (formData.tipo === "outro" && !formData.tipoOutro.trim()) {
      e.tipoOutro = "Informe qual é o tipo.";
    }
    if (formData.latitude === null || formData.longitude === null) {
      e.localizacao = "Informe a localização do corpo hídrico.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validateAll()) return;

    setLoading(true);

    try {
      const lat = formData.latitude!;
      const lon = formData.longitude!;
      const ctx = obterContextoGeografico(lat, lon);
      const userId = auth.currentUser?.uid ?? "anonymous";

      const corpoHidrico: Omit<CorpoHidrico, "id" | "dataCriacao"> = {
        nome: formData.nome.trim(),
        tipo: formData.tipo as TipoCorpoHidrico,
        tiposDeUso: [],
        latitude: lat,
        longitude: lon,
        bioma: ctx.bioma,
        macroRH: ctx.macroRH,
        mesoRH: ctx.mesoRH,
        microRH: ctx.microRH,
        municipio: formData.municipio || ctx.municipio,
        cadastroValido: false,
        criadoPor: userId,
      };

      if (formData.tipo === "outro" && formData.tipoOutro.trim()) {
        (corpoHidrico as any).tipoOutro = formData.tipoOutro.trim();
      }

      if (formData.descricao.trim()) {
        corpoHidrico.comentario = formData.descricao.trim();
      }

      if (formData.fotoUri) {
        (corpoHidrico as any).fotoUri = formData.fotoUri;
      }

      const id = await salvarCorpoHidrico(corpoHidrico);

      setSavedNome(formData.nome.trim());
      setSavedId(id);
      setSuccessModalVisible(true);
    } catch (err: any) {
      setErrors({
        nome: err?.message ?? "Erro ao cadastrar. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSuccessConfirm() {
    setSuccessModalVisible(false);

    router.replace({
      pathname: "/water_body_status" as any,
      params: { nome: savedNome, id: savedId },
    });
  }

  const locationLabel = (() => {
    if (!locationObtained) return null;
    if (formData.municipio) return formData.municipio;
    return "Localização obtida";
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        <LinearGradient
          colors={[PRIMARY, TEAL]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
            <Animated.View
              style={[
                styles.headerRow,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerTextBox}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                  Cadastrar novo{"\n"}corpo hídrico
                </Text>

                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Ajude a mapear e monitorar{"\n"}novos pontos da nossa região.
                </Text>
              </View>

              <Image
                source={require("../assets/images/aquasense.png")}
                style={styles.headerLogo}
                resizeMode="contain"
                tintColor="#FFFFFF"
              />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                opacity: cardFade,
                transform: [{ translateY: cardSlide }],
              }}
            >
              <SectionCard number="1" title="Informações básicas" questrial={questrial}>
                <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>
                  Nome do corpo hídrico
                </Text>

                <View style={[styles.inputWrapper, errors.nome && styles.inputError]}>
                  <Ionicons name="water-outline" size={19} color="#8c9696" />
                  <TextInput
                    style={[styles.input, { fontFamily: questrial }]}
                    placeholder="Ex.: Rio Maracanã, Canal do X, Lago..."
                    placeholderTextColor="#8c9696"
                    value={formData.nome}
                    onChangeText={(text) => {
                      update("nome", text);
                      if (errors.nome) {
                        setErrors((prev) => ({ ...prev, nome: undefined }));
                      }
                    }}
                    maxLength={60}
                  />
                  <Text style={[styles.counterText, { fontFamily: questrial }]}>
                    {formData.nome.length}/60
                  </Text>
                </View>

                <ErrorMsg message={errors.nome} fontFamily={questrial} />

                <View style={styles.typeLabelRow}>
                  <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>
                    Tipo de corpo hídrico
                  </Text>
                  <Ionicons name="information-circle-outline" size={16} color={TEXT_MUTED} />
                </View>

                <View style={styles.typeGrid}>
                  {TIPOS_VISIVEIS.map((tipo) => {
                    const active = formData.tipo === tipo.value;

                    return (
                      <TouchableOpacity
                        key={tipo.value}
                        activeOpacity={0.85}
                        style={[
                          styles.typeCard,
                          tipo.wide && styles.typeCardWide,
                          active && styles.typeCardActive,
                        ]}
                        onPress={() => {
                          update("tipo", tipo.value);
                          setErrors((prev) => ({ ...prev, tipo: undefined }));
                        }}
                      >
                        {active && (
                          <View style={styles.typeCheck}>
                            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                          </View>
                        )}

                        <Ionicons
                          name={tipo.icon}
                          size={28}
                          color={tipo.color}
                          style={styles.typeIcon}
                        />

                        <Text style={[styles.typeText, { fontFamily: questrial }]}>
                          {tipo.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ErrorMsg message={errors.tipo} fontFamily={questrial} />

                {formData.tipo === "outro" && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>
                      Qual é o tipo?
                    </Text>

                    <View style={[styles.inputWrapper, errors.tipoOutro && styles.inputError]}>
                      <Ionicons name="create-outline" size={18} color="#8c9696" />
                      <TextInput
                        style={[styles.input, { fontFamily: questrial }]}
                        placeholder="Descreva o tipo..."
                        placeholderTextColor="#8c9696"
                        value={formData.tipoOutro}
                        onChangeText={(text) => {
                          update("tipoOutro", text);
                          if (errors.tipoOutro) {
                            setErrors((prev) => ({ ...prev, tipoOutro: undefined }));
                          }
                        }}
                        maxLength={60}
                      />
                    </View>

                    <ErrorMsg message={errors.tipoOutro} fontFamily={questrial} />
                  </View>
                )}
              </SectionCard>

              <SectionCard number="2" title="Localização" questrial={questrial}>
                <View style={styles.locationHintBox}>
                  <Ionicons name="location-outline" size={22} color={PRIMARY} />
                  <Text style={[styles.locationHintText, { fontFamily: questrial }]}>
                    Use sua localização atual ou marque no mapa{"\n"}o ponto exato do corpo hídrico.
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>
                  Localização atual
                </Text>

                <TouchableOpacity
                  style={[styles.locationBox, errors.localizacao && styles.inputError]}
                  onPress={handleGetUserLocation}
                  activeOpacity={0.85}
                  disabled={gettingLocation}
                >
                  <Ionicons name="location-outline" size={22} color={PRIMARY} />

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.locationMainText, { fontFamily: questrial }]}>
                      {locationObtained && locationLabel
                        ? `${locationLabel} - PE`
                        : "Toque para obter localização"}
                    </Text>
                    {locationObtained && (
                      <Text style={[styles.locationSubText, { fontFamily: questrial }]}>
                        Precisão aproximada
                      </Text>
                    )}
                  </View>

                  <View style={styles.locationTargetBtn}>
                    {gettingLocation ? (
                      <ActivityIndicator color={PRIMARY} size="small" />
                    ) : (
                      <Ionicons name="locate-outline" size={24} color={PRIMARY} />
                    )}
                  </View>
                </TouchableOpacity>

                <ErrorMsg message={errors.localizacao} fontFamily={questrial} />

                <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>
                  Ou marque no mapa
                </Text>

                <TouchableOpacity
                  style={styles.mapPreview}
                  onPress={handleOpenMapPicker}
                  activeOpacity={0.85}
                >
                  <View style={styles.fakeMapLine} />
                  <View style={styles.fakeRiver} />
                  <Ionicons name="location" size={54} color={PRIMARY} style={styles.mapPin} />
                  <Text style={[styles.mapStatusText, { fontFamily: questrial }]}>
                    {formData.latitude && formData.longitude
                      ? "Ponto marcado"
                      : "Nenhum ponto marcado"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.openMapBtn}
                  onPress={handleOpenMapPicker}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map-outline" size={20} color={PRIMARY} />
                  <Text style={[styles.openMapText, { fontFamily: questrial }]}>
                    Abrir mapa
                  </Text>
                </TouchableOpacity>
              </SectionCard>

              <SectionCard number="3" title="Descrição" optional questrial={questrial}>
                <Text style={[styles.sectionSmallText, { fontFamily: questrial }]}>
                  Conte mais detalhes sobre o corpo hídrico
                </Text>

                <View style={styles.descriptionWrapper}>
                  <Ionicons name="document-text-outline" size={20} color="#8c9696" />
                  <TextInput
                    style={[styles.descriptionInput, { fontFamily: questrial }]}
                    placeholder="Ex.: características, tamanho aproximado, condições atuais, observações..."
                    placeholderTextColor="#8c9696"
                    value={formData.descricao}
                    onChangeText={(text) => update("descricao", text)}
                    multiline
                    maxLength={300}
                    textAlignVertical="top"
                  />
                  <Text style={[styles.descriptionCounter, { fontFamily: questrial }]}>
                    {formData.descricao.length}/300
                  </Text>
                </View>
              </SectionCard>

              <SectionCard number="4" title="Foto" optional questrial={questrial}>
                <Text style={[styles.sectionSmallText, { fontFamily: questrial }]}>
                  Adicione fotos para ajudar na análise e validação.
                </Text>

                <TouchableOpacity
                  style={styles.photoBox}
                  onPress={handleAddPhoto}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={34} color={PRIMARY} />
                  <Text style={[styles.photoTitle, { fontFamily: questrial }]}>
                    Adicionar{"\n"}foto
                  </Text>
                </TouchableOpacity>
              </SectionCard>

              <View style={styles.finalNotice}>
                <Ionicons name="shield-checkmark-outline" size={26} color={PRIMARY} />
                <Text style={[styles.finalNoticeText, { fontFamily: questrial }]}>
                  Após o envio, sua solicitação será analisada{"\n"}pela equipe técnica antes de ser publicada.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.publishButton}
                onPress={handleRegister}
                activeOpacity={0.85}
                disabled={loading}
              >
                <LinearGradient
                  colors={[PRIMARY, TEAL_MID]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.publishGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                      <Text style={[styles.publishButtonText, { fontFamily: questrial }]}>
                        Enviar para validação
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal
        visible={mapPickerVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleCancelMapPicker}
      >
        <View style={[styles.mapPickerRoot, { paddingTop: insets.top }]}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          <LinearGradient
            colors={[PRIMARY, TEAL]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.mapPickerHeaderRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleCancelMapPicker}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={[styles.mapHeaderTitle, { fontFamily: questrial }]}>
                Selecionar localização
              </Text>

              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>

          <View style={styles.mapPickerHint}>
            <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
            <Text style={[styles.mapPickerHintText, { fontFamily: questrial }]}>
              Toque no mapa para marcar a localização
            </Text>
          </View>

          <MapView
            ref={mapPickerRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapPickerInitialRegion}
            mapType="satellite"
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            onPress={handleMapPickerPress}
          >
            {tempMarker && (
              <Marker coordinate={tempMarker}>
                <View style={styles.mapPickerMarker}>
                  <Ionicons name="location" size={36} color="#E74C3C" />
                </View>
              </Marker>
            )}
          </MapView>

          <TouchableOpacity
            style={styles.mapPickerGPSBtn}
            onPress={handleCenterOnUser}
            activeOpacity={0.85}
          >
            <Ionicons name="locate" size={22} color={PRIMARY} />
          </TouchableOpacity>

          <View
            style={[
              styles.mapPickerFooter,
              {
                paddingBottom: Math.max(
                  insets.bottom,
                  Platform.OS === "ios" ? 16 : 16
                ),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.mapPickerCancelBtn}
              onPress={handleCancelMapPicker}
              activeOpacity={0.8}
            >
              <Text style={[styles.mapPickerCancelText, { fontFamily: questrial }]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mapPickerConfirmBtn,
                !tempMarker && styles.mapPickerConfirmBtnDisabled,
              ]}
              onPress={handleConfirmMapLocation}
              activeOpacity={0.85}
              disabled={!tempMarker}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={[styles.mapPickerConfirmText, { fontFamily: questrial }]}>
                Confirmar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessConfirm}
      >
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={42} color={PRIMARY} />
            </View>

            <Text style={[styles.successTitle, { fontFamily: questrial }]}>
              Cadastro enviado!
            </Text>

            <View style={styles.successDivider} />

            <Text style={[styles.successBody, { fontFamily: questrial }]}>
              O corpo hídrico ficará pendente de validação. Um responsável irá revisar as informações antes da publicação.
            </Text>

            <TouchableOpacity
              style={styles.successBtn}
              onPress={handleSuccessConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.successBtnText, { fontFamily: questrial }]}>
                Ver status
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SectionCard({
  number,
  title,
  optional,
  questrial,
  children,
}: {
  number: string;
  title: string;
  optional?: boolean;
  questrial?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.stepCircle}>
          <Text style={styles.stepNumber}>{number}</Text>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
            {title}
          </Text>

          {optional && (
            <Text style={[styles.optionalText, { fontFamily: questrial }]}>
              (opcional)
            </Text>
          )}
        </View>
      </View>

      {children}
    </View>
  );
}

function ErrorMsg({
  message,
  fontFamily,
}: {
  message?: string;
  fontFamily?: string;
}) {
  if (!message) return null;

  return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  headerGradient: {
    paddingBottom: 44,
  },

  headerSafeArea: {
    paddingBottom: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 18,
  },

  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextBox: {
    flex: 1,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 39,
    fontWeight: "700",
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 17,
    lineHeight: 24,
    marginTop: 8,
  },

  headerLogo: {
    width: 54,
    height: 54,
    marginTop: 4,
  },

  headerSpacer: {
    width: 56,
  },

  body: {
    flex: 1,
    backgroundColor: SURFACE,
    marginTop: -26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 38,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
    gap: 4,
  },

  sectionTitle: {
    color: PRIMARY,
    fontSize: 19,
    fontWeight: "700",
  },

  optionalText: {
    color: TEXT_MUTED,
    fontSize: 13,
  },

  fieldLabel: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputWrapper: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1.3,
    borderColor: "#d8e1e1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  input: {
    flex: 1,
    color: "#263838",
    fontSize: 14,
    paddingHorizontal: 10,
  },

  counterText: {
    color: "#778282",
    fontSize: 12,
  },

  inputError: {
    borderColor: "#ef9a9a",
  },

  typeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 10,
  },

  // IMPORTANTE: aqui está a correção do alinhamento.
  // Em vez de usar `gap` (que soma px fixos a larguras em %, quebrando o
  // cálculo de quantos cards cabem por linha), usamos justifyContent:
  // "space-between" + rowGap. Assim o RN encaixa exatamente 3 cards na
  // primeira linha (31% cada) e 2 na segunda (48% cada), sem sobra de
  // espaço que force a quebra errada.
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  typeCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: "#d8e1e1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  typeCardWide: {
    width: "48%",
    aspectRatio: undefined,
    minHeight: 94,
  },

  typeCardActive: {
    borderColor: PRIMARY,
    backgroundColor: "#E8F5F3",
  },

  typeCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },

  typeIcon: {
    marginBottom: 8,
  },

  typeText: {
    color: PRIMARY,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },

  locationHintBox: {
    backgroundColor: "#E6F4F1",
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  locationHintText: {
    color: PRIMARY,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  locationBox: {
    minHeight: 58,
    borderRadius: 13,
    borderWidth: 1.3,
    borderColor: "#d8e1e1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 16,
  },

  locationMainText: {
    color: "#263838",
    fontSize: 13.5,
    fontWeight: "700",
  },

  locationSubText: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },

  locationTargetBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },

  mapPreview: {
    height: 86,
    borderRadius: 13,
    backgroundColor: "#EDF3F2",
    overflow: "hidden",
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  fakeMapLine: {
    position: "absolute",
    width: "120%",
    height: 1,
    backgroundColor: "#d8dfdf",
    transform: [{ rotate: "-8deg" }],
    top: 22,
  },

  fakeRiver: {
    position: "absolute",
    width: "120%",
    height: 26,
    backgroundColor: "#BCE7F4",
    transform: [{ rotate: "-5deg" }],
    top: 36,
  },

  mapPin: {
    position: "absolute",
    top: 15,
  },

  mapStatusText: {
    position: "absolute",
    bottom: 8,
    color: TEXT_MUTED,
    fontSize: 12,
  },

  openMapBtn: {
    height: 43,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: PRIMARY,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  openMapText: {
    color: PRIMARY,
    fontSize: 13.5,
    fontWeight: "700",
  },

  sectionSmallText: {
    color: TEXT_MUTED,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },

  descriptionWrapper: {
    minHeight: 118,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: "#d8e1e1",
    backgroundColor: "#FFFFFF",
    padding: 13,
  },

  descriptionInput: {
    color: "#263838",
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 72,
    paddingTop: 8,
  },

  descriptionCounter: {
    alignSelf: "flex-end",
    color: TEXT_MUTED,
    fontSize: 12,
  },

  photoBox: {
    width: 134,
    height: 120,
    borderRadius: 13,
    borderWidth: 1.3,
    borderStyle: "dashed",
    borderColor: BORDER_LIGHT,
    backgroundColor: "#E8F9F6",
    alignItems: "center",
    justifyContent: "center",
  },

  photoTitle: {
    color: PRIMARY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  finalNotice: {
    backgroundColor: "#DFF7F4",
    borderWidth: 1,
    borderColor: "#A8EFE7",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  finalNoticeText: {
    color: PRIMARY,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  publishButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },

  publishGradient: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },

  publishButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  errorText: {
    color: "#e57373",
    fontSize: 11,
    marginTop: 5,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  successCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
  },

  successIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(63,243,231,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 14,
    textAlign: "center",
  },

  successDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    width: "100%",
    marginBottom: 14,
  },

  successBody: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },

  successBtn: {
    width: "100%",
    backgroundColor: PRIMARY,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
  },

  successBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  mapPickerRoot: {
    flex: 1,
    backgroundColor: "#000",
  },

  mapPickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },

  mapHeaderTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  mapPickerHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  mapPickerHintText: {
    fontSize: 13,
    color: PRIMARY,
    flex: 1,
  },

  mapPickerMarker: {
    alignItems: "center",
    justifyContent: "center",
  },

  mapPickerGPSBtn: {
    position: "absolute",
    right: 16,
    bottom: 110,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  mapPickerFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
  },

  mapPickerCancelBtn: {
    flex: 1,
    borderRadius: 50,
    height: 50,
    backgroundColor: "#2C2C2C",
    alignItems: "center",
    justifyContent: "center",
  },

  mapPickerCancelText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  mapPickerConfirmBtn: {
    flex: 1.5,
    borderRadius: 50,
    height: 50,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  mapPickerConfirmBtnDisabled: {
    backgroundColor: "#90a4ae",
  },

  mapPickerConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});