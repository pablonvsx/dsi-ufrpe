import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/auth-context';

// ── Design tokens ──────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#0a6b5e';
const TEAL_LIGHT   = 'rgba(63,243,231,0.13)';
const TEAL_BORDER  = 'rgba(63,243,231,0.35)';
const TEXT_DARK    = '#1a1a1a';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#FFFFFF';
const BG           = '#f4f7f6';
const BORDER       = '#e4ecea';
const STEP_BG      = PRIMARY;

// ── Tipos de corpo hídrico ─────────────────────────────────
type TipoCorpo = 'Rio' | 'Canal' | 'Lago' | 'Açude' | 'Outro';

interface TipoOption {
  label: TipoCorpo;
  icon: React.ReactNode;
}

const TIPO_OPTIONS: TipoOption[] = [
  {
    label: 'Rio',
    icon: <MaterialCommunityIcons name="waves" size={28} color={PRIMARY} />,
  },
  {
    label: 'Canal',
    icon: <MaterialCommunityIcons name="ferry" size={28} color={PRIMARY} />,
  },
  {
    label: 'Lago',
    icon: <MaterialCommunityIcons name="anchor" size={28} color={PRIMARY} />,
  },
  {
    label: 'Açude',
    icon: <MaterialCommunityIcons name="domain" size={28} color={PRIMARY} />,
  },
  {
    label: 'Outro',
    icon: <MaterialCommunityIcons name="dots-horizontal" size={28} color={PRIMARY} />,
  },
];

// ── Cabeçalho de etapa ─────────────────────────────────────
interface StepHeaderProps {
  number: number;
  title: string;
  optional?: boolean;
  fontFamily?: string;
}

const StepHeader = ({ number, title, optional, fontFamily }: StepHeaderProps) => (
  <View style={styles.stepHeader}>
    <View style={styles.stepBadge}>
      <Text style={[styles.stepNumber, { fontFamily }]}>{number}</Text>
    </View>
    <Text style={[styles.stepTitle, { fontFamily }]}>{title}</Text>
    {optional && (
      <Text style={[styles.stepOptional, { fontFamily }]}> (opcional)</Text>
    )}
  </View>
);

// ── Tela principal ─────────────────────────────────────────
export default function CadastrarCorpoHidricoScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  const router = useRouter();
  const { user } = useAuth();

  // ── Formulário ─────────────────────────────────────────
  const [nome,      setNome]      = useState('');
  const [tipo,      setTipo]      = useState<TipoCorpo | null>(null);
  const [descricao, setDescricao] = useState('');
  const [fotos,     setFotos]     = useState<string[]>([]);

  // ── Localização ────────────────────────────────────────
  const [localizacao, setLocalizacao] = useState<{
    latitude: number;
    longitude: number;
    cidade?: string;
    precisao?: number;
  } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [markerCoords, setMarkerCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // ── Modal do mapa ──────────────────────────────────────
  const [mapaModalVisible, setMapaModalVisible] = useState(false);
  const [tempMarker, setTempMarker] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loadingGeocode, setLoadingGeocode] = useState(false);

  // ── Envio ──────────────────────────────────────────────
  const [enviando, setEnviando] = useState(false);

  // ── Obter localização atual ────────────────────────────
  const handleObterLocalizacao = async () => {
    setLoadingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Habilite a localização nas configurações do dispositivo.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = loc.coords;

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const cidade = address?.city ?? address?.subregion ?? 'Localização obtida';

      setLocalizacao({ latitude, longitude, cidade, precisao: Math.round(accuracy ?? 0) });
      setMarkerCoords({ latitude, longitude });
    } catch {
      Alert.alert('Erro', 'Não foi possível obter a localização. Tente novamente.');
    } finally {
      setLoadingLoc(false);
    }
  };

  // ── Abrir modal do mapa ────────────────────────────────
  const handleAbrirMapa = async () => {
    // pede permissão se ainda não tiver coords para centrar
    if (!markerCoords && !localizacao) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setTempMarker({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } catch { /* usa centro padrão */ }
      }
    } else {
      setTempMarker(markerCoords ?? { latitude: localizacao!.latitude, longitude: localizacao!.longitude });
    }
    setMapaModalVisible(true);
  };

  // ── Geocodificação reversa ao soltar o pin ─────────────
  const handleMapPress = async (coord: { latitude: number; longitude: number }) => {
    setTempMarker(coord);
    setLoadingGeocode(true);
    try {
      const [address] = await Location.reverseGeocodeAsync(coord);
      const cidade = address?.city ?? address?.subregion ?? 'Local selecionado';
      // atualiza preview de cidade imediatamente no tempMarker (guardado no confirm)
      setLocalizacao(prev => ({
        latitude:  coord.latitude,
        longitude: coord.longitude,
        cidade,
        precisao:  prev?.precisao,
      }));
    } catch { /* ignora */ } finally {
      setLoadingGeocode(false);
    }
  };

  // ── Confirmar ponto no mapa ────────────────────────────
  const handleConfirmarMapa = () => {
    if (tempMarker) {
      setMarkerCoords(tempMarker);
    }
    setMapaModalVisible(false);
  };

  // ── Fechar modal sem salvar ────────────────────────────
  const handleFecharMapa = () => {
    setTempMarker(markerCoords); // descarta alterações
    setMapaModalVisible(false);
  };

  // ── Selecionar fotos ───────────────────────────────────
  const handleAdicionarFoto = async () => {
    if (fotos.length >= 4) {
      Alert.alert('Limite atingido', 'Você pode adicionar no máximo 4 fotos.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Habilite o acesso à galeria nas configurações.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4 - fotos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const novasUris = result.assets.map(a => a.uri);
      setFotos(prev => [...prev, ...novasUris].slice(0, 4));
    }
  };

  const handleRemoverFoto = (index: number) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  // ── Validação e envio ──────────────────────────────────
  const handleEnviar = async () => {
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do corpo hídrico.');
      return;
    }
    if (!tipo) {
      Alert.alert('Campo obrigatório', 'Selecione o tipo do corpo hídrico.');
      return;
    }
    if (!localizacao && !markerCoords) {
      Alert.alert('Campo obrigatório', 'Informe a localização do corpo hídrico.');
      return;
    }

    setEnviando(true);
    try {
      const coords = markerCoords ?? localizacao;
      await addDoc(collection(db, 'corposHidricos'), {
        nome:        nome.trim(),
        tipo,
        descricao:   descricao.trim(),
        latitude:    coords?.latitude,
        longitude:   coords?.longitude,
        cidade:      localizacao?.cidade ?? '',
        fotos,
        uid:         user?.uid,
        status:      'pendente',
        criadoEm:    serverTimestamp(),
      });

      Alert.alert(
        'Enviado com sucesso!',
        'Sua solicitação será analisada pela equipe técnica antes de ser publicada.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const nomeValido = nome.trim().length > 0 && nome.trim().length <= 60;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={20} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.headerTextBlock}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                  Cadastrar novo{'\n'}corpo hídrico
                </Text>
                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Ajude a mapear e monitorar{'\n'}novos pontos da nossa região.
                </Text>
              </View>

              <View style={styles.headerLogoCircle}>
                <MaterialCommunityIcons name="water-outline" size={26} color="rgba(255,255,255,0.85)" />
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.waveWhite} />
        </LinearGradient>

        {/* ══ FORMULÁRIO ══ */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ETAPA 1: Informações básicas ── */}
          <View style={styles.card}>
            <StepHeader number={1} title="Informações básicas" fontFamily={questrial} />

            {/* Nome */}
            <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>Nome do corpo hídrico</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="water-outline" size={16} color={TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontFamily: questrial }]}
                placeholder="Ex.: Rio Maracanã, Canal do X, Lagoa Azul..."
                placeholderTextColor={TEXT_MUTED}
                value={nome}
                onChangeText={t => setNome(t.slice(0, 60))}
                maxLength={60}
              />
              <Text style={[styles.inputCount, { fontFamily: questrial }]}>
                {nome.length}/60
              </Text>
            </View>

            {/* Tipo */}
            <View style={styles.tipoRow}>
              <Text style={[styles.fieldLabel, { fontFamily: questrial }]}>Tipo de corpo hídrico</Text>
              <TouchableOpacity style={styles.infoBtn}>
                <Ionicons name="information-circle-outline" size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            <View style={styles.tipoGrid}>
              {TIPO_OPTIONS.map(opt => {
                const selected = tipo === opt.label;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.tipoCard, selected && styles.tipoCardSelected]}
                    onPress={() => setTipo(opt.label)}
                    activeOpacity={0.75}
                  >
                    {selected && (
                      <View style={styles.tipoCheckmark}>
                        <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                      </View>
                    )}
                    <View style={styles.tipoIconWrapper}>{opt.icon}</View>
                    <Text style={[styles.tipoLabel, { fontFamily: questrial }, selected && styles.tipoLabelSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── ETAPA 2: Localização ── */}
          <View style={styles.card}>
            <StepHeader number={2} title="Localização" fontFamily={questrial} />

            {/* Info */}
            <View style={styles.locInfoBox}>
              <Ionicons name="location-outline" size={18} color={PRIMARY} style={{ marginRight: 10, marginTop: 1 }} />
              <Text style={[styles.locInfoText, { fontFamily: questrial }]}>
                Use sua localização atual ou marque no mapa{'\n'}o ponto exato do corpo hídrico.
              </Text>
            </View>

            {/* Localização atual */}
            <Text style={[styles.fieldLabel, { fontFamily: questrial, marginTop: 14 }]}>
              Localização atual
            </Text>
            <TouchableOpacity
              style={styles.locRow}
              onPress={handleObterLocalizacao}
              activeOpacity={0.8}
            >
              <Ionicons name="location-outline" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                {localizacao ? (
                  <>
                    <Text style={[styles.locCidade, { fontFamily: questrial }]}>{localizacao.cidade} - PE</Text>
                    <Text style={[styles.locPrecisao, { fontFamily: questrial }]}>
                      Precisão: {localizacao.precisao} metros
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.locPlaceholder, { fontFamily: questrial }]}>
                    Toque para obter localização
                  </Text>
                )}
              </View>
              {loadingLoc ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <View style={styles.locTargetBtn}>
                  <Ionicons name="locate-outline" size={18} color={PRIMARY} />
                </View>
              )}
            </TouchableOpacity>

            {/* Mapa */}
            <Text style={[styles.fieldLabel, { fontFamily: questrial, marginTop: 16 }]}>
              Ou marque no mapa
            </Text>

            {/* Preview do ponto selecionado */}
            <View style={styles.mapPreview}>
              {markerCoords ? (
                <>
                  <View style={styles.mapPreviewPin}>
                    <Ionicons name="location" size={22} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mapPreviewCidade, { fontFamily: questrial }]}>
                      {localizacao?.cidade ?? 'Ponto selecionado'}
                    </Text>
                    <Text style={[styles.mapPreviewCoords, { fontFamily: questrial }]}>
                      {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setMarkerCoords(null); setTempMarker(null); }}>
                    <Ionicons name="close-circle-outline" size={20} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="map-outline" size={28} color={PRIMARY} style={{ marginRight: 10 }} />
                  <Text style={[styles.mapPreviewEmpty, { fontFamily: questrial }]}>
                    Nenhum ponto marcado
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.abrirMapaBtn}
              onPress={handleAbrirMapa}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={18} color={TEXT_DARK} style={{ marginRight: 8 }} />
              <Text style={[styles.abrirMapaText, { fontFamily: questrial }]}>
                {markerCoords ? 'Ajustar ponto no mapa' : 'Abrir mapa'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── ETAPA 3: Descrição ── */}
          <View style={styles.card}>
            <StepHeader number={3} title="Descrição" optional fontFamily={questrial} />
            <Text style={[styles.fieldSubtitle, { fontFamily: questrial }]}>
              Conte mais detalhes sobre o corpo hídrico
            </Text>

            <View style={styles.textareaWrapper}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color={TEXT_MUTED}
                style={styles.textareaIcon}
              />
              <TextInput
                style={[styles.textarea, { fontFamily: questrial }]}
                placeholder={'Ex.: características, tamanho aproximado,\ncondições atuais, observações...'}
                placeholderTextColor={TEXT_MUTED}
                value={descricao}
                onChangeText={t => setDescricao(t.slice(0, 300))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
              <Text style={[styles.inputCount, styles.textareaCount, { fontFamily: questrial }]}>
                {descricao.length}/300
              </Text>
            </View>
          </View>

          {/* ── ETAPA 4: Foto ── */}
          <View style={styles.card}>
            <StepHeader number={4} title="Foto" optional fontFamily={questrial} />
            <Text style={[styles.fieldSubtitle, { fontFamily: questrial }]}>
              Adicione fotos para ajudar na análise e validação.
            </Text>

            <View style={styles.fotosRow}>
              {/* Botão adicionar */}
              <TouchableOpacity
                style={styles.addFotoBtn}
                onPress={handleAdicionarFoto}
                activeOpacity={0.75}
              >
                <Ionicons name="camera-outline" size={28} color={PRIMARY} />
                <Text style={[styles.addFotoText, { fontFamily: questrial }]}>Adicionar{'\n'}foto</Text>
              </TouchableOpacity>

              {/* Miniaturas */}
              {fotos.map((uri, i) => (
                <View key={i} style={styles.fotoThumb}>
                  <Image source={{ uri }} style={styles.fotoImg} />
                  <TouchableOpacity
                    style={styles.fotoRemoveBtn}
                    onPress={() => handleRemoverFoto(i)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* ── Aviso ── */}
          <View style={styles.avisoBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY} style={{ marginRight: 10, marginTop: 1 }} />
            <Text style={[styles.avisoText, { fontFamily: questrial }]}>
              Após o envio, sua solicitação será analisada{'\n'}pela equipe técnica antes de ser publicada.
            </Text>
          </View>

          {/* ── Botão enviar ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleEnviar}
            disabled={enviando}
            style={styles.submitWrapper}
          >
            <LinearGradient
              colors={['#004d48', '#0a6b5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              {enviando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#FFF" style={{ marginRight: 10 }} />
                  <Text style={[styles.submitText, { fontFamily: questrial }]}>
                    Enviar para validação
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* ══ MODAL DO MAPA ══ */}
        <Modal
          visible={mapaModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={handleFecharMapa}
        >
          <SafeAreaView style={styles.mapModal} edges={['top', 'bottom']}>
            {/* Cabeçalho do modal */}
            <View style={styles.mapModalHeader}>
              <TouchableOpacity onPress={handleFecharMapa} style={styles.mapModalCloseBtn}>
                <Ionicons name="close" size={26} color={PRIMARY} />
              </TouchableOpacity>
              <Text style={[styles.mapModalTitle, { fontFamily: questrial }]}>
                Marcar no mapa
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Instrução */}
            <View style={styles.mapModalTip}>
              <Ionicons name="finger-print-outline" size={16} color={PRIMARY} style={{ marginRight: 8 }} />
              <Text style={[styles.mapModalTipText, { fontFamily: questrial }]}>
                Toque no mapa para marcar o ponto exato do corpo hídrico.
              </Text>
            </View>

            {/* Mapa fullscreen */}
            <View style={styles.mapFullContainer}>
              <MapView
                style={styles.mapFull}
                provider={PROVIDER_GOOGLE}
                mapType="satellite"
                initialRegion={{
                  latitude:      tempMarker?.latitude  ?? localizacao?.latitude  ?? -8.05,
                  longitude:     tempMarker?.longitude ?? localizacao?.longitude ?? -34.9,
                  latitudeDelta:  0.015,
                  longitudeDelta: 0.015,
                }}
                onPress={e => handleMapPress(e.nativeEvent.coordinate)}
              >
                {tempMarker && (
                  <Marker
                    coordinate={tempMarker}
                    pinColor={PRIMARY}
                    draggable
                    onDragEnd={e => handleMapPress(e.nativeEvent.coordinate)}
                  />
                )}
              </MapView>

              {/* Overlay de geocodificação */}
              {loadingGeocode && (
                <View style={styles.mapGeocodeOverlay}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={[styles.mapGeocodeText, { fontFamily: questrial }]}>
                    Identificando local...
                  </Text>
                </View>
              )}
            </View>

            {/* Info do ponto selecionado */}
            {tempMarker && (
              <View style={styles.mapSelectedInfo}>
                <Ionicons name="location" size={18} color={PRIMARY} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mapSelectedCidade, { fontFamily: questrial }]}>
                    {localizacao?.cidade ?? 'Local selecionado'}
                  </Text>
                  <Text style={[styles.mapSelectedCoords, { fontFamily: questrial }]}>
                    {tempMarker.latitude.toFixed(6)}, {tempMarker.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            )}

            {/* Botão confirmar */}
            <View style={styles.mapModalFooter}>
              <TouchableOpacity
                style={[styles.mapConfirmBtn, !tempMarker && styles.mapConfirmBtnDisabled]}
                onPress={handleConfirmarMapa}
                disabled={!tempMarker}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={tempMarker ? ['#004d48', '#0a6b5e'] : ['#b0c4c2', '#b0c4c2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mapConfirmGradient}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={[styles.mapConfirmText, { fontFamily: questrial }]}>
                    Confirmar ponto
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // ── Header ──
  header: { overflow: 'hidden' },
  headerSafe: { zIndex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  headerTextBlock: { flex: 1 },
  headerTitle: {
    fontSize: 24, color: '#FFF', fontWeight: '700', lineHeight: 30, letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 5, lineHeight: 19,
  },
  headerLogoCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  waveWhite: {
    height: 26, backgroundColor: BG,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  // ── Card ──
  card: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  // ── Step header ──
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: STEP_BG,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  stepNumber: { fontSize: 14, color: '#FFF', fontWeight: '700' },
  stepTitle: { fontSize: 17, fontWeight: '700', color: TEXT_DARK },
  stepOptional: { fontSize: 13, color: TEXT_MUTED, fontWeight: '400' },

  // ── Fields ──
  fieldLabel: { fontSize: 13, color: TEXT_DARK, fontWeight: '600', marginBottom: 8 },
  fieldSubtitle: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12, marginTop: -8 },

  // Input
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 13,
    backgroundColor: '#fafcfb', marginBottom: 16,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: TEXT_DARK, padding: 0 },
  inputCount: { fontSize: 11, color: TEXT_MUTED, marginLeft: 6 },

  // Tipo de corpo hídrico
  tipoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoBtn: { marginLeft: 6, padding: 2 },
  tipoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  tipoCard: {
    width: '30%', flexGrow: 1,
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fafcfb',
    position: 'relative',
  },
  tipoCardSelected: {
    borderColor: PRIMARY, backgroundColor: TEAL_LIGHT,
  },
  tipoCheckmark: {
    position: 'absolute', top: 6, right: 6,
  },
  tipoIconWrapper: { marginBottom: 6 },
  tipoLabel: { fontSize: 13, color: TEXT_MUTED, fontWeight: '600', textAlign: 'center' },
  tipoLabelSelected: { color: PRIMARY },

  // Localização
  locInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: TEAL_LIGHT, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: TEAL_BORDER,
  },
  locInfoText: { fontSize: 13, color: PRIMARY, lineHeight: 19, flex: 1 },
  locRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14,
    backgroundColor: '#fafcfb',
  },
  locCidade: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },
  locPrecisao: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  locPlaceholder: { fontSize: 14, color: TEXT_MUTED },
  locTargetBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE,
  },

  // Mapa — preview inline
  mapPreview: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14,
    backgroundColor: '#fafcfb', marginBottom: 10,
    minHeight: 54,
  },
  mapPreviewPin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  mapPreviewCidade: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },
  mapPreviewCoords: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  mapPreviewEmpty: { fontSize: 14, color: TEXT_MUTED },
  abrirMapaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 14, paddingVertical: 13,
    backgroundColor: SURFACE,
  },
  abrirMapaText: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },

  // Mapa — modal fullscreen
  mapModal: { flex: 1, backgroundColor: '#F5F9F8' },
  mapModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  mapModalCloseBtn: { width: 40, alignItems: 'flex-start' },
  mapModalTitle: { fontSize: 17, fontWeight: '700', color: PRIMARY, textAlign: 'center', flex: 1 },
  mapModalTip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TEAL_LIGHT, borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  mapModalTipText: { fontSize: 13, color: PRIMARY, flex: 1, lineHeight: 18 },
  mapFullContainer: { flex: 1, position: 'relative' },
  mapFull: { width: '100%', height: '100%' },
  mapGeocodeOverlay: {
    position: 'absolute', bottom: 16, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
    gap: 8,
  },
  mapGeocodeText: { fontSize: 13, color: PRIMARY },
  mapSelectedInfo: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: SURFACE,
  },
  mapSelectedCidade: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },
  mapSelectedCoords: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  mapModalFooter: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: BORDER,
  },
  mapConfirmBtn: { borderRadius: 14, overflow: 'hidden' },
  mapConfirmBtnDisabled: { opacity: 0.6 },
  mapConfirmGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14,
  },
  mapConfirmText: { fontSize: 16, color: '#FFF', fontWeight: '700', letterSpacing: 0.2 },

  // Textarea
  textareaWrapper: {
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 12,
    backgroundColor: '#fafcfb',
    position: 'relative',
  },
  textareaIcon: { marginBottom: 6 },
  textarea: {
    fontSize: 14, color: TEXT_DARK,
    minHeight: 90, padding: 0,
  },
  textareaCount: {
    position: 'absolute', bottom: 10, right: 12,
    marginLeft: 0,
  },

  // Fotos
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  addFotoBtn: {
    width: 90, height: 90, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed',
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  addFotoText: { fontSize: 11, color: PRIMARY, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  fotoThumb: {
    width: 90, height: 90, borderRadius: 14,
    overflow: 'visible', position: 'relative',
  },
  fotoImg: { width: 90, height: 90, borderRadius: 14 },
  fotoRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
  },

  // Aviso
  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: TEAL_LIGHT,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: TEAL_BORDER,
    marginBottom: 14,
  },
  avisoText: { fontSize: 13, color: PRIMARY, lineHeight: 19, flex: 1 },

  // Submit
  submitWrapper: {
    borderRadius: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 6,
    marginBottom: 8,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 18,
  },
  submitText: { fontSize: 16, color: '#FFF', fontWeight: '700', letterSpacing: 0.3 },
});