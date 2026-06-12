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
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { createComplaint } from '@/services/firestore/complaints';
import { uploadMultiplasImagens, ResultadoUpload } from '@/services/storage/supabaseStorage';

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

interface CorpoHidrico {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
  areaChave?: string;
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

  const [corposHidricos, setCorposHidricos] = useState<CorpoHidrico[]>([]);
  const [corpoSelecionado, setCorpoSelecionado] = useState<CorpoHidrico | null>(null);
  const [buscaCorpo, setBuscaCorpo] = useState('');
  const [corpoModalVisible, setCorpoModalVisible] = useState(false);
  const [loadingCorpos, setLoadingCorpos] = useState(false);
  const [naoEncontrouCorpo, setNaoEncontrouCorpo] = useState(false);

  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');

  const [localizando, setLocalizando] = useState(false);
  const [cidade, setCidade] = useState<string | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [fotoModalVisible, setFotoModalVisible] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);

  const now = new Date();
  const [data, setData] = useState(formatDate(now));
  const [hora, setHora] = useState(formatTime(now));
  const [observacoes, setObservacoes] = useState('');

  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const fetchCorpos = async () => {
      setLoadingCorpos(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'corposHidricos'), orderBy('nome'))
        );
        const lista: CorpoHidrico[] = snap.docs.map((d) => ({
          id: d.id,
          nome: d.data().nome ?? '',
          cidade: d.data().cidade ?? '',
          estado: d.data().estado ?? '',
          areaChave: d.data().areaChave ?? '',
        }));
        setCorposHidricos(lista);
      } catch (e) {
        console.error('[Denuncia] Erro ao buscar corpos hídricos:', e);
      } finally {
        setLoadingCorpos(false);
      }
    };
    fetchCorpos();
  }, []);

  const corposFiltrados = corposHidricos.filter((c) =>
    c.nome.toLowerCase().includes(buscaCorpo.toLowerCase()) ||
    (c.cidade ?? '').toLowerCase().includes(buscaCorpo.toLowerCase())
  );

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

  // ===================== FUNÇÕES DE FOTO (CORRIGIDAS) =====================
  async function abrirCamera() {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Você pode adicionar no máximo ${MAX_FOTOS} fotos.`);
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative o acesso à câmera nas configurações do dispositivo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_FOTOS));
      }
      setFotoModalVisible(false);
    } catch (e) {
      console.error('[Denuncia] Erro ao abrir câmera:', e);
      Alert.alert('Erro', 'Não foi possível abrir a câmera. Tente novamente.');
    }
  }

  async function abrirGaleria() {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Você pode adicionar no máximo ${MAX_FOTOS} fotos.`);
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative o acesso à galeria nas configurações do dispositivo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets) {
        const novas = result.assets.map((a) => a.uri);
        setFotos((prev) => [...prev, ...novas].slice(0, MAX_FOTOS));
      }
      setFotoModalVisible(false);
    } catch (e) {
      console.error('[Denuncia] Erro ao abrir galeria:', e);
      Alert.alert('Erro', 'Não foi possível abrir a galeria. Tente novamente.');
    }
  }
  // =========================================================================

  function removerFoto(uri: string) {
    setFotos((prev) => prev.filter((f) => f !== uri));
  }

  async function handleEnviar() {
    if (!corpoSelecionado) {
      setErrorMsg('Selecione o corpo hídrico relacionado à denúncia.');
      return;
    }
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

      const docId = await createComplaint({
        usuarioId: userId,
        titulo: tipo?.label ?? 'Denúncia',
        descricao: descFinal,
        tipoProblema: tipoSelecionado,
        cidade: corpoSelecionado.cidade,
        estado: corpoSelecionado.estado ?? 'PE',
        areaChave: corpoSelecionado.areaChave,
        corpoHidricoId: corpoSelecionado.id,
        corpoHidricoNome: corpoSelecionado.nome,
        coordenadas: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      });

      if (corpoSelecionado.areaChave) {
        await updateDoc(doc(db, 'usuarios', userId), {
          areaChave: corpoSelecionado.areaChave,
          ultimoCorpoHidricoAcessadoId: corpoSelecionado.id,
        });
      }

      if (fotos.length > 0 && docId) {
        const imagensMetadados: ResultadoUpload[] = await uploadMultiplasImagens(fotos, docId);
        await updateDoc(doc(db, 'denuncias', docId), {
          imagens: imagensMetadados,
        });
      }

      setSuccessVisible(true);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao enviar. Tente novamente.');
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
        {/* Header */}
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
                <Image
                  source={require('../assets/images/aquasense.png')}
                  style={s.logoHeader}
                  resizeMode="contain"
                />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Body */}
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

          {/* 1. Corpo Hidrico */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>1. Corpo hídrico relacionado</Text>

          <View style={s.card}>
            <Text style={[s.fieldLabel, { fontFamily: Q }]}>Selecione o corpo hídrico afetado</Text>

            {corpoSelecionado ? (
              <View style={s.corpoSelecionadoBox}>
                <View style={s.corpoSelecionadoInfo}>
                  <View style={s.corpoIconCircle}>
                    <Ionicons name="water" size={16} color={TEAL_MID} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.corpoNome, { fontFamily: Q }]}>{corpoSelecionado.nome}</Text>
                    {corpoSelecionado.cidade ? (
                      <Text style={[s.corpoLoc, { fontFamily: Q }]}>
                        <Ionicons name="location-outline" size={11} color={TEXT_MUTED} /> {corpoSelecionado.cidade}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setCorpoSelecionado(null); setNaoEncontrouCorpo(false); }} style={s.corpoChangeBtn}>
                  <Text style={[s.corpoChangeBtnText, { fontFamily: Q }]}>Alterar</Text>
                </TouchableOpacity>
              </View>
            ) : naoEncontrouCorpo ? (
              <View style={s.naoEncontrouBox}>
                <Ionicons name="information-circle-outline" size={20} color={PRIMARY} style={{ marginBottom: 8 }} />
                <Text style={[s.naoEncontrouText, { fontFamily: Q }]}>
                  Antes de registrar uma denúncia, é necessário cadastrar o corpo hídrico no sistema.
                </Text>
                <TouchableOpacity
                  style={s.cadastrarBtn}
                  onPress={() => router.push('../../manage_water_bodies_collaborator' as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cadastrarGradient}>
                    <Ionicons name="add-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={[s.cadastrarBtnText, { fontFamily: Q }]}>Cadastrar corpo hídrico</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNaoEncontrouCorpo(false)} style={{ marginTop: 8 }}>
                  <Text style={[{ fontSize: 13, color: TEAL_MID, fontFamily: Q }]}>← Voltar à busca</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={s.selecionarCorpoBtn}
                  onPress={() => setCorpoModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="water-outline" size={18} color={TEAL_MID} style={{ marginRight: 8 }} />
                  <Text style={[s.selecionarCorpoBtnText, { fontFamily: Q }]}>Selecionar corpo hídrico</Text>
                  <Ionicons name="chevron-down" size={16} color={TEXT_MUTED} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.naoEncontrouBtn}
                  onPress={() => setNaoEncontrouCorpo(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="help-circle-outline" size={14} color={TEXT_MUTED} style={{ marginRight: 4 }} />
                  <Text style={[s.naoEncontrouBtnText, { fontFamily: Q }]}>Não encontrei o corpo hídrico</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 2. Sobre o problema */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>2. Sobre o problema</Text>

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

          {/* 3. Localização */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>3. Localização do problema</Text>

          <View style={s.card}>
            <Text style={[s.fieldLabel, { fontFamily: Q }]}>Localização atual</Text>
            <View style={s.locRow}>
              <View style={s.locInfo}>
                <Ionicons name="location-outline" size={18} color={TEAL_MID} style={{ marginRight: 8 }} />
                <View>
                  <Text style={[s.locCidade, { fontFamily: Q }]}>
                    {cidade ?? (corpoSelecionado?.cidade ?? 'Não definida')}
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

          {/* 4. Fotos */}
          <Text style={[s.sectionHeader, { fontFamily: Q }]}>4. Fotos <Text style={s.optional}>(opcional)</Text></Text>
          <Text style={[s.sectionSub, { fontFamily: Q }]}>Registre imagens que ajudem na identificação e análise do problema.</Text>

          <View style={s.card}>
            <TouchableOpacity
              style={s.addFotoRowBtn}
              onPress={() => {
                if (fotos.length >= MAX_FOTOS) {
                  Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos.`);
                  return;
                }
                setFotoModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={s.addFotoIconCircle}>
                <Ionicons name="camera-outline" size={22} color={TEAL_MID} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.addFotoRowLabel, { fontFamily: Q }]}>Fotos <Text style={s.optional}>(opcional)</Text></Text>
                <Text style={[s.addFotoRowSub, { fontFamily: Q }]}>{fotos.length}/{MAX_FOTOS} foto(s) adicionada(s)</Text>
              </View>
              <View style={s.addFotoPlus}>
                <Ionicons name="add" size={20} color={TEXT_MUTED} />
              </View>
            </TouchableOpacity>

            {fotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fotosRow} style={{ marginTop: 12 }}>
                {fotos.map((uri) => (
                  <View key={uri} style={s.fotThumb}>
                    <Image source={{ uri }} style={s.fotImg} />
                    <TouchableOpacity style={s.fotRemove} onPress={() => removerFoto(uri)}>
                      <Ionicons name="close-circle" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Seções 5 e 6 */}
          <View style={s.row45}>
            <View style={[s.card, s.card45]}>
              <Text style={[s.sectionHeader45, { fontFamily: Q }]}>5. Quando aconteceu? <Text style={s.optional}>(opcional)</Text></Text>
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

            <View style={[s.card, s.card45]}>
              <Text style={[s.sectionHeader45, { fontFamily: Q }]}>6. Observações <Text style={s.optional}>(opcional)</Text></Text>
              <Text style={[s.fieldLabel, { fontFamily: Q }]}>Alguma informação que possa ajudar?</Text>
              <TextInput
                style={[s.textarea45, { fontFamily: Q }]}
                placeholder="Ex.: frequência do problema, impacto na região..."
                placeholderTextColor={TEXT_MUTED}
                value={observacoes}
                onChangeText={(t) => setObservacoes(t.slice(0, MAX_OBS))}
                multiline
                textAlignVertical="top"
              />
              <Text style={[s.counter, { fontFamily: Q }]}>{observacoes.length}/{MAX_OBS}</Text>
            </View>
          </View>

          <View style={s.notice}>
            <Ionicons name="shield-checkmark-outline" size={20} color={PRIMARY} style={{ marginRight: 10 }} />
            <Text style={[s.noticeText, { fontFamily: Q }]}>
              Sua denúncia será analisada pela equipe técnica e você poderá acompanhar o andamento.
            </Text>
          </View>

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

      {/* MODAL: Corpo Hídrico */}
      <Modal visible={corpoModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.corpoModal}>
            <View style={s.corpoModalHeader}>
              <Text style={[s.corpoModalTitle, { fontFamily: Q }]}>Corpo hídrico</Text>
              <TouchableOpacity onPress={() => setCorpoModalVisible(false)} style={s.corpoModalClose}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={s.buscaRow}>
              <Ionicons name="search-outline" size={16} color={TEXT_MUTED} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.buscaInput, { fontFamily: Q }]}
                placeholder="Buscar por nome ou cidade..."
                placeholderTextColor={TEXT_MUTED}
                value={buscaCorpo}
                onChangeText={setBuscaCorpo}
                autoFocus
              />
            </View>

            {loadingCorpos ? (
              <ActivityIndicator color={TEAL_MID} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={corposFiltrados}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 340 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: BORDER_LIGHT }} />}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Ionicons name="water-outline" size={28} color={TEXT_MUTED} />
                    <Text style={[{ fontSize: 13, color: TEXT_MUTED, marginTop: 8, fontFamily: Q }]}>
                      Nenhum corpo hídrico encontrado.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.corpoItem}
                    onPress={() => {
                      setCorpoSelecionado(item);
                      setCorpoModalVisible(false);
                      setBuscaCorpo('');
                      if (item.cidade && !cidade) setCidade(item.cidade);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={s.corpoItemIconCircle}>
                      <Ionicons name="water" size={14} color={TEAL_MID} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.corpoItemNome, { fontFamily: Q }]}>{item.nome}</Text>
                      {item.cidade ? (
                        <Text style={[s.corpoItemCidade, { fontFamily: Q }]}>{item.cidade}{item.estado ? `, ${item.estado}` : ''}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#ccc" />
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={s.naoEncontrouModalBtn}
              onPress={() => {
                setCorpoModalVisible(false);
                setNaoEncontrouCorpo(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="help-circle-outline" size={15} color={TEXT_MUTED} style={{ marginRight: 6 }} />
              <Text style={[s.naoEncontrouModalBtnText, { fontFamily: Q }]}>Não encontrei o corpo hídrico</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Adicionar foto */}
      <Modal visible={fotoModalVisible} transparent animationType="slide">
        <View style={s.fotoOverlay}>
          <View style={s.fotoSheet}>
            <Text style={[s.fotoSheetTitle, { fontFamily: Q }]}>Adicionar foto</Text>

            <TouchableOpacity style={s.fotoSheetBtn} onPress={abrirCamera} activeOpacity={0.85}>
              <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fotoSheetGradient}>
                <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[s.fotoSheetBtnText, { fontFamily: Q }]}>Câmera</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.fotoSheetBtn} onPress={abrirGaleria} activeOpacity={0.85}>
              <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fotoSheetGradient}>
                <Ionicons name="images-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[s.fotoSheetBtnText, { fontFamily: Q }]}>Galeria</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.fotoSheetCancelar} onPress={() => setFotoModalVisible(false)} activeOpacity={0.7}>
              <Text style={[s.fotoSheetCancelarText, { fontFamily: Q }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  header: { paddingBottom: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 18 },
  logoCircle: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  logoHeader: { width: 44, height: 44 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: '#c62828', fontSize: 13 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginBottom: 10, marginTop: 6 },
  sectionSub: { fontSize: 12, color: TEXT_MUTED, marginBottom: 10, marginTop: -6 },
  optional: { fontSize: 13, fontWeight: '400', color: TEXT_MUTED },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  fieldLabel: { fontSize: 13, color: TEXT_MUTED, marginBottom: 10 },
  selecionarCorpoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER_LIGHT },
  selecionarCorpoBtnText: { fontSize: 14, color: '#333' },
  naoEncontrouBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'center' },
  naoEncontrouBtnText: { fontSize: 12, color: TEXT_MUTED },
  corpoSelecionadoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#c8e6c9' },
  corpoSelecionadoInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  corpoIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e0f4ee', alignItems: 'center', justifyContent: 'center' },
  corpoNome: { fontSize: 14, fontWeight: '700', color: '#1a2e26' },
  corpoLoc: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  corpoChangeBtn: { borderWidth: 1, borderColor: TEAL_MID, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  corpoChangeBtnText: { fontSize: 12, color: TEAL_MID, fontWeight: '600' },
  naoEncontrouBox: { alignItems: 'center', padding: 8 },
  naoEncontrouText: { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  cadastrarBtn: { borderRadius: 50, overflow: 'hidden', width: '100%' },
  cadastrarGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  cadastrarBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  corpoModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  corpoModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  corpoModalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: PRIMARY },
  corpoModalClose: { padding: 4 },
  buscaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER_LIGHT, marginBottom: 12 },
  buscaInput: { flex: 1, fontSize: 14, color: '#333' },
  corpoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 10 },
  corpoItemIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0f4ee', alignItems: 'center', justifyContent: 'center' },
  corpoItemNome: { fontSize: 14, fontWeight: '600', color: '#1a2e26' },
  corpoItemCidade: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  naoEncontrouModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER_LIGHT },
  naoEncontrouModalBtnText: { fontSize: 13, color: TEXT_MUTED },
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
  textarea: { backgroundColor: SURFACE, borderRadius: 10, padding: 12, fontSize: 13, color: '#333', minHeight: 90, borderWidth: 1, borderColor: BORDER_LIGHT },
  counter: { fontSize: 11, color: TEXT_MUTED, textAlign: 'right', marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  locInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locCidade: { fontSize: 14, color: '#333', fontWeight: '600' },
  locPrecisao: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  locBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: TEAL_MID, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  locBtnText: { fontSize: 11, color: TEAL_MID, fontWeight: '600' },
  mapPreview: { height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: BORDER_LIGHT },
  abrirMapaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: BORDER_LIGHT, borderRadius: 10, paddingVertical: 12 },
  abrirMapaBtnText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  addFotoRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER_LIGHT },
  addFotoIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e0f4ee', alignItems: 'center', justifyContent: 'center' },
  addFotoRowLabel: { fontSize: 14, color: '#333', fontWeight: '600' },
  addFotoRowSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  addFotoPlus: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER_LIGHT, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  fotosRow: { gap: 10, paddingBottom: 4 },
  fotThumb: { width: 90, height: 90, borderRadius: 12, overflow: 'visible' },
  fotImg: { width: 90, height: 90, borderRadius: 12 },
  fotRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  fotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  fotoSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  fotoSheetTitle: { fontSize: 18, fontWeight: '700', color: '#1a2e26', marginBottom: 16, textAlign: 'center' },
  fotoSheetBtn: { borderRadius: 50, overflow: 'hidden', marginBottom: 10 },
  fotoSheetGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  fotoSheetBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  fotoSheetCancelar: { alignItems: 'center', paddingVertical: 14 },
  fotoSheetCancelarText: { fontSize: 15, color: TEXT_MUTED },
  row45: { flexDirection: 'row', gap: CARD_GAP, marginBottom: 0 },
  card45: { width: CARD45_W, marginBottom: 14 },
  sectionHeader45: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 10 },
  dtField: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: BORDER_LIGHT },
  dtInput: { flex: 1, fontSize: 13, color: '#333' },
  textarea45: { backgroundColor: SURFACE, borderRadius: 10, padding: 10, fontSize: 12, color: '#333', flex: 1, minHeight: 80, borderWidth: 1, borderColor: BORDER_LIGHT },
  notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 12, color: '#2e7d32', lineHeight: 18 },
  submitBtn: { borderRadius: 50, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  submitText: { fontSize: 16, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
  mapModalFooter: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#fff' },
  mapConfirmBtn: { borderRadius: 50, overflow: 'hidden' },
  mapConfirmGradient: { paddingVertical: 14, alignItems: 'center' },
  mapConfirmText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center' },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(63,243,231,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 14 },
  successDivider: { height: 1, backgroundColor: BORDER_LIGHT, width: '100%', marginBottom: 14 },
  successBody: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBtn: { width: '100%', backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  successBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
});