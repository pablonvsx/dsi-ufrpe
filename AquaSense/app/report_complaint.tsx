import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, ActivityIndicator,
  Modal, Image, FlatList, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createComplaint } from '@/services/firestore/complaints';

const PRIMARY = '#004d48';
const TEAL_MID = '#0d9080';
const SURFACE = '#F5F9F8';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED = '#6b7a7a';
const ACCENT_ORANGE = '#F5A623';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAX_FOTOS = 5;
const MAX_DESC = 300;
const MAX_OBS = 250;

interface TipoProblema {
  id: string;
  label: string;
  iconName: string;
  iconLib: 'ionicons' | 'material';
  color: string;
}

const TIPOS_PROBLEMA: TipoProblema[] = [
  { id: 'esgoto',        label: 'Esgoto irregular',  iconName: 'pipe-leak',        iconLib: 'material',  color: ACCENT_ORANGE },
  { id: 'lixo',          label: 'Lixo / Resíduos',   iconName: 'trash-outline',    iconLib: 'ionicons',  color: TEAL_MID },
  { id: 'poluicao_agua', label: 'Poluição da água',  iconName: 'water',            iconLib: 'ionicons',  color: '#2196F3' },
  { id: 'desmatamento',  label: 'Desmatamento',       iconName: 'forest',           iconLib: 'material',  color: '#388E3C' },
  { id: 'queimada',      label: 'Queimada',           iconName: 'flame-outline',    iconLib: 'ionicons',  color: ACCENT_ORANGE },
  { id: 'fumaca',        label: 'Emissão de fumaça', iconName: 'smoke',            iconLib: 'material',  color: '#7B68EE' },
  { id: 'outro',         label: 'Outro',              iconName: 'ellipsis-horizontal', iconLib: 'ionicons', color: TEXT_MUTED },
];

function ProblemaIcon({ item, size = 28 }: { item: TipoProblema; size?: number }) {
  if (item.iconLib === 'material') {
    return <MaterialCommunityIcons name={item.iconName as any} size={size} color={item.color} />;
  }
  return <Ionicons name={item.iconName as any} size={size} color={item.color} />;
}

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ReportComplaint() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const Q = fontsLoaded ? 'Questrial_400Regular' : undefined;

  // Seção 1
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');

  // Seção 2 – Localização
  const [localizando, setLocalizando] = useState(false);
  const [cidade, setCidade] = useState<string | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Seção 3 – Fotos
  const [fotos, setFotos] = useState<string[]>([]);

  // Seções 4 e 5
  const now = new Date();
  const [data, setData] = useState(formatDate(now));
  const [hora, setHora] = useState(formatTime(now));
  const [observacoes, setObservacoes] = useState('');

  // Envio
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mapRef = useRef<MapView>(null);

  async function usarLocalizacaoAtual() {
    setLocalizando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative a localização nas configurações.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      setMapCoords({ latitude, longitude });
      setPrecisao(accuracy ? Math.round(accuracy) : null);

      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        const parts = [geo.city || geo.subregion, geo.region].filter(Boolean);
        setCidade(parts.join(' - '));
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    } finally {
      setLocalizando(false);
    }
  }

  async function adicionarFotos() {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Você pode adicionar no máximo ${MAX_FOTOS} arquivos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const novas = result.assets.map((a) => a.uri);
      setFotos((prev) => [...prev, ...novas].slice(0, MAX_FOTOS));
    }
  }

  function removerFoto(uri: string) {
    setFotos((prev) => prev.filter((f) => f !== uri));
  }

  async function handleEnviar() {
    if (!tipoSelecionado) {
      setErrorMsg('Selecione o tipo de problema.');
      return;
    }
    if (!descricao.trim()) {
      setErrorMsg('Preencha a descrição do problema.');
      return;
    }
    setErrorMsg('');
    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setErrorMsg('Usuário não autenticado.');
        return;
      }
      const tipo = TIPOS_PROBLEMA.find((t) => t.id === tipoSelecionado);
      const descFinal = observacoes.trim()
        ? `${descricao.trim()}\n\nObservações: ${observacoes.trim()}`
        : descricao.trim();

      // Busca areaChave do perfil do usuário para o filtro do painel comunitário
      let userAreaChave: string | undefined;
      let userCidade = cidade ?? undefined;
      try {
        const userSnap = await getDoc(doc(db, 'usuarios', userId));
        if (userSnap.exists()) {
          const ud = userSnap.data();
          userAreaChave = ud.areaChave ?? undefined;
          if (!userCidade) userCidade = ud.cidade ?? undefined;
        }
      } catch { /* não bloqueia o envio */ }

      await createComplaint({
        usuarioId: userId,
        titulo: tipo?.label ?? 'Denúncia',
        descricao: descFinal,
        tipoProblema: tipoSelecionado,
        cidade: userCidade,
        estado: 'PE',
        areaChave: userAreaChave,
      });

      setSuccessVisible(true);
    } catch (e) {
      console.error('Erro ao enviar denúncia:', e);
      setErrorMsg('Erro ao enviar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const RECIFE_DEFAULT = { latitude: -8.0476, longitude: -34.877, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={s.root}>
        {/* HEADER */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={s.headerContent}>
              <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>

              <View style={s.headerText}>
                <Text style={[s.headerTitle, { fontFamily: Q }]}>Fazer denúncia</Text>
                <Text style={[s.headerSubtitle, { fontFamily: Q }]}>
                  Reporte problemas ambientais e{'\n'}ajude a proteger nossa região.
                </Text>
              </View>

              <View style={s.logoCircle}>
                <MaterialCommunityIcons name="water-alert" size={26} color="#fff" />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* BODY */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errorMsg ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#c62828" style={{ marginRight: 6 }} />
              <Text style={[s.errorText, { fontFamily: Q }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* ── SEÇÃO 1: Sobre o problema ── */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>1. Sobre o problema</Text>

          <View style={s.card}>
            <Text style={[s.fieldLabel, { fontFamily: Q }]}>Tipo de problema</Text>

            <View style={s.tipoGrid}>
              {TIPOS_PROBLEMA.map((tipo) => {
                const ativo = tipoSelecionado === tipo.id;
                return (
                  <TouchableOpacity
                    key={tipo.id}
                    style={[s.tipoCard, ativo && { borderColor: ACCENT_ORANGE, borderWidth: 2 }]}
                    onPress={() => setTipoSelecionado(tipo.id)}
                    activeOpacity={0.75}
                  >
                    {ativo && (
                      <View style={s.tipoCheck}>
                        <Ionicons name="checkmark-circle" size={18} color={ACCENT_ORANGE} />
                      </View>
                    )}
                    <ProblemaIcon item={tipo} size={30} />
                    <Text style={[s.tipoLabel, { fontFamily: Q }]} numberOfLines={2}>
                      {tipo.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.card}>
            <Text style={[s.fieldLabel, { fontFamily: Q }]}>Descrição do problema</Text>
            <TextInput
              style={[s.textarea, { fontFamily: Q }]}
              placeholder="Descreva o que está acontecendo, onde acontece e outras informações importantes..."
              placeholderTextColor={TEXT_MUTED}
              value={descricao}
              onChangeText={(t) => setDescricao(t.slice(0, MAX_DESC))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[s.counter, { fontFamily: Q }]}>{descricao.length}/{MAX_DESC}</Text>
          </View>

          {/* ── SEÇÃO 2: Localização ── */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>2. Localização do problema</Text>

          <View style={s.card}>
            <Text style={[s.fieldLabel, { fontFamily: Q }]}>Localização atual</Text>
            <View style={s.locRow}>
              <View style={s.locInfo}>
                <Ionicons name="location-outline" size={18} color={TEAL_MID} style={{ marginRight: 8 }} />
                <View>
                  <Text style={[s.locCidade, { fontFamily: Q }]}>
                    {cidade ?? 'Não definida'}
                  </Text>
                  {precisao != null && (
                    <Text style={[s.locPrecisao, { fontFamily: Q }]}>Precisão: {precisao} metros</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={s.locBtn} onPress={usarLocalizacaoAtual} activeOpacity={0.8} disabled={localizando}>
                {localizando
                  ? <ActivityIndicator size="small" color={TEAL_MID} />
                  : <>
                      <Ionicons name="locate-outline" size={14} color={TEAL_MID} style={{ marginRight: 4 }} />
                      <Text style={[s.locBtnText, { fontFamily: Q }]}>Usar minha localização</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            <Text style={[s.fieldLabel, { fontFamily: Q, marginTop: 16 }]}>Ou marque no mapa</Text>

            <View style={s.mapPreview}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_GOOGLE}
                region={mapCoords ? { ...mapCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 } : RECIFE_DEFAULT}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
              >
                {mapCoords && <Marker coordinate={mapCoords} />}
              </MapView>
            </View>

            <TouchableOpacity style={s.abrirMapaBtn} onPress={() => setMapModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="map-outline" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
              <Text style={[s.abrirMapaBtnText, { fontFamily: Q }]}>Abrir mapa</Text>
            </TouchableOpacity>
          </View>

          {/* ── SEÇÃO 3: Fotos ── */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>3. Fotos ou vídeos <Text style={s.optional}>(opcional)</Text></Text>
          <Text style={[s.sectionSub, { fontFamily: Q }]}>Registre imagens que ajudem na identificação e na análise do problema.</Text>

          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fotosRow}>
              {/* Botão adicionar */}
              <TouchableOpacity style={s.addFotoBtn} onPress={adicionarFotos} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={28} color={TEXT_MUTED} />
                <Text style={[s.addFotoText, { fontFamily: Q }]}>Adicionar fotos{'\n'}ou vídeos</Text>
                <Text style={[s.addFotoSub, { fontFamily: Q }]}>Até {MAX_FOTOS} arquivos</Text>
              </TouchableOpacity>

              {fotos.map((uri) => (
                <View key={uri} style={s.fotThumb}>
                  <Image source={{ uri }} style={s.fotImg} />
                  <TouchableOpacity style={s.fotRemove} onPress={() => removerFoto(uri)}>
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── SEÇÕES 4 e 5 lado a lado ── */}
          <View style={s.row45}>
            {/* Seção 4 */}
            <View style={[s.card, s.card45]}>
              <Text style={[s.sectionHeader45, { fontFamily: Q }]}>4. Quando aconteceu? <Text style={s.optional}>(opcional)</Text></Text>
              <Text style={[s.fieldLabel, { fontFamily: Q }]}>Data</Text>
              <View style={s.dtField}>
                <Ionicons name="calendar-outline" size={14} color={TEXT_MUTED} style={{ marginRight: 6 }} />
                <TextInput
                  style={[s.dtInput, { fontFamily: Q }]}
                  value={data}
                  onChangeText={setData}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <Text style={[s.fieldLabel, { fontFamily: Q, marginTop: 10 }]}>Hora</Text>
              <View style={s.dtField}>
                <Ionicons name="time-outline" size={14} color={TEXT_MUTED} style={{ marginRight: 6 }} />
                <TextInput
                  style={[s.dtInput, { fontFamily: Q }]}
                  value={hora}
                  onChangeText={setHora}
                  placeholder="HH:MM"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Seção 5 */}
            <View style={[s.card, s.card45]}>
              <Text style={[s.sectionHeader45, { fontFamily: Q }]}>5. Observações adicionais <Text style={s.optional}>(opcional)</Text></Text>
              <Text style={[s.fieldLabel, { fontFamily: Q }]}>Alguma informação que possa ajudar?</Text>
              <TextInput
                style={[s.textarea45, { fontFamily: Q }]}
                placeholder="Ex.: frequência do problema, impacto na região, outras observações..."
                placeholderTextColor={TEXT_MUTED}
                value={observacoes}
                onChangeText={(t) => setObservacoes(t.slice(0, MAX_OBS))}
                multiline
                textAlignVertical="top"
              />
              <Text style={[s.counter, { fontFamily: Q }]}>{observacoes.length}/{MAX_OBS}</Text>
            </View>
          </View>

          {/* AVISO */}
          <View style={s.notice}>
            <Ionicons name="shield-checkmark-outline" size={20} color={PRIMARY} style={{ marginRight: 10 }} />
            <Text style={[s.noticeText, { fontFamily: Q }]}>
              Sua denúncia será analisada pela equipe técnica e você poderá acompanhar o andamento.
            </Text>
          </View>

          {/* BOTÃO ENVIAR */}
          <TouchableOpacity style={s.submitBtn} onPress={handleEnviar} activeOpacity={0.85} disabled={saving}>
            <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGradient}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={[s.submitText, { fontFamily: Q }]}>Enviar denúncia</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* MODAL: MAPA */}
      <Modal visible={mapModalVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapCoords ? { ...mapCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 } : RECIFE_DEFAULT}
            onPress={(e) => setMapCoords(e.nativeEvent.coordinate)}
          >
            {mapCoords && <Marker coordinate={mapCoords} />}
          </MapView>
          <SafeAreaView edges={['bottom']} style={s.mapModalFooter}>
            <TouchableOpacity
              style={s.mapConfirmBtn}
              onPress={() => {
                if (mapCoords) setCoords({ lat: mapCoords.latitude, lng: mapCoords.longitude });
                setMapModalVisible(false);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.mapConfirmGradient}>
                <Text style={[s.mapConfirmText, { fontFamily: Q }]}>Confirmar localização</Text>
              </LinearGradient>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: SUCESSO */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIconCircle}>
              <Ionicons name="checkmark-circle" size={44} color={PRIMARY} />
            </View>
            <Text style={[s.successTitle, { fontFamily: Q }]}>Denúncia enviada!</Text>
            <View style={s.successDivider} />
            <Text style={[s.successBody, { fontFamily: Q }]}>
              Sua denúncia foi registrada com sucesso e será analisada pela equipe técnica.
            </Text>
            <TouchableOpacity
              style={s.successBtn}
              onPress={() => router.replace('/(tabs)' as any)}
              activeOpacity={0.85}
            >
              <Text style={[s.successBtnText, { fontFamily: Q }]}>Voltar para a Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const CARD_GAP = 10;
const CARD45_W = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  // Header
  header: { paddingBottom: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 18 },
  logoCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: '#c62828', fontSize: 13 },

  // Section headers
  sectionHeader: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginBottom: 10, marginTop: 6 },
  sectionSub: { fontSize: 12, color: TEXT_MUTED, marginBottom: 10, marginTop: -6 },
  optional: { fontSize: 13, fontWeight: '400', color: TEXT_MUTED },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  fieldLabel: { fontSize: 13, color: TEXT_MUTED, marginBottom: 10 },

  // Tipo grid
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoCard: {
    width: (SCREEN_WIDTH - 32 - 32 - 24) / 4,
    aspectRatio: 0.9,
    backgroundColor: SURFACE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  tipoCheck: { position: 'absolute', top: 4, right: 4 },
  tipoLabel: { fontSize: 10, color: '#444', textAlign: 'center', marginTop: 6, lineHeight: 13 },

  // Textarea
  textarea: { backgroundColor: SURFACE, borderRadius: 10, padding: 12, fontSize: 13, color: '#333', minHeight: 90, borderWidth: 1, borderColor: BORDER_LIGHT },
  counter: { fontSize: 11, color: TEXT_MUTED, textAlign: 'right', marginTop: 4 },

  // Localização
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  locInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locCidade: { fontSize: 14, color: '#333', fontWeight: '600' },
  locPrecisao: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  locBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: TEAL_MID, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  locBtnText: { fontSize: 11, color: TEAL_MID, fontWeight: '600' },

  // Mapa
  mapPreview: { height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: BORDER_LIGHT },
  abrirMapaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: BORDER_LIGHT, borderRadius: 10, paddingVertical: 12 },
  abrirMapaBtnText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },

  // Fotos
  fotosRow: { gap: 10, paddingBottom: 4 },
  addFotoBtn: { width: 110, height: 110, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER_LIGHT, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE, padding: 8 },
  addFotoText: { fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 6 },
  addFotoSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  fotThumb: { width: 110, height: 110, borderRadius: 12, overflow: 'visible' },
  fotImg: { width: 110, height: 110, borderRadius: 12 },
  fotRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },

  // Seções 4 e 5
  row45: { flexDirection: 'row', gap: CARD_GAP, marginBottom: 0 },
  card45: { width: CARD45_W, marginBottom: 14 },
  sectionHeader45: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 10 },
  dtField: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: BORDER_LIGHT },
  dtInput: { flex: 1, fontSize: 13, color: '#333' },
  textarea45: { backgroundColor: SURFACE, borderRadius: 10, padding: 10, fontSize: 12, color: '#333', flex: 1, minHeight: 80, borderWidth: 1, borderColor: BORDER_LIGHT },

  // Notice
  notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 12, color: '#2e7d32', lineHeight: 18 },

  // Submit
  submitBtn: { borderRadius: 50, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  submitText: { fontSize: 16, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },

  // Mapa modal
  mapModalFooter: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#fff' },
  mapConfirmBtn: { borderRadius: 50, overflow: 'hidden' },
  mapConfirmGradient: { paddingVertical: 14, alignItems: 'center' },
  mapConfirmText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Sucesso modal
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center' },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(63,243,231,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 14 },
  successDivider: { height: 1, backgroundColor: BORDER_LIGHT, width: '100%', marginBottom: 14 },
  successBody: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBtn: { width: '100%', backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  successBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
});
