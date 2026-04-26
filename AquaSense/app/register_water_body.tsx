import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Pressable, Animated, Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { salvarCorpoHidrico } from "@/services/firestore/water_bodies";
import { obterContextoGeografico } from "@/services/geoService";
import {
  TipoCorpoHidrico, TipoUsoAgua, CorpoHidrico, ObservacoesVisuais,
} from "@/types/water_bodies";
import { auth } from "@/config/firebase";

const PRIMARY = "#004d48";
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

const TIPOS_CORPO_HIDRICO: TipoCorpoHidrico[] = [
  "rio", "riacho", "lago", "açude", "barragem",
  "cacimba", "nascente", "canal", "outro",
];

const TIPOS_USO_AGUA: TipoUsoAgua[] = [
  "Consumo humano", "Uso na agricultura", "Uso por animais",
  "Pesca", "Lazer", "Descarte de resíduos", "Outro",
];

const COR_OPTIONS = ["Transparente", "Esverdeada", "Amarelada", "Marrom", "Escura", "Outra"];
const ODOR_OPTIONS = ["Sem odor", "Cheiro leve", "Cheiro forte", "Cheiro químico"];

interface FormErrors {
  nome?: string;
  tipo?: string;
  tipoOutro?: string;
  localizacao?: string;
  tiposDeUso?: string;
}

interface FormData {
  nome: string;
  tipo: TipoCorpoHidrico | "";
  tipoOutro: string;
  descricao: string;
  tiposDeUso: TipoUsoAgua[];
  usoOutroDesc: string;
  latitude: number | null;
  longitude: number | null;
  municipio: string;
  cor: string | null; corDesc: string;
  odor: string | null; odorDesc: string;
  animais: "sim" | "nao" | null; animaisDesc: string;
  lixo: "sim" | "nao" | null; lixoDesc: string;
}

export default function RegisterWaterBody() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState<FormData>({
    nome: "", tipo: "", tipoOutro: "", descricao: "",
    tiposDeUso: [], usoOutroDesc: "",
    latitude: null, longitude: null, municipio: "",
    cor: null, corDesc: "", odor: null, odorDesc: "",
    animais: null, animaisDesc: "", lixo: null, lixoDesc: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationObtained, setLocationObtained] = useState(false);
  const [tipoModalVisible, setTipoModalVisible] = useState(false);
  const [usoModalVisible, setUsoModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [savedNome, setSavedNome] = useState("");
  const [savedId, setSavedId] = useState("");

  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [tempMarker, setTempMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapPickerInitialRegion, setMapPickerInitialRegion] = useState(RECIFE_FALLBACK);
  const mapPickerRef = useRef<MapView>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade,  { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleUso(uso: TipoUsoAgua) {
    setFormData((prev) => {
      const lista = prev.tiposDeUso.includes(uso)
        ? prev.tiposDeUso.filter((t) => t !== uso)
        : [...prev.tiposDeUso, uso];
      const usoOutroDesc = lista.includes("Outro") ? prev.usoOutroDesc : "";
      return { ...prev, tiposDeUso: lista, usoOutroDesc };
    });
    if (errors.tiposDeUso) setErrors((p) => ({ ...p, tiposDeUso: undefined }));
  }

  async function handleGetUserLocation() {
    setGettingLocation(true);
    setErrors((p) => ({ ...p, localizacao: undefined }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrors((p) => ({ ...p, localizacao: "Permissão de localização negada." }));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const ctx = obterContextoGeografico(latitude, longitude);
      setFormData((p) => ({ ...p, latitude, longitude, municipio: ctx.municipio || p.municipio }));
      setLocationObtained(true);
    } catch {
      setErrors((p) => ({ ...p, localizacao: "Não foi possível obter a localização. Ative o GPS." }));
    } finally {
      setGettingLocation(false);
    }
  }

  async function handleOpenMapPicker() {
    if (formData.latitude && formData.longitude) {
      const region = {
        latitude: formData.latitude, longitude: formData.longitude,
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      };
      setMapPickerInitialRegion(region);
      setTempMarker({ latitude: formData.latitude, longitude: formData.longitude });
      setMapPickerVisible(true);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 4000)
        );
        const loc = await Promise.race([locPromise, timeoutPromise]) as Location.LocationObject | null;
        if (loc) {
          const region = {
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          };
          setMapPickerInitialRegion(region);
          setTempMarker({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setMapPickerVisible(true);
          return;
        }
      }
    } catch { /* fallback abaixo */ }

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
    const ctx = obterContextoGeografico(tempMarker.latitude, tempMarker.longitude);
    setFormData((p) => ({
      ...p,
      latitude: tempMarker.latitude,
      longitude: tempMarker.longitude,
      municipio: ctx.municipio || p.municipio,
    }));
    setLocationObtained(true);
    setErrors((p) => ({ ...p, localizacao: undefined }));
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
      mapPickerRef.current?.animateToRegion({
        latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 800);
    } catch { /* silencioso */ }
  }

  function validateAll(): boolean {
    const e: FormErrors = {};
    if (!formData.nome.trim()) e.nome = "Nome é obrigatório.";
    if (!formData.tipo) e.tipo = "Selecione o tipo de corpo hídrico.";
    if (formData.tipo === "outro" && !formData.tipoOutro.trim())
      e.tipoOutro = "Informe qual é o tipo.";
    if (formData.latitude === null || formData.longitude === null)
      e.localizacao = "Informe a localização do corpo hídrico.";
    if (formData.tiposDeUso.length === 0)
      e.tiposDeUso = "Selecione pelo menos um tipo de uso da água.";
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

      const observacoes: ObservacoesVisuais = {};
      if (formData.cor) observacoes.cor = formData.cor as any;
      if (formData.odor) observacoes.odor = formData.odor as any;
      if (formData.animais) observacoes.presencaAnimais = formData.animais === "sim" ? "Sim" : "Não";
      if (formData.animais === "sim" && formData.animaisDesc.trim())
        observacoes.quaisAnimais = formData.animaisDesc.trim();
      if (formData.lixo) observacoes.presencaLixo = formData.lixo === "sim" ? "Sim" : "Não";

      const tiposDeUsoFinal = formData.tiposDeUso.map((t) => {
        if (t === "Outro" && formData.usoOutroDesc.trim())
          return `Outro: ${formData.usoOutroDesc.trim()}` as TipoUsoAgua;
        return t;
      });

      const corpoHidrico: Omit<CorpoHidrico, "id" | "dataCriacao"> = {
        nome: formData.nome.trim(),
        tipo: formData.tipo as TipoCorpoHidrico,
        tiposDeUso: tiposDeUsoFinal,
        latitude: lat, longitude: lon,
        bioma: ctx.bioma, macroRH: ctx.macroRH, mesoRH: ctx.mesoRH, microRH: ctx.microRH,
        municipio: formData.municipio || ctx.municipio,
        cadastroValido: false,
        criadoPor: userId,
      };
      if (formData.tipo === "outro" && formData.tipoOutro.trim())
        (corpoHidrico as any).tipoOutro = formData.tipoOutro.trim();
      if (formData.descricao.trim())
        corpoHidrico.comentario = formData.descricao.trim();
      if (Object.keys(observacoes).length > 0)
        corpoHidrico.observacoes = observacoes;

      const id = await salvarCorpoHidrico(corpoHidrico);
      setSavedNome(formData.nome.trim());
      setSavedId(id);
      setSuccessModalVisible(true);
    } catch (err: any) {
      setErrors({ nome: err?.message ?? "Erro ao cadastrar. Tente novamente." });
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
    if (formData.municipio) return `Localização obtida · ${formData.municipio}`;
    return "Localização obtida";
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        {/* ══ HEADER ══ */}
        <LinearGradient colors={["#004d48", "#0a6b5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient}>
          <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
            <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              {/* CORREÇÃO: color="#FFFFFF" explícito para garantir título branco */}
              <Text style={[styles.headerTitle, { fontFamily: questrial, color: "#FFFFFF" }]}>
                Registrar corpo hídrico
              </Text>
              <View style={styles.headerSpacer} />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ FAIXA TEAL ══ */}
        <LinearGradient colors={["#0d9080", "#1fc8b4", "#3ff3e7"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.tealBand}>
          <View style={styles.waveWhite} />
        </LinearGradient>

        {/* ══ FORMULÁRIO ══ */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={styles.whiteBody} contentContainerStyle={styles.whiteBodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>

              <SectionCard title="Nome do corpo hídrico" questrial={questrial}>
                <TextInput
                  style={[styles.input, { fontFamily: questrial }, errors.nome ? styles.inputError : null]}
                  placeholder="Informe o nome do corpo hídrico..."
                  placeholderTextColor={TEXT_MUTED}
                  value={formData.nome}
                  onChangeText={(t) => { update("nome", t); if (errors.nome) setErrors((p) => ({ ...p, nome: undefined })); }}
                  maxLength={100}
                />
                <ErrorMsg message={errors.nome} fontFamily={questrial} />
              </SectionCard>

              <SectionCard title="Localização" questrial={questrial}>
                {locationObtained && locationLabel ? (
                  <View style={styles.locationObtainedBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                    <Text style={[styles.locationObtainedText, { fontFamily: questrial }]}>{locationLabel}</Text>
                  </View>
                ) : null}
                <View style={styles.locationButtonsRow}>
                  <TouchableOpacity
                    style={[styles.locationBtn, styles.locationBtnGPS, errors.localizacao ? styles.locationBtnError : null]}
                    onPress={handleGetUserLocation}
                    activeOpacity={0.85}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                      <>
                        <Ionicons name="locate" size={18} color="#FFFFFF" />
                        <Text style={[styles.locationBtnText, { fontFamily: questrial }]}>Localização atual</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.locationBtn, styles.locationBtnMap, errors.localizacao ? styles.locationBtnMapError : null]}
                    onPress={handleOpenMapPicker}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="map-outline" size={18} color={PRIMARY} />
                    <Text style={[styles.locationBtnTextAlt, { fontFamily: questrial }]}>Escolher no mapa</Text>
                  </TouchableOpacity>
                </View>
                <ErrorMsg message={errors.localizacao} fontFamily={questrial} />
              </SectionCard>

              <SectionCard title="Tipo de corpo hídrico" questrial={questrial}>
                <TouchableOpacity
                  style={[styles.select, errors.tipo ? styles.inputError : null]}
                  onPress={() => setTipoModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectText, !formData.tipo && styles.placeholder, { fontFamily: questrial }]}>
                    {formData.tipo ? formData.tipo.charAt(0).toUpperCase() + formData.tipo.slice(1) : "Selecione o tipo..."}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#90a4ae" />
                </TouchableOpacity>
                <ErrorMsg message={errors.tipo} fontFamily={questrial} />

                {formData.tipo === "outro" && (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.subLabelRow}>
                      <Ionicons name="create-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                      <Text style={[styles.subLabel, { fontFamily: questrial }]}>Qual é o tipo?</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { fontFamily: questrial }, errors.tipoOutro ? styles.inputError : null]}
                      placeholder="Descreva o tipo do corpo hídrico..."
                      placeholderTextColor={TEXT_MUTED}
                      value={formData.tipoOutro}
                      onChangeText={(t) => { update("tipoOutro", t); if (errors.tipoOutro) setErrors((p) => ({ ...p, tipoOutro: undefined })); }}
                      maxLength={60}
                    />
                    <ErrorMsg message={errors.tipoOutro} fontFamily={questrial} />
                  </View>
                )}
              </SectionCard>

              <SectionCard title="Descrição" questrial={questrial}>
                <DescriptionInput value={formData.descricao} onChange={(t) => update("descricao", t)} placeholder="Descreva o corpo hídrico..." questrial={questrial} />
              </SectionCard>

              <SectionCard title="Cor" questrial={questrial}>
                <RadioGroup options={COR_OPTIONS} selected={formData.cor} onSelect={(v) => update("cor", v)} questrial={questrial} columns={3} />
                <DescriptionInput value={formData.corDesc} onChange={(v) => update("corDesc", v)} placeholder="Descreva melhor a cor observada..." questrial={questrial} />
              </SectionCard>

              <SectionCard title="Odor" questrial={questrial}>
                <RadioGroup options={ODOR_OPTIONS} selected={formData.odor} onSelect={(v) => update("odor", v)} questrial={questrial} columns={2} />
                <DescriptionInput value={formData.odorDesc} onChange={(v) => update("odorDesc", v)} placeholder="Descreva melhor o odor observado..." questrial={questrial} />
              </SectionCard>

              <SectionCard title="Presença de lixo" questrial={questrial}>
                <YesNoToggle value={formData.lixo} onChange={(v) => { update("lixo", v); if (v === "nao") update("lixoDesc", ""); }} questrial={questrial} />
                {formData.lixo === "sim" && (
                  <>
                    <View style={styles.subLabelRow}>
                      <Ionicons name="trash-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                      <Text style={[styles.subLabel, { fontFamily: questrial }]}>O que você observou?</Text>
                    </View>
                    <DescriptionInput value={formData.lixoDesc} onChange={(v) => update("lixoDesc", v)} placeholder="Descreva melhor a presença de lixo..." questrial={questrial} />
                  </>
                )}
              </SectionCard>

              <SectionCard title="Presença de animais" questrial={questrial}>
                <YesNoToggle value={formData.animais} onChange={(v) => { update("animais", v); if (v === "nao") update("animaisDesc", ""); }} questrial={questrial} />
                {formData.animais === "sim" && (
                  <>
                    <View style={styles.subLabelRow}>
                      <Ionicons name="paw-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                      <Text style={[styles.subLabel, { fontFamily: questrial }]}>Quais animais você observou?</Text>
                    </View>
                    <DescriptionInput value={formData.animaisDesc} onChange={(v) => update("animaisDesc", v)} placeholder="Descreva melhor os animais observados..." questrial={questrial} />
                  </>
                )}
              </SectionCard>

              <SectionCard title="Como a água é usada?" questrial={questrial}>
                <TouchableOpacity
                  style={[styles.select, errors.tiposDeUso ? styles.inputError : null]}
                  onPress={() => setUsoModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectText, formData.tiposDeUso.length === 0 && styles.placeholder, { fontFamily: questrial }]}>
                    {formData.tiposDeUso.length === 0 ? "Selecione as formas de uso..." : `${formData.tiposDeUso.length} forma(s) selecionada(s)`}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#90a4ae" />
                </TouchableOpacity>
                <ErrorMsg message={errors.tiposDeUso} fontFamily={questrial} />
                {formData.tiposDeUso.includes("Outro") && (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.subLabelRow}>
                      <Ionicons name="create-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                      <Text style={[styles.subLabel, { fontFamily: questrial }]}>Qual outro uso?</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { fontFamily: questrial }]}
                      placeholder="Descreva o uso da água..."
                      placeholderTextColor={TEXT_MUTED}
                      value={formData.usoOutroDesc}
                      onChangeText={(t) => update("usoOutroDesc", t)}
                      maxLength={80}
                    />
                  </View>
                )}
              </SectionCard>

              <TouchableOpacity style={styles.publishButton} onPress={handleRegister} activeOpacity={0.85} disabled={loading}>
                <LinearGradient colors={["#004d48", "#0d9080"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                    <Text style={[styles.publishButtonText, { fontFamily: questrial }]}>Registrar corpo hídrico</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ══ MODAL: SELECIONAR NO MAPA ══ */}
      <Modal visible={mapPickerVisible} animationType="slide" statusBarTranslucent onRequestClose={handleCancelMapPicker}>
        <View style={[styles.mapPickerRoot, { paddingTop: insets.top }]}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          <LinearGradient colors={["#004d48", "#0a6b5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.mapPickerHeaderRow}>
              <TouchableOpacity style={styles.backButton} onPress={handleCancelMapPicker} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              {/* CORREÇÃO: color="#FFFFFF" explícito */}
              <Text style={[styles.headerTitle, { fontFamily: questrial, color: "#FFFFFF" }]}>
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

          <TouchableOpacity style={styles.mapPickerGPSBtn} onPress={handleCenterOnUser} activeOpacity={0.85}>
            <Ionicons name="locate" size={22} color={PRIMARY} />
          </TouchableOpacity>

          <View style={[
            styles.mapPickerFooter,
            { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 16 : 16) },
          ]}>
            <TouchableOpacity style={styles.mapPickerCancelBtn} onPress={handleCancelMapPicker} activeOpacity={0.8}>
              <Text style={[styles.mapPickerCancelText, { fontFamily: questrial }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapPickerConfirmBtn, !tempMarker && styles.mapPickerConfirmBtnDisabled]}
              onPress={handleConfirmMapLocation}
              activeOpacity={0.85}
              disabled={!tempMarker}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.mapPickerConfirmText, { fontFamily: questrial }]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ MODAL: TIPO ══ */}
      <Modal visible={tipoModalVisible} transparent animationType="fade" onRequestClose={() => setTipoModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setTipoModalVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: questrial }]}>Tipo de corpo hídrico</Text>
            <View style={styles.sheetDivider} />
            <FlatList
              data={TIPOS_CORPO_HIDRICO}
              keyExtractor={(i) => i}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.sheetItem, formData.tipo === item && styles.sheetItemActive]}
                  onPress={() => { update("tipo", item); setErrors((p) => ({ ...p, tipo: undefined })); setTipoModalVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sheetItemText, { fontFamily: questrial }, formData.tipo === item && styles.sheetItemTextActive]}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                  {formData.tipo === item && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sheetSep} />}
            />
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setTipoModalVisible(false)}>
              <Text style={[styles.sheetCloseTxt, { fontFamily: questrial }]}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══ MODAL: TIPOS DE USO ══ */}
      <Modal visible={usoModalVisible} transparent animationType="fade" onRequestClose={() => setUsoModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setUsoModalVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: questrial }]}>Como a água é usada?</Text>
            <View style={styles.sheetDivider} />
            <FlatList
              data={TIPOS_USO_AGUA}
              keyExtractor={(i) => i}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const sel = formData.tiposDeUso.includes(item);
                return (
                  <TouchableOpacity style={styles.sheetItem} onPress={() => toggleUso(item)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, sel && styles.checkboxChecked]}>
                      {sel && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.sheetItemText, { fontFamily: questrial }]}>{item}</Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.sheetSep} />}
            />
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setUsoModalVisible(false)}>
              <Text style={[styles.sheetCloseTxt, { fontFamily: questrial }]}>Concluir</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══ MODAL: SUCESSO ══ */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={handleSuccessConfirm}>
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={40} color={PRIMARY} />
            </View>
            <Text style={[styles.successTitle, { fontFamily: questrial }]}>Cadastro realizado!</Text>
            <View style={styles.successDivider} />
            <Text style={[styles.successBody, { fontFamily: questrial }]}>
              Seu registro ficará pendente de validação. O gestor irá revisar as informações e validá-las em breve.
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={handleSuccessConfirm} activeOpacity={0.85}>
              <Text style={[styles.successBtnText, { fontFamily: questrial }]}>Ver status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────
function SectionCard({ title, questrial, children }: { title: string; questrial?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>{title}</Text>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

function RadioGroup({ options, selected, onSelect, questrial, columns = 2 }: {
  options: string[]; selected: string | null; onSelect: (v: string) => void; questrial?: string; columns?: number;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
  return (
    <View style={{ marginBottom: 10 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.radioRow}>
          {row.map((opt) => {
            const active = selected === opt;
            return (
              <TouchableOpacity key={opt} style={styles.radioItem} onPress={() => onSelect(opt)} activeOpacity={0.7}>
                <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.radioLabel, { fontFamily: questrial }, active && styles.radioLabelActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function YesNoToggle({ value, onChange, questrial }: { value: "sim" | "nao" | null; onChange: (v: "sim" | "nao") => void; questrial?: string }) {
  return (
    <View style={styles.yesNoWrapper}>
      {(["sim", "nao"] as const).map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity key={opt} style={[styles.yesNoButton, active && styles.yesNoButtonActive]} onPress={() => onChange(opt)} activeOpacity={0.8}>
            <Text style={[styles.yesNoText, { fontFamily: questrial }, active && styles.yesNoTextActive]}>
              {opt === "sim" ? "Sim" : "Não"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DescriptionInput({ value, onChange, placeholder, questrial }: { value: string; onChange: (v: string) => void; placeholder: string; questrial?: string }) {
  return (
    <TextInput
      style={[styles.descInput, { fontFamily: questrial }]}
      placeholder={placeholder}
      placeholderTextColor={TEXT_MUTED}
      value={value}
      onChangeText={onChange}
      multiline
      numberOfLines={2}
      textAlignVertical="top"
    />
  );
}

function ErrorMsg({ message, fontFamily }: { message?: string; fontFamily?: string }) {
  if (!message) return null;
  return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  headerGradient: {},
  headerSafeArea: { paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 },

  headerTitle: { flex: 1, fontSize: 18, color: "#FFFFFF", fontWeight: "700", letterSpacing: 0.2 },
  headerSpacer: { width: 36 },

  tealBand: { paddingTop: 12, paddingBottom: 0, overflow: "hidden" },
  waveWhite: { height: 28, backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  whiteBody: { flex: 1, backgroundColor: "#FFFFFF" },
  whiteBodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },

  sectionCard: { backgroundColor: SURFACE, borderRadius: 20, padding: 20, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 16, color: PRIMARY, fontWeight: "700", marginBottom: 10 },
  sectionDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 14 },

  input: { backgroundColor: "#FFFFFF", borderRadius: 12, height: 48, paddingHorizontal: 16, fontSize: 14, color: "#3d5a58", borderWidth: 1.5, borderColor: BORDER_LIGHT },
  inputError: { borderColor: "#ef9a9a" },
  descInput: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: "#444", minHeight: 52, textAlignVertical: "top" },
  select: { backgroundColor: "#FFFFFF", borderRadius: 12, height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: BORDER_LIGHT },
  selectText: { fontSize: 14, color: "#3d5a58", flex: 1 },
  placeholder: { color: TEXT_MUTED },
  errorText: { fontSize: 11, color: "#e57373", marginTop: 5, marginLeft: 4 },

  locationButtonsRow: { flexDirection: "row", gap: 10 },
  locationObtainedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,77,72,0.07)", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  locationObtainedText: { fontSize: 13, color: PRIMARY, fontWeight: "600", flex: 1 },
  locationBtn: { flex: 1, borderRadius: 50, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 },
  locationBtnGPS: { backgroundColor: TEAL_MID },
  locationBtnMap: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: PRIMARY },
  locationBtnError: { borderWidth: 1.5, borderColor: "#ef9a9a" },
  locationBtnMapError: { borderColor: "#ef9a9a" },
  locationBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  locationBtnTextAlt: { color: PRIMARY, fontSize: 13, fontWeight: "700" },

  radioRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8, gap: 8 },
  radioItem: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 90 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#b0c4c2", alignItems: "center", justifyContent: "center" },
  radioCircleActive: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  radioLabel: { fontSize: 13, color: "#555" },
  radioLabelActive: { color: PRIMARY, fontWeight: "600" },

  yesNoWrapper: { flexDirection: "row", gap: 10, marginBottom: 14 },
  yesNoButton: { flex: 1, borderRadius: 50, paddingVertical: 10, alignItems: "center", backgroundColor: "#E8F4F2" },
  yesNoButtonActive: { backgroundColor: PRIMARY },
  yesNoText: { fontSize: 14, color: TEXT_MUTED, fontWeight: "600" },
  yesNoTextActive: { color: "#FFFFFF" },

  subLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  subLabel: { fontSize: 13, color: TEAL_MID, fontWeight: "600" },

  publishButton: { borderRadius: 50, marginTop: 4, marginBottom: 8, overflow: "hidden", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6 },
  publishGradient: { paddingVertical: 16, alignItems: "center" },
  publishButtonText: { fontSize: 16, color: "#FFFFFF", fontWeight: "700", letterSpacing: 0.3 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.50)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  bottomSheet: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 22, paddingTop: 22, maxHeight: "70%", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: PRIMARY, textAlign: "center", marginBottom: 14, paddingHorizontal: 20 },
  sheetDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 4 },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 22, justifyContent: "space-between" },
  sheetItemActive: { backgroundColor: "rgba(13,144,128,0.06)" },
  sheetItemText: { fontSize: 14, color: "#546e7a", flex: 1 },
  sheetItemTextActive: { color: PRIMARY, fontWeight: "700" },
  sheetSep: { height: 1, backgroundColor: "#f5f5f5", marginHorizontal: 12 },
  sheetCloseBtn: { marginHorizontal: 20, marginTop: 8, marginBottom: 18, backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: "center" },
  sheetCloseTxt: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: PRIMARY, alignItems: "center", justifyContent: "center", marginRight: 12 },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  successCard: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 28, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(63,243,231,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: "700", color: PRIMARY, marginBottom: 14, textAlign: "center" },
  successDivider: { height: 1, backgroundColor: BORDER_LIGHT, width: "100%", marginBottom: 14 },
  successBody: { fontSize: 14, color: TEXT_MUTED, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  successBtn: { width: "100%", backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: "center" },
  successBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.4 },

  // MAP PICKER
  mapPickerRoot: { flex: 1, backgroundColor: "#000" },
  mapPickerHeaderRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  mapPickerHint: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.95)", paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT },
  mapPickerHintText: { fontSize: 13, color: PRIMARY, flex: 1 },
  mapPickerMarker: { alignItems: "center", justifyContent: "center" },
  mapPickerGPSBtn: { position: "absolute", right: 16, bottom: 110, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5 },
  mapPickerFooter: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 16, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: BORDER_LIGHT },
  mapPickerCancelBtn: { flex: 1, borderRadius: 50, height: 50, backgroundColor: "#2C2C2C", alignItems: "center", justifyContent: "center" },
  mapPickerCancelText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  mapPickerConfirmBtn: { flex: 1.5, borderRadius: 50, height: 50, backgroundColor: PRIMARY, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  mapPickerConfirmBtnDisabled: { backgroundColor: "#90a4ae" },
  mapPickerConfirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});