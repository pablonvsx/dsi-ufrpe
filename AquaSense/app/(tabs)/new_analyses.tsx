import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { auth, db } from '@/config/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  createTechnicalAnalysis,
  ParametrosAgua,
  LocalColeta,
} from '@/services/firestore/technicalAnalyses';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY    = '#1B4A42';
const TEAL_MID   = '#2A7A6A';
const SURFACE    = '#F5F9F8';
const BORDER     = '#E2E8E6';
const TEXT_MUTED = '#6B8C87';
const TEXT_MAIN  = '#1A2E2B';
const { width: SW } = Dimensions.get('window');

const MAX_FOTOS     = 5;
const MAX_OBS       = 500;
const RECIFE_REGION = {
  latitude: -8.0476, longitude: -34.877,
  latitudeDelta: 0.08, longitudeDelta: 0.08,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function hoje(): string {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function agora(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function gerarColetaId(): string {
  const d   = new Date();
  const ano = d.getFullYear();
  const mes = pad(d.getMonth() + 1);
  const dia = pad(d.getDate());
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `COL-${ano}-${mes}-${dia}-${seq}`;
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CorpoHidrico {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
  tipo?: string;
  localizacao?: string;
}

interface ParamField {
  key: keyof Omit<ParametrosAgua, never>;
  label: string;
  unit: string;
  placeholder: string;
}

const PARAM_FIELDS: ParamField[] = [
  { key: 'ph',                label: 'pH',                  unit: 'pH',   placeholder: '6,8'  },
  { key: 'oxigenioDissolvido', label: 'Oxigênio dissolvido', unit: 'mg/L', placeholder: '5,2'  },
  { key: 'dbo',               label: 'DBO',                 unit: 'mg/L', placeholder: '8,6'  },
  { key: 'nitrato',           label: 'Nitrato',             unit: 'mg/L', placeholder: '1,25' },
  { key: 'amonio',            label: 'Amônio',              unit: 'mg/L', placeholder: '0,18' },
  { key: 'nitrogenioTotal',   label: 'Nitrogênio total',    unit: 'mg/L', placeholder: '1,80' },
  { key: 'ortofosfato',       label: 'Ortofosfato',         unit: 'mg/L', placeholder: '0,32' },
  { key: 'temperatura',       label: 'Temperatura',         unit: '°C',   placeholder: '26,4' },
];

const TIPOS_CORPO = [
  { id: 'rio',      label: 'Rio',                    icon: 'water-outline'               },
  { id: 'lago',     label: 'Lago / Lagoa',            icon: 'ellipse-outline'             },
  { id: 'canal',    label: 'Canal / Drenagem urbana', icon: 'git-branch-outline'          },
  { id: 'acude',    label: 'Açude / Reservatório',    icon: 'archive-outline'             },
  { id: 'riacho',   label: 'Riacho / Córrego',        icon: 'swap-horizontal-outline'     },
  { id: 'estuario', label: 'Estuário',                icon: 'globe-outline'               },
  { id: 'outro',    label: 'Outro',                   icon: 'ellipsis-horizontal-outline' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NovaAnaliseTecnica() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const Q = fontsLoaded ? 'Questrial_400Regular' : undefined;

  // ── Coleta info ──
  const [dataColeta]    = useState(hoje());
  const [horarioColeta] = useState(agora());
  const [coletaId]      = useState(gerarColetaId());
  const [tecnicoNome, setTecnicoNome] = useState('Técnico responsável');
  const [tecnicoId,   setTecnicoId]   = useState<string | null>(null);

  // ── Corpos hídricos ──
  const [corposHidricos,    setCorposHidricos]    = useState<CorpoHidrico[]>([]);
  const [corpoSelecionado,  setCorpoSelecionado]  = useState<CorpoHidrico | null>(null);
  const [buscaCorpo,        setBuscaCorpo]        = useState('');
  const [corpoModalVisible, setCorpoModalVisible] = useState(false);
  const [loadingCorpos,     setLoadingCorpos]     = useState(false);

  // ── Localização ──
  const [localizando,      setLocalizando]      = useState(false);
  const [localColeta,      setLocalColeta]      = useState<LocalColeta | null>(null);
  const [mapModalVisible,  setMapModalVisible]  = useState(false);
  const [mapCoords,        setMapCoords]        = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  // ── Parâmetros ──
  const [paramValues,      setParamValues]      = useState<Record<string, string>>({});
  const [tipoCorpo,        setTipoCorpo]        = useState('');
  const [tipoModalVisible, setTipoModalVisible] = useState(false);

  // ── Observações ──
  const [observacoes, setObservacoes] = useState('');

  // ── Fotos ──
  const [fotos,            setFotos]            = useState<string[]>([]);
  const [fotoModalVisible, setFotoModalVisible] = useState(false);

  // ── Save state ──
  const [saving,         setSaving]         = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMsg,       setErrorMsg]       = useState('');

  // ── Load técnico logado ──
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setTecnicoId(user.uid);

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          const nome = snap.data()?.nome ?? snap.data()?.displayName ?? null;
          if (nome) setTecnicoNome(nome);
          else if (user.displayName) setTecnicoNome(user.displayName);
        } else if (user.displayName) {
          setTecnicoNome(user.displayName);
        }
      } catch (e) {
        console.error('[Analise] Erro ao buscar técnico:', e);
        if (user.displayName) setTecnicoNome(user.displayName);
      }
    })();
  }, []);

  // ── Load corpos hídricos ──
  useEffect(() => {
    (async () => {
      setLoadingCorpos(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'corposHidricos'), orderBy('nome')),
        );
        setCorposHidricos(
          snap.docs.map((d) => ({
            id:          d.id,
            nome:        d.data().nome        ?? '',
            cidade:      d.data().cidade      ?? '',
            estado:      d.data().estado      ?? '',
            tipo:        d.data().tipo        ?? '',
            localizacao: d.data().localizacao ?? d.data().areaChave ?? '',
          })),
        );
      } catch (e) {
        console.error('[Analise] Erro ao buscar corpos hídricos:', e);
      } finally {
        setLoadingCorpos(false);
      }
    })();
  }, []);

  // ── Ao selecionar corpo hídrico, preencher tipo automaticamente ──
  useEffect(() => {
    if (corpoSelecionado?.tipo) setTipoCorpo(corpoSelecionado.tipo);
  }, [corpoSelecionado]);

  // ── Filtro busca ──
  const corposFiltrados = corposHidricos.filter(
    (c) =>
      c.nome.toLowerCase().includes(buscaCorpo.toLowerCase()) ||
      (c.cidade ?? '').toLowerCase().includes(buscaCorpo.toLowerCase()),
  );

  // ─── Localização ─────────────────────────────────────────────────────────

  async function usarLocalizacaoAtual() {
    setLocalizando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative a localização nas configurações.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = pos.coords;
      setLocalColeta({
        latitude,
        longitude,
        precisao: accuracy ? Math.round(accuracy) : undefined,
        origem: 'atual',
      });
      setMapCoords({ latitude, longitude });
    } catch {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    } finally {
      setLocalizando(false);
    }
  }

  // ─── Fotos ───────────────────────────────────────────────────────────────

  async function abrirCamera() {
    if (fotos.length >= MAX_FOTOS) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative o acesso à câmera nas configurações.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        setFotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_FOTOS));
      }
    } catch (e) {
      console.error('[Analise] Câmera:', e);
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    } finally {
      setFotoModalVisible(false);
    }
  }

  async function abrirGaleria() {
    if (fotos.length >= MAX_FOTOS) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative o acesso à galeria nas configurações.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets) {
        setFotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_FOTOS));
      }
    } catch (e) {
      console.error('[Analise] Galeria:', e);
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    } finally {
      setFotoModalVisible(false);
    }
  }

  // ─── Validação ───────────────────────────────────────────────────────────

  function validar(): string | null {
    if (!corpoSelecionado)                          return 'Selecione o corpo hídrico.';
    if (!localColeta)                               return 'Informe a localização da coleta.';
    if (!paramValues['ph']?.trim())                 return 'O campo pH é obrigatório.';
    if (!paramValues['temperatura']?.trim())        return 'O campo Temperatura é obrigatório.';
    if (!paramValues['oxigenioDissolvido']?.trim()) return 'O campo Oxigênio dissolvido é obrigatório.';
    return null;
  }

  // ─── Salvar ──────────────────────────────────────────────────────────────

  async function handleSalvar() {
    const erro = validar();
    if (erro) { setErrorMsg(erro); return; }
    setErrorMsg('');
    setSaving(true);

    try {
      const parametros: ParametrosAgua = {
        ph:                 parseNum(paramValues['ph']                 ?? ''),
        oxigenioDissolvido: parseNum(paramValues['oxigenioDissolvido'] ?? ''),
        dbo:                parseNum(paramValues['dbo']                ?? ''),
        nitrato:            parseNum(paramValues['nitrato']            ?? ''),
        amonio:             parseNum(paramValues['amonio']             ?? ''),
        nitrogenioTotal:    parseNum(paramValues['nitrogenioTotal']    ?? ''),
        ortofosfato:        parseNum(paramValues['ortofosfato']        ?? ''),
        temperatura:        parseNum(paramValues['temperatura']        ?? ''),
      };

      const tipoLabel =
        TIPOS_CORPO.find((t) => t.id === tipoCorpo)?.label ?? tipoCorpo ?? '';

      await createTechnicalAnalysis(
        {
          coletaId,
          corpoHidricoId:          corpoSelecionado!.id,
          nomeCorpoHidrico:        corpoSelecionado!.nome,
          tipoCorpoHidrico:        tipoLabel,
          localizacaoCorpoHidrico: [corpoSelecionado!.cidade, corpoSelecionado!.estado]
            .filter(Boolean)
            .join(' - '),
          tecnicoId:    tecnicoId ?? '',
          tecnicoNome,
          dataColeta,
          horarioColeta,
          localColeta:  localColeta!,
          parametros,
          observacoes:  observacoes.trim(),
          status: 'analisado',
        },
        fotos,
      );

      setSuccessVisible(true);
    } catch (e: any) {
      console.error('[Analise] Salvar:', e);
      setErrorMsg(e?.message ?? 'Erro ao salvar a análise. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const tipoLabel = TIPOS_CORPO.find((t) => t.id === tipoCorpo)?.label ?? '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={s.root}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#1B4A42', '#2A6B5E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={s.headerContent}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>

              <View style={s.headerText}>
                <Text style={[s.headerTitle, { fontFamily: Q }]}>Nova análise técnica</Text>
                <Text style={[s.headerSubtitle, { fontFamily: Q }]}>
                  Registre os dados da coleta e os parâmetros da água
                </Text>
              </View>

              <View style={s.logoCircle}>
                <Image
                  source={require('@/assets/images/aquasense.png')}
                  style={s.logoImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Error banner */}
          {!!errorMsg && (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#c62828" style={{ marginRight: 6 }} />
              <Text style={[s.errorText, { fontFamily: Q }]}>{errorMsg}</Text>
            </View>
          )}

          {/* ── Seção 1: Informações da coleta ──────────────────────────── */}
          <View style={s.card}>
            <Text style={[s.cardTitle, { fontFamily: Q }]}>Informações da coleta</Text>

            <View style={s.infoGrid}>
              <InfoField icon="calendar-outline" label="Data da coleta"    value={dataColeta}    fontFamily={Q} flex={1} />
              <InfoField icon="time-outline"     label="Horário da coleta" value={horarioColeta} fontFamily={Q} flex={1} />
            </View>
            <View style={[s.infoGrid, { marginTop: 10 }]}>
              <InfoField icon="person-outline"   label="Responsável (técnico)"   value={tecnicoNome} fontFamily={Q} flex={1} />
              <InfoField icon="pricetag-outline" label="Registro / ID da coleta" value={coletaId}    fontFamily={Q} flex={1} small />
            </View>

            {/* Corpo hídrico */}
            <Text style={[s.fieldLabel, { fontFamily: Q, marginTop: 16 }]}>Corpo hídrico</Text>
            {corpoSelecionado ? (
              <View style={s.corpoBox}>
                <View style={s.corpoBoxLeft}>
                  <View style={s.corpoIconCircle}>
                    <Ionicons name="water" size={16} color={TEAL_MID} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.corpoNome, { fontFamily: Q }]}>{corpoSelecionado.nome}</Text>
                    {corpoSelecionado.cidade ? (
                      <Text style={[s.corpoLoc, { fontFamily: Q }]}>
                        {corpoSelecionado.cidade}{corpoSelecionado.estado ? ` - ${corpoSelecionado.estado}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity style={s.corpoAlterar} onPress={() => setCorpoSelecionado(null)}>
                  <Ionicons name="chevron-down" size={20} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.corpoSelect}
                onPress={() => setCorpoModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="water-outline" size={18} color={TEAL_MID} style={{ marginRight: 8 }} />
                <Text style={[s.corpoSelectText, { fontFamily: Q }]}>Selecionar corpo hídrico</Text>
                <Ionicons name="chevron-down" size={16} color={TEXT_MUTED} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {/* Local da coleta */}
            <Text style={[s.fieldLabel, { fontFamily: Q, marginTop: 16 }]}>Local da coleta</Text>

            <View style={s.locRow}>
              <TouchableOpacity
                style={[s.locBtn, localColeta?.origem === 'atual' && s.locBtnActive]}
                onPress={usarLocalizacaoAtual}
                activeOpacity={0.8}
                disabled={localizando}
              >
                <View style={[s.locIconCircle, localColeta?.origem === 'atual' && s.locIconCircleActive]}>
                  {localizando
                    ? <ActivityIndicator size="small" color={localColeta?.origem === 'atual' ? '#fff' : TEAL_MID} />
                    : <Ionicons name="locate-outline" size={20} color={localColeta?.origem === 'atual' ? '#fff' : TEAL_MID} />
                  }
                </View>
                <View style={s.locBtnTextWrap}>
                  <Text style={[s.locBtnLabel, { fontFamily: Q }, localColeta?.origem === 'atual' && s.locBtnLabelActive]}>
                    Usar localização atual
                  </Text>
                  <Text style={[s.locBtnSub, { fontFamily: Q }, localColeta?.origem === 'atual' && s.locBtnSubActive]}>
                    Capturar minha localização
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.locBtn, localColeta?.origem === 'mapa' && s.locBtnActive]}
                onPress={() => setMapModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[s.locIconCircle, localColeta?.origem === 'mapa' && s.locIconCircleActive]}>
                  <Ionicons name="map-outline" size={20} color={localColeta?.origem === 'mapa' ? '#fff' : TEAL_MID} />
                </View>
                <View style={s.locBtnTextWrap}>
                  <Text style={[s.locBtnLabel, { fontFamily: Q }, localColeta?.origem === 'mapa' && s.locBtnLabelActive]}>
                    Selecionar no mapa
                  </Text>
                  <Text style={[s.locBtnSub, { fontFamily: Q }, localColeta?.origem === 'mapa' && s.locBtnSubActive]}>
                    Escolher ponto no mapa
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {localColeta && (
              <View style={s.locCard}>
                <View style={s.locCardLeft}>
                  <Ionicons name="location-outline" size={18} color={TEAL_MID} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={[s.locCardTitle, { fontFamily: Q }]}>Localização capturada</Text>
                    <Text style={[s.locCardCoords, { fontFamily: Q }]}>
                      Lat: {localColeta.latitude.toFixed(4)}, Long: {localColeta.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
                {localColeta.precisao != null && (
                  <View style={s.locPrecisaoBox}>
                    <Ionicons name="radio-outline" size={12} color={TEAL_MID} style={{ marginRight: 3 }} />
                    <Text style={[s.locPrecisaoText, { fontFamily: Q }]}>
                      Precisão: {localColeta.precisao}m
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Seção 2: Parâmetros da água ─────────────────────────────── */}
          <View style={[s.card, { marginTop: 12 }]}>
            <Text style={[s.cardTitle, { fontFamily: Q }]}>Parâmetros da água</Text>

            <View style={s.paramGrid}>
              {PARAM_FIELDS.map((f) => (
                <View key={f.key} style={s.paramCell}>
                  <View style={s.paramLabelRow}>
                    <Text style={[s.paramLabel, { fontFamily: Q }]}>{f.label}</Text>
                    <Ionicons name="information-circle-outline" size={13} color={TEXT_MUTED} style={{ marginLeft: 3 }} />
                  </View>
                  <View style={s.paramInputWrap}>
                    <TextInput
                      style={[s.paramInput, { fontFamily: Q }]}
                      placeholder={f.placeholder}
                      placeholderTextColor={TEXT_MUTED}
                      value={paramValues[f.key] ?? ''}
                      onChangeText={(v) => setParamValues((prev) => ({ ...prev, [f.key]: v }))}
                      keyboardType="decimal-pad"
                      editable={!saving}
                    />
                    <Text style={[s.paramUnit, { fontFamily: Q }]}>{f.unit}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={[s.fieldLabel, { fontFamily: Q, marginTop: 16 }]}>Tipo de corpo hídrico</Text>
            <TouchableOpacity
              style={s.tipoSelect}
              onPress={() => setTipoModalVisible(true)}
              activeOpacity={0.8}
            >
              {tipoCorpo ? (
                <Ionicons
                  name={(TIPOS_CORPO.find((t) => t.id === tipoCorpo)?.icon ?? 'water-outline') as any}
                  size={18}
                  color={TEAL_MID}
                  style={{ marginRight: 8 }}
                />
              ) : (
                <MaterialCommunityIcons name="waves" size={18} color={TEXT_MUTED} style={{ marginRight: 8 }} />
              )}
              <Text style={[s.tipoSelectText, { fontFamily: Q }, tipoLabel ? { color: TEXT_MAIN } : {}]}>
                {tipoLabel || 'Selecionar tipo'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={TEXT_MUTED} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>

          {/* ── Seção 3: Observações ────────────────────────────────────── */}
          <View style={[s.card, { marginTop: 12 }]}>
            <Text style={[s.cardTitle, { fontFamily: Q }]}>Observações</Text>
            <TextInput
              style={[s.obsInput, { fontFamily: Q }]}
              placeholder="Adicione observações sobre o local, condições climáticas, odor, cor da água, presença de resíduos, etc."
              placeholderTextColor={TEXT_MUTED}
              value={observacoes}
              onChangeText={(t) => setObservacoes(t.slice(0, MAX_OBS))}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!saving}
            />
            <Text style={[s.obsCounter, { fontFamily: Q }]}>{observacoes.length}/{MAX_OBS}</Text>
          </View>

          {/* ── Seção 4: Fotos ──────────────────────────────────────────── */}
          <View style={[s.card, { marginTop: 12 }]}>
            <View style={s.fotoHeader}>
              <Text style={[s.cardTitle, { fontFamily: Q }]}>Fotos da coleta</Text>
              <Text style={[s.optional, { fontFamily: Q }]}>(opcional)</Text>
            </View>

            <View style={s.fotoGrid}>
              <TouchableOpacity
                style={s.fotoAdd}
                onPress={() => {
                  if (fotos.length >= MAX_FOTOS) {
                    Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos.`);
                    return;
                  }
                  setFotoModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={26} color={TEXT_MUTED} />
                <Text style={[s.fotoAddLabel, { fontFamily: Q }]}>Adicionar foto</Text>
                <Text style={[s.fotoAddSub, { fontFamily: Q }]}>Máx. {MAX_FOTOS} imagens</Text>
              </TouchableOpacity>

              {fotos.map((uri) => (
                <View key={uri} style={s.fotoThumb}>
                  <Image source={{ uri }} style={s.fotoImg} />
                  <TouchableOpacity
                    style={s.fotoRemove}
                    onPress={() => setFotos((p) => p.filter((f) => f !== uri))}
                  >
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}

              {Array.from({ length: Math.max(0, MAX_FOTOS - fotos.length - 1) }).map((_, i) => (
                <View key={`slot-${i}`} style={s.fotoSlot}>
                  <Ionicons name="image-outline" size={22} color="#D0DCDA" />
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Footer buttons ─────────────────────────────────────────────── */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btnCancelar, saving && { opacity: 0.5 }]}
            onPress={() => router.back()}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={[s.btnCancelarText, { fontFamily: Q }]}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnSalvar, saving && { opacity: 0.7 }]}
            onPress={handleSalvar}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[s.btnSalvarText, { fontFamily: Q }]}>Salvar análise</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MODAL: Corpo Hídrico ───────────────────────────────────────────── */}
      <Modal visible={corpoModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { fontFamily: Q }]}>Corpo hídrico</Text>
              <TouchableOpacity onPress={() => setCorpoModalVisible(false)} style={s.sheetClose}>
                <Ionicons name="close" size={22} color={TEXT_MAIN} />
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
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: BORDER }} />}
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
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={s.corpoItemIcon}>
                      <Ionicons name="water" size={14} color={TEAL_MID} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.corpoItemNome, { fontFamily: Q }]}>{item.nome}</Text>
                      {item.cidade ? (
                        <Text style={[s.corpoItemLoc, { fontFamily: Q }]}>
                          {item.cidade}{item.estado ? `, ${item.estado}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#ccc" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Tipo de corpo hídrico ───────────────────────────────────── */}
      <Modal visible={tipoModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { fontFamily: Q }]}>Tipo de corpo hídrico</Text>
              <TouchableOpacity onPress={() => setTipoModalVisible(false)} style={s.sheetClose}>
                <Ionicons name="close" size={22} color={TEXT_MAIN} />
              </TouchableOpacity>
            </View>
            {TIPOS_CORPO.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={s.tipoItem}
                onPress={() => { setTipoCorpo(t.id); setTipoModalVisible(false); }}
                activeOpacity={0.75}
              >
                <View style={s.tipoItemIcon}>
                  <Ionicons name={t.icon as any} size={16} color={TEAL_MID} />
                </View>
                <Text style={[
                  s.tipoItemLabel,
                  { fontFamily: Q },
                  tipoCorpo === t.id && { color: PRIMARY, fontWeight: '700' },
                ]}>
                  {t.label}
                </Text>
                {tipoCorpo === t.id && (
                  <Ionicons name="checkmark" size={18} color={PRIMARY} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Fotos ───────────────────────────────────────────────────── */}
      <Modal visible={fotoModalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { fontFamily: Q, textAlign: 'center', marginBottom: 16 }]}>
              Adicionar foto
            </Text>

            <TouchableOpacity style={s.fotoSheetBtn} onPress={abrirCamera} activeOpacity={0.85}>
              <LinearGradient
                colors={['#1B4A42', '#2A6B5E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.fotoSheetGradient}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[s.fotoSheetBtnText, { fontFamily: Q }]}>Câmera</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.fotoSheetBtn} onPress={abrirGaleria} activeOpacity={0.85}>
              <LinearGradient
                colors={['#1B4A42', '#2A6B5E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.fotoSheetGradient}
              >
                <Ionicons name="images-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[s.fotoSheetBtnText, { fontFamily: Q }]}>Galeria</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.fotoSheetCancelar} onPress={() => setFotoModalVisible(false)}>
              <Text style={[s.fotoSheetCancelarText, { fontFamily: Q }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Mapa ────────────────────────────────────────────────────── */}
      <Modal visible={mapModalVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={
              mapCoords
                ? { ...mapCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                : RECIFE_REGION
            }
            onPress={(e) => setMapCoords(e.nativeEvent.coordinate)}
          >
            {mapCoords && <Marker coordinate={mapCoords} />}
          </MapView>
          <SafeAreaView edges={['bottom']} style={s.mapFooter}>
            <TouchableOpacity
              style={s.mapConfirmBtn}
              onPress={() => {
                if (mapCoords) {
                  setLocalColeta({
                    latitude:  mapCoords.latitude,
                    longitude: mapCoords.longitude,
                    origem:    'mapa',
                  });
                }
                setMapModalVisible(false);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1B4A42', '#2A6B5E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.mapConfirmGradient}
              >
                <Text style={[s.mapConfirmText, { fontFamily: Q }]}>Confirmar localização</Text>
              </LinearGradient>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── MODAL: Sucesso ─────────────────────────────────────────────────── */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIconCircle}>
              <Ionicons name="checkmark-circle" size={44} color={PRIMARY} />
            </View>
            <Text style={[s.successTitle, { fontFamily: Q }]}>Análise registrada!</Text>
            <View style={s.successDivider} />
            <Text style={[s.successBody, { fontFamily: Q }]}>
              A análise técnica foi salva com sucesso e já está disponível no Histórico.
            </Text>
            {/* ✅ CORRIGIDO: fecha o modal antes de navegar para evitar overlay preso */}
            <TouchableOpacity
              style={s.successBtn}
              onPress={() => {
                setSuccessVisible(false);
                setTimeout(() => router.replace('/(tabs)' as any), 300);
              }}
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

// ─── InfoField subcomponent ───────────────────────────────────────────────────

function InfoField({
  icon, label, value, fontFamily, flex, small,
}: {
  icon: string; label: string; value: string;
  fontFamily?: string; flex?: number; small?: boolean;
}) {
  return (
    <View style={[infoS.wrap, flex ? { flex } : {}]}>
      <Text style={[infoS.label, { fontFamily }]}>{label}</Text>
      <View style={infoS.valueRow}>
        <Ionicons name={icon as any} size={14} color={TEXT_MUTED} style={{ marginRight: 6 }} />
        <Text
          style={[infoS.value, { fontFamily }, small && { fontSize: 11 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const infoS = StyleSheet.create({
  wrap:     { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10 },
  label:    { fontSize: 11, color: TEXT_MUTED, marginBottom: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  value:    { fontSize: 13, fontWeight: '600', color: TEXT_MAIN, flex: 1 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const FOTO_SIZE = (SW - 32 - 32 - 40) / 5;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  // Header
  header:         { paddingBottom: 16 },
  headerContent:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerText:     { flex: 1 },
  headerTitle:    { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 18 },
  logoCircle:     { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  logoImg:        { width: 44, height: 44 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText:   { flex: 1, color: '#c62828', fontSize: 13 },

  // Card
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: TEXT_MAIN, marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 8 },
  optional:   { fontSize: 13, fontWeight: '400', color: TEXT_MUTED },

  // Info grid
  infoGrid: { flexDirection: 'row', gap: 10 },

  // Corpo hídrico
  corpoSelect:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 14 },
  corpoSelectText: { fontSize: 14, color: TEXT_MUTED },
  corpoBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#C8E6C9', backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12 },
  corpoBoxLeft:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  corpoIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F4EE', alignItems: 'center', justifyContent: 'center' },
  corpoNome:       { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  corpoLoc:        { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  corpoAlterar:    { padding: 4 },

  // Localização
  locRow: { flexDirection: 'row', gap: 10 },
  locBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 10,
  },
  locBtnActive:        { borderColor: TEAL_MID, backgroundColor: '#E8F5F2' },
  locIconCircle:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F4EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  locIconCircleActive: { backgroundColor: TEAL_MID },
  locBtnTextWrap:      { alignItems: 'center' },
  locBtnLabel:         { fontSize: 12, fontWeight: '700', color: TEXT_MAIN, textAlign: 'center' },
  locBtnLabelActive:   { color: PRIMARY },
  locBtnSub:           { fontSize: 10, color: TEXT_MUTED, marginTop: 2, textAlign: 'center' },
  locBtnSubActive:     { color: TEAL_MID },
  locCard:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginTop: 10 },
  locCardLeft:         { flexDirection: 'row', alignItems: 'center' },
  locCardTitle:        { fontSize: 12, fontWeight: '700', color: TEXT_MAIN },
  locCardCoords:       { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  locPrecisaoBox:      { flexDirection: 'row', alignItems: 'center' },
  locPrecisaoText:     { fontSize: 11, color: TEAL_MID },

  // Parâmetros
  paramGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paramCell:     { width: (SW - 32 - 32 - 10) / 2, minWidth: 140 },
  paramLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  paramLabel:    { fontSize: 12, color: TEXT_MUTED },
  paramInputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  paramInput:    { flex: 1, fontSize: 14, color: TEXT_MAIN },
  paramUnit:     { fontSize: 12, color: TEXT_MUTED, marginLeft: 4 },
  tipoSelect:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12 },
  tipoSelectText:{ fontSize: 14, color: TEXT_MUTED },

  // Observações
  obsInput:   { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, fontSize: 13, color: TEXT_MAIN, minHeight: 100 },
  obsCounter: { textAlign: 'right', fontSize: 11, color: TEXT_MUTED, marginTop: 6 },

  // Fotos
  fotoHeader:  { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14 },
  fotoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fotoAdd:     { width: FOTO_SIZE + 20, height: FOTO_SIZE + 20, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  fotoAddLabel:{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center' },
  fotoAddSub:  { fontSize: 9, color: '#B0C8C4', textAlign: 'center' },
  fotoThumb:   { width: FOTO_SIZE + 20, height: FOTO_SIZE + 20, borderRadius: 10, overflow: 'visible' },
  fotoImg:     { width: FOTO_SIZE + 20, height: FOTO_SIZE + 20, borderRadius: 10 },
  fotoRemove:  { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  fotoSlot:    { width: FOTO_SIZE + 20, height: FOTO_SIZE + 20, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },

  // Footer
  footer:         { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: BORDER },
  btnCancelar:    { flex: 1, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  btnCancelarText:{ fontSize: 15, fontWeight: '600', color: TEXT_MAIN },
  btnSalvar:      { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnSalvarText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Modais
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sheetTitle:    { flex: 1, fontSize: 18, fontWeight: '700', color: PRIMARY },
  sheetClose:    { padding: 4 },
  buscaRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  buscaInput:    { flex: 1, fontSize: 14, color: TEXT_MAIN },
  corpoItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 10 },
  corpoItemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0F4EE', alignItems: 'center', justifyContent: 'center' },
  corpoItemNome: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  corpoItemLoc:  { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  tipoItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 12 },
  tipoItemIcon:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F4EE', alignItems: 'center', justifyContent: 'center' },
  tipoItemLabel: { fontSize: 14, color: TEXT_MAIN },
  fotoSheetBtn:       { borderRadius: 50, overflow: 'hidden', marginBottom: 10 },
  fotoSheetGradient:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  fotoSheetBtnText:   { fontSize: 16, color: '#fff', fontWeight: '700' },
  fotoSheetCancelar:  { alignItems: 'center', paddingVertical: 14 },
  fotoSheetCancelarText: { fontSize: 15, color: TEXT_MUTED },

  // Mapa
  mapFooter:         { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#fff' },
  mapConfirmBtn:     { borderRadius: 50, overflow: 'hidden' },
  mapConfirmGradient:{ paddingVertical: 14, alignItems: 'center' },
  mapConfirmText:    { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Sucesso
  successOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCard:       { width: '100%', backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center' },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(42,122,106,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle:      { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 14 },
  successDivider:    { height: 1, backgroundColor: BORDER, width: '100%', marginBottom: 14 },
  successBody:       { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBtn:        { width: '100%', backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  successBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
});