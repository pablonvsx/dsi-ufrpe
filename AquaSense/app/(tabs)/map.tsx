// app/(tabs)/map.tsx
//
// COMO O MAPA ATUALIZA O ESTADO DO USUÁRIO:
//
// Quando o usuário abre o modal de um corpo hídrico (abrirDetalhes),
// o Mapa chama `setLastWaterBody(id)` do AuthContext.
//
// Essa função faz duas coisas em paralelo:
//   1. Atualiza o estado em memória do userProfile imediatamente
//      → a Home reage ao voltar, sem esperar o Firestore
//   2. Persiste o ID no Firestore em background
//      → na próxima sessão, a Home já carrega com o dado
//
// NAVEGAÇÃO CONTEXTUAL (focusCorpoId):
//
// Quando o usuário clica em "Ver no mapa" na Home, a rota recebe
// o parâmetro `focusCorpoId` com o ID do corpo hídrico.
//
// O Mapa:
//   1. Aguarda o carregamento dos dados do Firestore
//   2. Localiza o corpo hídrico pelo ID
//   3. Centraliza a câmera nas coordenadas dele
//   4. Abre automaticamente o modal de detalhes
//
// Isso evita que o usuário precise procurar manualmente o corpo no mapa.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, ScrollView, Modal,
  StatusBar, Platform, Image, Animated, PanResponder, Dimensions,
  TextInput, FlatList, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';

import { obterContextoGeografico } from '../../services/geoService';
import { db } from '../../config/firebase';
import { CorpoHidrico, PontoDeUso } from '../../types/water_bodies';
import { buscarObservacoesPorCorpo, calcularResumoObservacoes, ResumoObservacoes } from '../../services/firestore/observations';
import { obterDescricaoInstitucional } from '../../utils/waterBodyDescriptions';
import { useAuth } from '@/contexts/auth-context';

import stateData from '../../assets/map_layers/pe_aquasense.json';
import municipiosData from '../../assets/map_layers/municipios_pe.json';

// ─────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────
const PRIMARY = '#004d48';
const TEAL_MID = '#0d9080';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED = '#6b7a7a';
const SURFACE = '#F5F9F8';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_COLLAPSED = SCREEN_HEIGHT * 0.42;
const SHEET_EXPANDED  = SCREEN_HEIGHT * 0.84;

const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
type DetalheMapa =
  | { tipo: 'corpoHidrico'; dado: CorpoHidrico }
  | { tipo: 'pontoDeUso'; dado: PontoDeUso };

// ─────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────
function StarRating({ stars, size = 14 }: { stars: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= stars ? 'star' : 'star-outline'}
          size={size}
          color={i <= stars ? '#FFA000' : '#ccc'}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function MapaScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { setLastWaterBody } = useAuth();

  // ── Parâmetro de navegação contextual da Home ────────────────────────
  // Se vier `focusCorpoId`, o Mapa centraliza e abre o modal automaticamente.
  const { focusCorpoId } = useLocalSearchParams<{ focusCorpoId?: string }>();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  const [mapTypeVisible, setMapTypeVisible] = useState(false);
  const [layersVisible, setLayersVisible] = useState(false);
  const [legendaVisible, setLegendaVisible] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<string>('satellite');

  const [modoInteligencia, setModoInteligencia] = useState(false);
  const [pontoSelecionado, setPontoSelecionado] = useState<{ latitude: number; longitude: number } | null>(null);
  const [contextoExibicao, setContextoExibicao] = useState<any>(null);
  const [intelVisible, setIntelVisible] = useState(false);

  const [corposHidricosValidados, setCorposHidricosValidados] = useState<CorpoHidrico[]>([]);
  const [corposHidricosPendentes, setCorposHidricosPendentes] = useState<CorpoHidrico[]>([]);
  const [pontosDeUsoValidados, setPontosDeUsoValidados] = useState<PontoDeUso[]>([]);

  // ── BUSCA ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<CorpoHidrico[]>([]);

  // Modal de detalhe
  const [detalheSelecionado, setDetalheSelecionado] = useState<DetalheMapa | null>(null);
  const [detalheModalVisible, setDetalheModalVisible] = useState(false);
  const [resumoObservacoes, setResumoObservacoes] = useState<ResumoObservacoes | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);

  // Controla se o foco automático (via focusCorpoId) já foi executado
  const focusHandled = useRef(false);

  // Bottom sheet drag
  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightValue = useRef(SHEET_COLLAPSED);
  const lastGestureDy = useRef(0);
  const isExpanded = useRef(false);

  useEffect(() => {
    sheetHeight.addListener(({ value }) => { sheetHeightValue.current = value; });
    return () => sheetHeight.removeAllListeners();
  }, []);

  const snapSheet = (toExpanded: boolean) => {
    const toValue = toExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED;
    isExpanded.current = toExpanded;
    Animated.spring(sheetHeight, { toValue, useNativeDriver: false, bounciness: 4 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderGrant: () => { lastGestureDy.current = 0; },
      onPanResponderMove: (_, { dy }) => {
        const newVal = sheetHeightValue.current - (dy - lastGestureDy.current);
        lastGestureDy.current = dy;
        const clamped = Math.max(SHEET_COLLAPSED * 0.5, Math.min(SHEET_EXPANDED, newVal));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const midPoint = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
        const goExpand = sheetHeightValue.current > midPoint || vy < -0.5;
        snapSheet(goExpand);
      },
    })
  ).current;

  const [visibilidade, setVisibilidade] = useState({
    municipios: true,
    corposHidricos: true,
    pendentes: true,
    pontosDeUso: true,
  });

  const labelsCamadas: Record<keyof typeof visibilidade, string> = {
    municipios: 'MUNICÍPIOS',
    corposHidricos: 'CORPOS HÍDRICOS',
    pendentes: 'PENDENTES',
    pontosDeUso: 'PONTOS DE USO',
  };

  // ── Localização inicial ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude, longitude: loc.coords.longitude,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }, 1000);
      } catch { /* silencioso */ }
    })();
  }, []);

  // ── Carrega dados do Firestore ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [validadosSnap, pendentesSnap, pontosSnap] = await Promise.all([
          getDocs(query(collection(db, 'corposHidricos'), where('cadastroValido', '==', true))),
          getDocs(query(collection(db, 'corposHidricos'), where('cadastroValido', '==', false))),
          getDocs(query(collection(db, 'pontosDeUso'), where('cadastroValido', '==', true))),
        ]);
        const hasCoords = (item: any) =>
          typeof item.latitude === 'number' && typeof item.longitude === 'number';

        const validados = validadosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CorpoHidrico)).filter(hasCoords);
        const pendentes = pendentesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CorpoHidrico)).filter(hasCoords);

        setCorposHidricosValidados(validados);
        setCorposHidricosPendentes(pendentes);
        setPontosDeUsoValidados(
          pontosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PontoDeUso)).filter(hasCoords)
        );

        // ── FOCO AUTOMÁTICO via focusCorpoId ─────────────────────────────
        //
        // Executado UMA vez, após os dados carregarem.
        // Localiza o corpo pelo ID, centraliza o mapa e abre o modal.
        // O guard `focusHandled.current` evita execução dupla em re-renders.
        if (focusCorpoId && !focusHandled.current) {
          focusHandled.current = true;
          const alvo =
            [...validados, ...pendentes].find((c) => c.id === focusCorpoId);
          if (alvo) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: alvo.latitude,
                longitude: alvo.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }, 900);
              abrirDetalhes({ tipo: 'corpoHidrico', dado: alvo });
            }, 600); // pequeno delay para o mapa terminar de montar
          }
        }
      } catch (e) {
        console.log('Erro ao carregar pontos:', e);
      }
    })();
  }, [focusCorpoId]);

  // ── Lógica de busca ──────────────────────────────────────────────────────
  const todosCorpos = [...corposHidricosValidados, ...corposHidricosPendentes];

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const filtered = todosCorpos.filter((c) =>
      (c.nome ?? '').toLowerCase().includes(q) ||
      (c.municipio ?? '').toLowerCase().includes(q)
    );
    setSearchResults(filtered.slice(0, 8));
  }, [searchQuery, corposHidricosValidados, corposHidricosPendentes]);

  function handleSelectSearchResult(corpo: CorpoHidrico) {
    Keyboard.dismiss();
    setSearchQuery('');
    setSearchFocused(false);
    setSearchResults([]);
    mapRef.current?.animateToRegion({
      latitude: corpo.latitude,
      longitude: corpo.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 900);
    abrirDetalhes({ tipo: 'corpoHidrico', dado: corpo });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMapPress = (e: any) => {
    if (searchFocused) {
      Keyboard.dismiss();
      setSearchFocused(false);
      return;
    }
    if (!modoInteligencia) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPontoSelecionado({ latitude, longitude });
    const ctx = obterContextoGeografico(latitude, longitude);
    setContextoExibicao(ctx);
    setIntelVisible(true);
  };

  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 1000);
  };

  const resetNorth = () => mapRef.current?.animateCamera({ heading: 0 }, { duration: 1000 });

  /**
   * ABERTURA DO MODAL + ATUALIZAÇÃO DO HISTÓRICO
   *
   * Quando o usuário abre o detalhe de um corpo hídrico:
   *   1. Chama setLastWaterBody(id) → atualiza AuthContext em memória + Firestore
   *   2. Abre o bottom sheet de detalhes normalmente
   *
   * A chamada a setLastWaterBody ocorre apenas para corposHidricos,
   * não para pontosDeUso (que não são corpos hídricos).
   */
  const abrirDetalhes = useCallback(async (detalhe: DetalheMapa) => {
    setDetalheSelecionado(detalhe);
    setResumoObservacoes(null);

    sheetHeight.setValue(SHEET_COLLAPSED);
    isExpanded.current = false;
    setDetalheModalVisible(true);

    if (detalhe.tipo === 'corpoHidrico') {
      const id = detalhe.dado?.id;

      // Registra o último corpo acessado no AuthContext (memória + Firestore)
      if (id) {
        setLastWaterBody(id);
      }

      if (!id) {
        setResumoObservacoes(calcularResumoObservacoes([]));
        return;
      }

      setLoadingResumo(true);
      try {
        const obs = await buscarObservacoesPorCorpo(id);
        console.log(`[AquaSense] Observações carregadas para ${id}:`, obs.length);
        setResumoObservacoes(calcularResumoObservacoes(obs));
      } catch (err) {
        console.log('[AquaSense] Erro ao buscar observações:', err);
        setResumoObservacoes(calcularResumoObservacoes([]));
      } finally {
        setLoadingResumo(false);
      }
    }
  }, [setLastWaterBody]);

  const fecharDetalhes = () => {
    setDetalheModalVisible(false);
    setDetalheSelecionado(null);
    setResumoObservacoes(null);
  };

  const formatarTiposUso = (tipo: PontoDeUso['tipoDeUso']) =>
    Array.isArray(tipo) ? tipo.join(', ') : tipo;

  const corpoSelecionado =
    detalheSelecionado?.tipo === 'corpoHidrico'
      ? (detalheSelecionado.dado as CorpoHidrico)
      : null;
  const isPendente = corpoSelecionado ? !corpoSelecionado.cadastroValido : false;

  const descricaoInstitucional = corpoSelecionado
    ? obterDescricaoInstitucional(corpoSelecionado.nome, corpoSelecionado.tipo)
    : '';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerBrandRow}>
              <Image
                source={require('../../assets/images/aquasense-name.png')}
                style={styles.headerBrandImage}
                resizeMode="contain"
                tintColor="#FFFFFF"
              />
            </View>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Mapa</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.searchBarWrapper}>
              <View style={[styles.searchBarInner, searchFocused && styles.searchBarFocused]}>
                <Ionicons name="search-outline" size={18} color={TEXT_MUTED} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchBarInput, { fontFamily: questrial }]}
                  placeholder="Buscar corpo hídrico..."
                  placeholderTextColor={TEXT_MUTED}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => { setTimeout(() => setSearchFocused(false), 150); }}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ DROPDOWN DE RESULTADOS DE BUSCA ══ */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id ?? item.nome}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchDropdownItem}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.searchDropdownIcon, { backgroundColor: item.cadastroValido ? '#0B63CE' : '#E67E22' }]}>
                    <Ionicons name="water" size={13} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.searchDropdownName, { fontFamily: questrial }]} numberOfLines={1}>
                      {item.nome}
                    </Text>
                    {item.municipio ? (
                      <Text style={[styles.searchDropdownSub, { fontFamily: questrial }]}>{item.municipio}</Text>
                    ) : null}
                  </View>
                  {!item.cadastroValido && (
                    <View style={styles.pendentePill}>
                      <Text style={[styles.pendentePillText, { fontFamily: questrial }]}>Pendente</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: BORDER_LIGHT, marginHorizontal: 12 }} />}
            />
          </View>
        )}

        {/* ══ MAPA ══ */}
        <MapView
          ref={mapRef}
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          initialRegion={REGIAO_INICIAL}
          mapType={tipoMapa as any}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          rotateEnabled={true}
          onPress={handleMapPress}
        >
          {visibilidade.municipios && (
            <Geojson
              geojson={municipiosData as any}
              strokeColor={(tipoMapa === 'standard' || tipoMapa === 'terrain') ? '#FF8C00' : '#FFFFFF'}
              fillColor="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          )}

          {visibilidade.corposHidricos && corposHidricosValidados.map((item) => (
            <Marker
              key={`ch-${item.id}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              onPress={() => abrirDetalhes({ tipo: 'corpoHidrico', dado: item })}
            >
              <View style={[styles.customMarker, styles.markerCorpoHidrico]}>
                <Ionicons name="water" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          ))}

          {visibilidade.pendentes && corposHidricosPendentes.map((item) => (
            <Marker
              key={`pending-${item.id}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              onPress={() => abrirDetalhes({ tipo: 'corpoHidrico', dado: item })}
            >
              <View style={[styles.customMarker, styles.markerPendente]}>
                <Ionicons name="time-outline" size={14} color="#FFFFFF" />
              </View>
            </Marker>
          ))}

          {visibilidade.pontosDeUso && pontosDeUsoValidados.map((item) => (
            <Marker
              key={`pu-${item.id}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              onPress={() => abrirDetalhes({ tipo: 'pontoDeUso', dado: item })}
            >
              <View style={[styles.customMarker, styles.markerPontoDeUso]}>
                <Ionicons name="location" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          ))}

          <Geojson
            geojson={stateData as any}
            fillColor="rgba(255,0,0,0)"
            strokeColor="#FF0000"
            strokeWidth={3}
          />

          {pontoSelecionado && (
            <Marker coordinate={pontoSelecionado} pinColor="#F1C40F" title="Local da Coleta" />
          )}
        </MapView>

        {/* ══ BOTÕES LATERAIS ══ */}
        <View style={styles.controlesDireita}>
          <TouchableOpacity style={styles.botaoCircular} onPress={() => setMapTypeVisible(true)}>
            <Ionicons name="map" size={22} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botaoCircular, { marginTop: 10 }]} onPress={() => setLayersVisible(true)}>
            <Ionicons name="layers" size={22} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botaoCircular, { marginTop: 10 }]} onPress={() => setLegendaVisible(true)}>
            <Ionicons name="information-circle-outline" size={24} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botaoCircular, { marginTop: 10 }, modoInteligencia && styles.botaoCircularAtivo]}
            onPress={() => {
              if (modoInteligencia) { setModoInteligencia(false); setContextoExibicao(null); setPontoSelecionado(null); }
              else { setModoInteligencia(true); }
            }}
          >
            <Ionicons name="analytics-outline" size={22} color={modoInteligencia ? '#FFF' : PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botaoCircular, { marginTop: 10 }]} onPress={resetNorth}>
            <Ionicons name="arrow-up" size={22} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botaoCircular, { marginTop: 10 }]} onPress={goToMyLocation}>
            <Ionicons name="locate" size={22} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* ══ MODAL: LEGENDA ══ */}
        <Modal visible={legendaVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setLegendaVisible(false)}>
            <View style={styles.menuCard}>
              <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Legenda do Mapa</Text>
              {[
                { color: '#0B63CE', icon: 'water', label: 'Corpo hídrico validado', desc: 'Cadastrado e aprovado pela equipe gestora.' },
                { color: '#E67E22', icon: 'time-outline', label: 'Corpo hídrico pendente', desc: 'Aguardando validação da equipe.' },
                { color: '#2E7D32', icon: 'location', label: 'Ponto de uso', desc: 'Local onde a água é usada pela comunidade.' },
              ].map((item) => (
                <View key={item.label} style={styles.legendaRow}>
                  <View style={[styles.legendaIcon, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon as any} size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.legendaLabel, { fontFamily: questrial }]}>{item.label}</Text>
                    <Text style={[styles.legendaDesc, { fontFamily: questrial }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.legendaDivider} />
              <View style={styles.legendaRow}>
                <View style={[styles.legendaIcon, { backgroundColor: PRIMARY }]}>
                  <Ionicons name="analytics-outline" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legendaLabel, { fontFamily: questrial }]}>Inteligência Territorial</Text>
                  <Text style={[styles.legendaDesc, { fontFamily: questrial }]}>
                    Ative pelo botão <Text style={{ fontWeight: '700' }}>⟨análise⟩</Text> e toque no mapa para ver dados geográficos do ponto.
                  </Text>
                </View>
              </View>
              <View style={styles.legendaDivider} />
              <View style={styles.legendaRow}>
                <View style={[styles.legendaIcon, { backgroundColor: TEAL_MID }]}>
                  <Ionicons name="search" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legendaLabel, { fontFamily: questrial }]}>Busca</Text>
                  <Text style={[styles.legendaDesc, { fontFamily: questrial }]}>
                    Use a barra de busca no topo para localizar um corpo hídrico pelo nome ou município.
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ══ MODAL: INTELIGÊNCIA TERRITORIAL ══ */}
        <Modal visible={intelVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => { setIntelVisible(false); }}>
            <View style={styles.menuCard}>
              <View style={styles.cardContextoHeader}>
                <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Inteligência Territorial</Text>
                <TouchableOpacity onPress={() => { setIntelVisible(false); setContextoExibicao(null); setPontoSelecionado(null); }}>
                  <Ionicons name="close" size={20} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              {contextoExibicao && [
                ['Município', contextoExibicao.municipio],
                ['Microbacia', contextoExibicao.microRH],
                ['Mesobacia', contextoExibicao.mesoRH],
                ['Macrobacia', contextoExibicao.macroRH],
                ['Bioma', contextoExibicao.bioma],
                ['Corpo hídrico', contextoExibicao.rio],
              ].map(([label, val]) => (
                <Text key={label} style={[styles.cardText, { fontFamily: questrial }]}>
                  <Text style={styles.bold}>{label}: </Text>{val}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ══ MODAL: TIPO DE MAPA ══ */}
        <Modal visible={mapTypeVisible} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setMapTypeVisible(false)}>
            <View style={styles.menuCard}>
              <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Estilo do Mapa</Text>
              {['standard', 'satellite', 'hybrid', 'terrain'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.itemMenu, tipoMapa === mode && styles.itemAtivo]}
                  onPress={() => { setTipoMapa(mode); setMapTypeVisible(false); }}
                >
                  <Text style={[styles.textoItem, { fontFamily: questrial }, tipoMapa === mode && styles.textoAtivo]}>
                    {mode.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ══ MODAL: CAMADAS ══ */}
        <Modal visible={layersVisible} animationType="slide" transparent>
          <View style={styles.modalOverlayBottom}>
            <View style={styles.menuBottom}>
              <View style={styles.menuHeader}>
                <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Camadas Ativas</Text>
                <TouchableOpacity onPress={() => setLayersVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <View style={styles.menuDivider} />
              <ScrollView showsVerticalScrollIndicator={false}>
                {(Object.keys(visibilidade) as Array<keyof typeof visibilidade>).map((key) => (
                  <View key={key} style={styles.toggleRow}>
                    <Text style={[styles.toggleLabel, { fontFamily: questrial }]}>{labelsCamadas[key]}</Text>
                    <TouchableOpacity
                      style={[styles.toggle, visibilidade[key] && styles.toggleAtivo]}
                      onPress={() => setVisibilidade((p) => ({ ...p, [key]: !p[key] }))}
                    >
                      <View style={[styles.toggleCircle, visibilidade[key] && styles.toggleCircleAtivo]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ══ MODAL: DETALHES — Bottom Sheet expansível ══ */}
        <Modal
          visible={detalheModalVisible}
          transparent
          animationType="slide"
          onRequestClose={fecharDetalhes}
        >
          <View style={styles.detalheOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={fecharDetalhes} activeOpacity={1} />

            <Animated.View style={[styles.detalheSheet, { height: sheetHeight }]}>
              <View style={styles.dragHandleWrapper} {...panResponder.panHandlers}>
                <View style={styles.dragHandle} />
              </View>

              <LinearGradient
                colors={['#004d48', '#0a6b5e']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.detalheSheetHeader}
              >
                <View style={styles.detalheSheetHeaderRow}>
                  <View style={{ flex: 1 }}>
                    {detalheSelecionado?.tipo === 'corpoHidrico' ? (
                      <>
                        <View style={styles.detalheNomeRow}>
                          <Ionicons name="water" size={20} color="#3ff3e7" style={{ marginRight: 8 }} />
                          <Text style={[styles.detalheNome, { fontFamily: questrial }]} numberOfLines={2}>
                            {corpoSelecionado?.nome || 'Corpo Hídrico'}
                          </Text>
                        </View>
                        <Text style={[styles.detalheSubtitulo, { fontFamily: questrial }]}>
                          {[corpoSelecionado?.municipio, 'PE'].filter(Boolean).join(' · ')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.detalheNomeRow}>
                          <Ionicons name="location" size={20} color="#3ff3e7" style={{ marginRight: 8 }} />
                          <Text style={[styles.detalheNome, { fontFamily: questrial }]} numberOfLines={2}>
                            {(detalheSelecionado?.dado as PontoDeUso)?.nomeLocalPopular || 'Ponto de Uso'}
                          </Text>
                        </View>
                        <Text style={[styles.detalheSubtitulo, { fontFamily: questrial }]}>
                          {(detalheSelecionado?.dado as PontoDeUso)?.municipio || ''}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={[
                    styles.statusBadge,
                    isPendente ? styles.statusBadgePendente : styles.statusBadgeValidado,
                  ]}>
                    <Ionicons
                      name={isPendente ? 'time-outline' : 'checkmark-circle-outline'}
                      size={12}
                      color={isPendente ? '#f9a825' : '#2e7d6e'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[
                      styles.statusBadgeText, { fontFamily: questrial },
                      isPendente ? styles.statusTextPendente : styles.statusTextValidado,
                    ]}>
                      {isPendente ? 'Pendente' : 'Validado'}
                    </Text>
                  </View>
                </View>

                {detalheSelecionado?.tipo === 'corpoHidrico' && resumoObservacoes && resumoObservacoes.totalObservacoes > 0 && (
                  <View style={styles.qualidadeHeaderRow}>
                    <View style={[styles.qualidadeHeaderDot, { backgroundColor: resumoObservacoes.qualidade.color }]} />
                    <View>
                      <Text style={[styles.qualidadeHeaderLabel, { fontFamily: questrial, color: resumoObservacoes.qualidade.color }]}>
                        {resumoObservacoes.qualidade.label}
                      </Text>
                      {resumoObservacoes.qualidade.hint && (
                        <Text style={[styles.qualidadeHeaderHint, { fontFamily: questrial }]}>
                          {resumoObservacoes.qualidade.hint}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </LinearGradient>

              <ScrollView style={styles.detalheBody} showsVerticalScrollIndicator={false}>

                {detalheSelecionado?.tipo === 'corpoHidrico' && corpoSelecionado && (
                  <>
                    {descricaoInstitucional ? (
                      <Text style={[styles.detalheDescText, { fontFamily: questrial }]}>
                        {descricaoInstitucional}
                      </Text>
                    ) : null}

                    <View style={styles.mediasParamsRow}>
                      <View style={[styles.mediasParamsCard, { flex: 1.1 }]}>
                        <Text style={[styles.mediasParamsTitle, { fontFamily: questrial }]}>MÉDIAS:</Text>
                        {loadingResumo ? (
                          <Text style={[styles.semDadosText, { fontFamily: questrial }]}>...</Text>
                        ) : resumoObservacoes && resumoObservacoes.totalObservacoes > 0 ? (
                          <>
                            <View style={styles.mediaLineRow}>
                              <Ionicons name="ellipse-outline" size={12} color="#555" style={{ marginRight: 4, marginTop: 1 }} />
                              <Text style={[styles.mediaLineTxt, { fontFamily: questrial }]}>Observações </Text>
                              <StarRating stars={resumoObservacoes.estrelas} size={12} />
                            </View>
                            <View style={styles.mediaLineRow}>
                              <Ionicons name="ellipse-outline" size={12} color="#555" style={{ marginRight: 4, marginTop: 1 }} />
                              <Text style={[styles.mediaLineTxt, { fontFamily: questrial }]}>Medições: </Text>
                              <Text style={[styles.semDadosSmText, { fontFamily: questrial }]}>—</Text>
                            </View>
                          </>
                        ) : (
                          <Text style={[styles.semDadosText, { fontFamily: questrial }]}>Sem dados</Text>
                        )}
                      </View>

                      <View style={[styles.mediasParamsCard, { flex: 1 }]}>
                        <Text style={[styles.mediasParamsTitle, { fontFamily: questrial }]}>PARÂMETROS TÉCNICOS:</Text>
                        <View style={styles.mediaLineRow}>
                          <Ionicons name="cloud-outline" size={12} color="#90a4ae" style={{ marginRight: 4 }} />
                          <Text style={[styles.semDadosSmText, { fontFamily: questrial }]}>
                            Parâmetros técnicos ainda não validados
                          </Text>
                        </View>
                      </View>
                    </View>

                    {resumoObservacoes && resumoObservacoes.qualidade.hasAlert && (
                      <View style={styles.alertaBanner}>
                        <Ionicons name="warning" size={16} color="#f57c00" />
                        <Text style={[styles.alertaText, { fontFamily: questrial }]}>
                          ALERTA: Risco elevado de contaminação
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color="#f57c00" />
                      </View>
                    )}

                    {resumoObservacoes && resumoObservacoes.totalObservacoes > 0 && (
                      <View style={styles.detalheSection}>
                        <Text style={[styles.detalheSectionTitle, { fontFamily: questrial }]}>Observações usuais</Text>
                        {resumoObservacoes.corMaisFrequente && (
                          <View style={styles.obsRow}>
                            <Ionicons name="color-palette-outline" size={14} color={TEAL_MID} style={{ marginRight: 6 }} />
                            <Text style={[styles.obsText, { fontFamily: questrial }]}>
                              Cor mais frequente: <Text style={styles.obsBold}>{resumoObservacoes.corMaisFrequente}</Text>
                            </Text>
                          </View>
                        )}
                        {resumoObservacoes.odorMaisFrequente && (
                          <View style={styles.obsRow}>
                            <Ionicons name="cloud-outline" size={14} color={TEAL_MID} style={{ marginRight: 6 }} />
                            <Text style={[styles.obsText, { fontFamily: questrial }]}>
                              Odor mais frequente: <Text style={styles.obsBold}>{resumoObservacoes.odorMaisFrequente}</Text>
                            </Text>
                          </View>
                        )}
                        {resumoObservacoes.percentualLixo !== null && (
                          <View style={styles.obsRow}>
                            <Ionicons name="trash-outline" size={14} color={TEAL_MID} style={{ marginRight: 6 }} />
                            <Text style={[styles.obsText, { fontFamily: questrial }]}>
                              Lixo em <Text style={styles.obsBold}>{resumoObservacoes.percentualLixo}%</Text> das visitas
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.totalObsText, { fontFamily: questrial }]}>
                          Baseado em {resumoObservacoes.totalObservacoes} observação(ões)
                        </Text>
                      </View>
                    )}

                    {(!resumoObservacoes || resumoObservacoes.totalObservacoes === 0) && !loadingResumo && (
                      <View style={styles.detalheSection}>
                        <Text style={[styles.detalheSectionTitle, { fontFamily: questrial }]}>Observações usuais</Text>
                        <Text style={[styles.semDadosText, { fontFamily: questrial }]}>
                          Ainda não há observações para este corpo hídrico.
                        </Text>
                      </View>
                    )}

                    <View style={styles.detalheSection}>
                      <Text style={[styles.detalheSectionTitle, { fontFamily: questrial }]}>Ficha técnica</Text>
                      {[
                        ['Tipo', corpoSelecionado.tipo],
                        ['Bioma', corpoSelecionado.bioma],
                        ['Macro RH', corpoSelecionado.macroRH],
                        ['Meso RH', corpoSelecionado.mesoRH],
                        ['Micro RH', corpoSelecionado.microRH],
                      ].map(([label, val]) => val ? (
                        <View key={label} style={styles.fichaRow}>
                          <Text style={[styles.fichaLabel, { fontFamily: questrial }]}>{label}</Text>
                          <Text style={[styles.fichaVal, { fontFamily: questrial }]}>{val}</Text>
                        </View>
                      ) : null)}
                    </View>
                  </>
                )}

                {detalheSelecionado?.tipo === 'pontoDeUso' && (
                  <View style={styles.detalheSection}>
                    <Text style={[styles.detalheSectionTitle, { fontFamily: questrial }]}>Informações</Text>
                    {[
                      ['Tipos de uso', formatarTiposUso((detalheSelecionado.dado as PontoDeUso).tipoDeUso)],
                      ['Referência', (detalheSelecionado.dado as PontoDeUso).nomeCorpoHidricoReferencia],
                      ['Frequência', (detalheSelecionado.dado as PontoDeUso).frequenciaUso],
                      ['Município', (detalheSelecionado.dado as PontoDeUso).municipio],
                      ['Bioma', (detalheSelecionado.dado as PontoDeUso).bioma],
                    ].map(([label, val]) => val ? (
                      <View key={label} style={styles.fichaRow}>
                        <Text style={[styles.fichaLabel, { fontFamily: questrial }]}>{label}</Text>
                        <Text style={[styles.fichaVal, { fontFamily: questrial }]}>{val}</Text>
                      </View>
                    ) : null)}
                  </View>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>

              <View style={styles.detalheFooter}>
                <TouchableOpacity style={styles.detalheVoltarBtn} onPress={fecharDetalhes} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#004d48', '#0d9080']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.detalheVoltarGradient}
                  >
                    <Text style={[styles.detalheVoltarText, { fontFamily: questrial }]}>Voltar</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────
// ESTILOS — idênticos ao original
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  mapa: { flex: 1 },
  headerGradient: {},
  headerSafe: { paddingBottom: 12 },
  headerBrandRow: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  headerBrandImage: { height: 22, width: 160 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.2, marginLeft: 4 },
  searchBarWrapper: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBarInner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  searchBarFocused: { shadowOpacity: 0.2, elevation: 6 },
  searchBarInput: { flex: 1, fontSize: 14, color: '#333' },
  searchDropdown: {
    position: 'absolute', left: 0, right: 0, zIndex: 100,
    marginTop: Platform.OS === 'ios' ? 185 : 165,
    backgroundColor: '#FFFFFF', marginHorizontal: 12, borderRadius: 16, maxHeight: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, overflow: 'hidden',
  },
  searchDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  searchDropdownIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchDropdownName: { fontSize: 14, color: '#333', fontWeight: '600' },
  searchDropdownSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  pendentePill: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe082', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  pendentePillText: { fontSize: 10, color: '#f9a825', fontWeight: '700' },
  cardContextoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 6 },
  cardText: { fontSize: 13, color: TEXT_MUTED, marginBottom: 3 },
  bold: { fontWeight: '700', color: PRIMARY },
  controlesDireita: { position: 'absolute', bottom: 40, left: 16 },
  botaoCircular: { backgroundColor: 'rgba(255,255,255,0.95)', padding: 11, borderRadius: 26, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, alignItems: 'center', justifyContent: 'center' },
  botaoCircularAtivo: { backgroundColor: PRIMARY },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  menuCard: { backgroundColor: 'rgba(255,255,255,0.97)', width: '100%', borderRadius: 20, padding: 20, elevation: 6 },
  menuTitle: { fontSize: 17, fontWeight: '700', color: PRIMARY, marginBottom: 14, letterSpacing: 0.3 },
  itemMenu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemAtivo: { backgroundColor: 'rgba(63,243,231,0.12)', borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0 },
  textoItem: { fontSize: 14, color: TEXT_MUTED, fontWeight: '500' },
  textoAtivo: { fontWeight: '700', color: PRIMARY },
  legendaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  legendaIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  legendaLabel: { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 2 },
  legendaDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },
  legendaDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 12, marginTop: 4 },
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menuBottom: { backgroundColor: 'rgba(255,255,255,0.98)', width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%', elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  menuDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, backgroundColor: '#f9fafa', marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  toggle: { width: 48, height: 26, backgroundColor: '#ddd', borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleAtivo: { backgroundColor: PRIMARY },
  toggleCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleCircleAtivo: { alignSelf: 'flex-end' },
  detalheOverlay: { flex: 1, justifyContent: 'flex-end' },
  detalheSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12 },
  dragHandleWrapper: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#FFFFFF' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
  detalheSheetHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  detalheSheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detalheNomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  detalheNome: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, flexShrink: 1 },
  detalheSubtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginLeft: 28 },
  qualidadeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  qualidadeHeaderDot: { width: 18, height: 18, borderRadius: 9 },
  qualidadeHeaderLabel: { fontSize: 16, fontWeight: '700' },
  qualidadeHeaderHint: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  statusBadgePendente: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe082' },
  statusBadgeValidado: { backgroundColor: 'rgba(46,125,110,0.15)', borderWidth: 1, borderColor: 'rgba(46,125,110,0.3)' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusTextPendente: { color: '#f9a825' },
  statusTextValidado: { color: '#2e7d6e' },
  detalheBody: { paddingHorizontal: 16, paddingTop: 14, flex: 1 },
  detalheDescText: { fontSize: 13, color: '#444', lineHeight: 20, marginBottom: 14, backgroundColor: '#F5F9F8', borderRadius: 12, padding: 12 },
  mediasParamsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  mediasParamsCard: { backgroundColor: '#F5F9F8', borderRadius: 12, padding: 12 },
  mediasParamsTitle: { fontSize: 10, fontWeight: '700', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  mediaLineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },
  mediaLineTxt: { fontSize: 12, color: '#444' },
  semDadosSmText: { fontSize: 11, color: TEXT_MUTED },
  detalheSection: { backgroundColor: '#F5F9F8', borderRadius: 12, padding: 12, marginBottom: 10 },
  detalheSectionTitle: { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 8 },
  obsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  obsText: { fontSize: 13, color: '#555' },
  obsBold: { fontWeight: '700', color: '#333' },
  totalObsText: { fontSize: 11, color: TEXT_MUTED, marginTop: 6, fontStyle: 'italic' },
  alertaBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff8e1', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: '#ffe082' },
  alertaText: { flex: 1, fontSize: 13, color: '#f57c00', fontWeight: '700' },
  semDadosText: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic' },
  fichaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT },
  fichaLabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },
  fichaVal: { fontSize: 12, color: '#333', textAlign: 'right', flex: 1, marginLeft: 12 },
  detalheFooter: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: BORDER_LIGHT, paddingBottom: Platform.OS === 'ios' ? 32 : 14, backgroundColor: '#FFFFFF' },
  detalheVoltarBtn: { borderRadius: 50, overflow: 'hidden' },
  detalheVoltarGradient: { paddingVertical: 15, alignItems: 'center' },
  detalheVoltarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  customMarker: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  markerCorpoHidrico: { backgroundColor: '#0B63CE' },
  markerPontoDeUso: { backgroundColor: '#2E7D32' },
  markerPendente: { backgroundColor: '#E67E22' },
});