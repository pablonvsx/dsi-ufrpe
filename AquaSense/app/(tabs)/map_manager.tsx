import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, ScrollView, Modal,
  StatusBar, Platform, Animated, Dimensions,
  TextInput, FlatList, Keyboard, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { db } from '../../config/firebase';
import { CorpoHidrico } from '../../types/water_bodies';
import {
  buscarObservacoesPorCorpo,
  calcularResumoObservacoes,
} from '../../services/firestore/observations';
import { getComplaintsByWaterBody } from '../../services/firestore/complaints';
import { Alerta } from '../../services/firestore/alerts';
import ManagerBottomNav from '@/components/managerbottomnav';
import stateData from '../../assets/map_layers/pe_aquasense.json';
import municipiosData from '../../assets/map_layers/municipios_pe.json';

// ─────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────
const PRIMARY = '#004d48';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED = '#6b7a7a';
const SURFACE = '#F5F9F8';
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
type NivelRisco = 'critico' | 'atencao' | 'normal' | 'semDados' | 'recorrente';

interface CorpoComRisco extends CorpoHidrico {
  nivelRisco: NivelRisco;
  totalDenuncias: number;
}

interface DetalheCarregado {
  odorMaisFrequente: string | null;
  phMedio: number | null;
  totalDenuncias: number;
  recorrencia: 'Alta' | 'Média' | 'Baixa';
  equipes: number;
}

// ─────────────────────────────────────────────
// CONFIGS POR NÍVEL
// ─────────────────────────────────────────────
const NIVEL_CONFIG: Record<NivelRisco, {
  label: string; color: string; bg: string;
  subtitulo: string; icon: keyof typeof Ionicons.glyphMap;
}> = {
  critico: { label: 'Crítico', color: '#EF4444', bg: '#FEE2E2', subtitulo: 'Risco muito alto', icon: 'warning' },
  atencao: { label: 'Atenção', color: '#F97316', bg: '#FFF7ED', subtitulo: 'Requer atenção', icon: 'alert-circle' },
  normal: { label: 'Normal', color: '#22C55E', bg: '#F0FDF4', subtitulo: 'Situação estável', icon: 'water' },
  semDados: { label: 'Sem dados', color: '#9CA3AF', bg: '#F9FAFB', subtitulo: 'Sem dados recentes', icon: 'help' },
  recorrente: { label: 'Denúncias recorrentes', color: '#8B5CF6', bg: '#F5F3FF', subtitulo: 'Denúncias recorrentes', icon: 'megaphone' },
};

// ─────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────

function RiscoChip({ nivel }: { nivel: NivelRisco }) {
  const cfg = NIVEL_CONFIG[nivel];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function StatCard({
  icon, label, value, sub, subColor, fontFamily,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: string; sub: string;
  subColor: string; fontFamily?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color="#9CA3AF" />
      <Text style={[styles.statLabel, fontFamily ? { fontFamily } : {}]}>{label}</Text>
      <Text style={[styles.statValue, fontFamily ? { fontFamily } : {}]}>{value}</Text>
      {!!sub && (
        <Text style={[styles.statSub, { color: subColor }, fontFamily ? { fontFamily } : {}]}>{sub}</Text>
      )}
    </View>
  );
}

function RiskChart({ nivel, fontFamily }: { nivel: NivelRisco; fontFamily?: string }) {
  const today = new Date();
  const labels: string[] = [];
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(`${d.getDate()} ${MESES[d.getMonth()]}`);
  }

  const DATA: Record<NivelRisco, number[]> = {
    critico: [1, 2, 2, 3, 2, 2, 3],
    atencao: [1, 1, 2, 1, 2, 2, 2],
    normal: [1, 1, 1, 1, 1, 2, 1],
    semDados: [0, 0, 0, 1, 0, 0, 0],
    recorrente: [1, 2, 1, 2, 1, 2, 2],
  };
  const values = DATA[nivel];
  const maxVal = 3;
  const chartW = SCREEN_WIDTH - 64;
  const chartH = 60;
  const stepX = chartW / (values.length - 1);
  const lineColor = NIVEL_CONFIG[nivel].color;
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: chartH - (v / maxVal) * chartH,
  }));
  const LEVEL_LABELS: Record<number, string> = { 3: 'Crítico', 2: 'Atenção', 1: 'Normal' };

  return (
    <View>
      <View style={{ position: 'relative', height: chartH, marginLeft: 8 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: (i / 2) * chartH, height: 1, backgroundColor: BORDER_LIGHT,
          }}>
            <Text style={{ position: 'absolute', right: '100%', top: -8, fontSize: 8, color: TEXT_MUTED, paddingRight: 4 }}>
              {LEVEL_LABELS[3 - i]}
            </Text>
          </View>
        ))}
        {points.map((p, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: lineColor,
            left: p.x - 3.5, top: p.y - 3.5,
            borderWidth: 1.5, borderColor: '#fff',
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, marginLeft: 8 }}>
        {labels.map((l, i) => (
          <Text key={i} style={[{ fontSize: 8, color: TEXT_MUTED }, fontFamily ? { fontFamily } : {}]}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function MapaGestorScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { focusCorpoId } = useLocalSearchParams<{ focusCorpoId?: string }>();
  const focusHandled = useRef(false);
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  const [tipoMapa, setTipoMapa] = useState<string>('satellite');
  const [mapTypeVisible, setMapTypeVisible] = useState(false);
  const [layersVisible, setLayersVisible] = useState(false);
  const [filtrosVisible, setFiltrosVisible] = useState(false);
  const [corposComRisco, setCorposComRisco] = useState<CorpoComRisco[]>([]);
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [lastUpdate, setLastUpdate] = useState('');
  const [selectedCorpo, setSelectedCorpo] = useState<CorpoComRisco | null>(null);
  const [detalheCarregado, setDetalheCarregado] = useState<DetalheCarregado | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<CorpoComRisco[]>([]);
  const [filtroNivel, setFiltroNivel] = useState<NivelRisco | null>(null);
  const [visibilidade, setVisibilidade] = useState({
    municipios: true,
    corposHidricos: true,
  });

  const sheetAnim = useRef(new Animated.Value(0)).current;

  function formatTime(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ── Localização ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }, 1000);
      } catch { /* silencioso */ }
    })();
  }, []);

  // ── Carrega corpos + alertas ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [corposSnap, alertasSnap] = await Promise.all([
          getDocs(collection(db, 'corposHidricos')),
          getDocs(collection(db, 'alertas')),
        ]);

        const alertaMap = new Map<string, Alerta[]>();
        alertasSnap.docs.forEach(d => {
          const data = d.data();
          if (data.ativo === false) return;
          const cid = data.corpoHidricoId as string | undefined;
          if (!cid) return;
          const list = alertaMap.get(cid) ?? [];
          list.push({ id: d.id, ...data } as Alerta);
          alertaMap.set(cid, list);
        });

        const alertasAtivos = alertasSnap.docs.filter(d => d.data().ativo !== false);
        setTotalAlertas(alertasAtivos.length);

        const hasCoords = (item: any) =>
          typeof item.latitude === 'number' && typeof item.longitude === 'number';

        const corpos: CorpoComRisco[] = corposSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as CorpoHidrico))
          .filter(hasCoords)
          .map(c => {
            const alertas = alertaMap.get(c.id ?? '') ?? [];
            const hasCritico = alertas.some(a => a.nivel === 'Crítico');
            const hasAtencao = alertas.some(a => a.nivel === 'Atenção');
            let nivelRisco: NivelRisco;
            if (hasCritico) nivelRisco = 'critico';
            else if (hasAtencao) nivelRisco = 'atencao';
            else if (c.cadastroValido) nivelRisco = 'normal';
            else nivelRisco = 'semDados';
            return { ...c, nivelRisco, totalDenuncias: 0 };
          });

        setCorposComRisco(corpos);
        setLastUpdate(formatTime(new Date()));

        if (focusCorpoId && !focusHandled.current) {
          focusHandled.current = true;
          const alvo = corpos.find(c => c.id === focusCorpoId);
          if (alvo) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: alvo.latitude,
                longitude: alvo.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }, 900);
              handleSelectCorpo(alvo);
            }, 600);
          }
        }
      } catch (e) {
        console.log('[MapaGestor] Erro ao carregar dados:', e);
      }
    })();
  }, [focusCorpoId]);

  // ── Busca ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); return; }
    setSearchResults(
      corposComRisco
        .filter(c =>
          (c.nome ?? '').toLowerCase().includes(q) ||
          (c.municipio ?? '').toLowerCase().includes(q)
        )
        .slice(0, 8)
    );
  }, [searchQuery, corposComRisco]);

  // ── Abre detalhe ─────────────────────────────────────────────────────────────
  const handleSelectCorpo = useCallback(async (corpo: CorpoComRisco) => {
    setSelectedCorpo(corpo);
    setDetalheCarregado(null);
    setLoadingDetalhe(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 3 }).start();
    try {
      const [obs, denuncias] = await Promise.all([
        buscarObservacoesPorCorpo(corpo.id ?? ''),
        getComplaintsByWaterBody(corpo.id ?? ''),
      ]);
      const resumo = calcularResumoObservacoes(obs);
      const total = denuncias.length;
      const recorrencia: 'Alta' | 'Média' | 'Baixa' =
        total >= 15 ? 'Alta' : total >= 5 ? 'Média' : 'Baixa';
      setDetalheCarregado({
        odorMaisFrequente: resumo.odorMaisFrequente ?? null,
        phMedio: null,
        totalDenuncias: total,
        recorrencia,
        equipes: 0,
      });
    } catch {
      setDetalheCarregado({ odorMaisFrequente: null, phMedio: null, totalDenuncias: 0, recorrencia: 'Baixa', equipes: 0 });
    } finally {
      setLoadingDetalhe(false);
    }
  }, []);

  const fecharDetalhe = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setSelectedCorpo(null);
      setDetalheCarregado(null);
    });
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

  const corposFiltrados = filtroNivel
    ? corposComRisco.filter(c => c.nivelRisco === filtroNivel)
    : corposComRisco;

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            {/* Linha do título */}
            <View style={styles.headerTitleRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/home_manager' as any)} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Mapa Estratégico</Text>
                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Monitoramento ambiental da região gerenciada
                </Text>
              </View>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setFiltrosVisible(true)}>
                <Ionicons name="filter" size={15} color="#fff" />
                <Text style={[styles.headerBtnLabel, { fontFamily: questrial }]}>Filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setLayersVisible(true)}>
                <Ionicons name="layers" size={15} color="#fff" />
                <Text style={[styles.headerBtnLabel, { fontFamily: questrial }]}>Camadas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => router.push('/(tabs)/alerts' as any)}
              >
                <View>
                  <Ionicons name="notifications" size={15} color="#fff" />
                  {totalAlertas > 0 && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertBadgeText}>{totalAlertas > 9 ? '9+' : totalAlertas}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.headerBtnLabel, { fontFamily: questrial }]}>Alertas</Text>
              </TouchableOpacity>
            </View>

            {/* Linha de busca */}
            <View style={styles.searchRow}>
              <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
                <Ionicons name="search-outline" size={15} color={TEXT_MUTED} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { fontFamily: questrial }]}
                  placeholder="Buscar corpo hídrico, região ou ocorrência..."
                  placeholderTextColor={TEXT_MUTED}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => { setTimeout(() => setSearchFocused(false), 150); }}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={15} color={TEXT_MUTED} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.tipoMapaBtn} onPress={() => setMapTypeVisible(true)}>
                <Ionicons name="map-outline" size={13} color={PRIMARY} />
                <Text style={[styles.tipoMapaText, { fontFamily: questrial }]}>Tipos de mapa</Text>
                <Ionicons name="chevron-down" size={11} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ LEGENDA ══ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendaRow}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 7, gap: 8 }}
        >
          {(Object.entries(NIVEL_CONFIG) as [NivelRisco, typeof NIVEL_CONFIG[NivelRisco]][]).map(([nivel, cfg]) => (
            <TouchableOpacity
              key={nivel}
              style={[
                styles.legendaChip,
                filtroNivel === nivel && { borderColor: cfg.color, backgroundColor: cfg.color + '18' },
              ]}
              onPress={() => setFiltroNivel(prev => prev === nivel ? null : nivel)}
            >
              <View style={[styles.legendaDot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.legendaChipText, { fontFamily: questrial }]}>{cfg.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ══ DROPDOWN DE BUSCA ══ */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id ?? item.nome}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSearchQuery('');
                    setSearchFocused(false);
                    setSearchResults([]);
                    mapRef.current?.animateToRegion({
                      latitude: item.latitude, longitude: item.longitude,
                      latitudeDelta: 0.04, longitudeDelta: 0.04,
                    }, 900);
                    handleSelectCorpo(item);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dropdownIcon, { backgroundColor: NIVEL_CONFIG[item.nivelRisco].color }]}>
                    <Ionicons name={NIVEL_CONFIG[item.nivelRisco].icon} size={13} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownName, { fontFamily: questrial }]} numberOfLines={1}>{item.nome}</Text>
                    {item.municipio && (
                      <Text style={[styles.dropdownSub, { fontFamily: questrial }]}>{item.municipio}</Text>
                    )}
                  </View>
                  <RiscoChip nivel={item.nivelRisco} />
                  <Ionicons name="chevron-forward" size={15} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: BORDER_LIGHT, marginHorizontal: 12 }} />
              )}
            />
          </View>
        )}

        {/* ══ ÁREA DO MAPA ══ */}
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={REGIAO_INICIAL}
            mapType={tipoMapa as any}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass
            onPress={() => {
              if (searchFocused) { Keyboard.dismiss(); setSearchFocused(false); }
            }}
          >
            {visibilidade.municipios && (
              <Geojson
                geojson={municipiosData as any}
                strokeColor={(tipoMapa === 'standard' || tipoMapa === 'terrain') ? '#FF8C00' : '#FFFFFF'}
                fillColor="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            )}
            <Geojson
              geojson={stateData as any}
              fillColor="rgba(255,0,0,0)"
              strokeColor="#FF0000"
              strokeWidth={3}
            />
            {visibilidade.corposHidricos && corposFiltrados.map(item => (
              <Marker
                key={`ch-${item.id}`}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                onPress={() => handleSelectCorpo(item)}
              >
                <View style={[
                  styles.customMarker,
                  { backgroundColor: NIVEL_CONFIG[item.nivelRisco].color },
                  item.nivelRisco === 'critico' && styles.markerCritico,
                ]}>
                  <Ionicons name={NIVEL_CONFIG[item.nivelRisco].icon} size={13} color="#fff" />
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Botões laterais */}
          <View style={styles.sideControls}>
            <TouchableOpacity style={styles.botaoCircular} onPress={goToMyLocation}>
              <Ionicons name="locate" size={20} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botaoCircular, { marginTop: 8 }]}
              onPress={() => mapRef.current?.animateToRegion(REGIAO_INICIAL, 800)}
            >
              <Ionicons name="expand-outline" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* ══ BOTTOM SHEET ══ */}
          {selectedCorpo && (
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Handle */}
                <View style={styles.sheetHandleRow}>
                  <View style={styles.sheetHandle} />
                </View>

                {/* Cabeçalho do corpo selecionado */}
                <View style={styles.sheetHeaderRow}>
                  <View style={styles.sheetBodyIcon}>
                    <Ionicons name="water" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.sheetBodyName, { fontFamily: questrial }]} numberOfLines={1}>
                      {selectedCorpo.nome}
                    </Text>
                    <Text style={[styles.sheetBodyLocation, { fontFamily: questrial }]}>
                      {[selectedCorpo.municipio, 'PE'].filter(Boolean).join(' • ')}
                      {selectedCorpo.macroRH ? ` ${selectedCorpo.macroRH}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <RiscoChip nivel={selectedCorpo.nivelRisco} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: NIVEL_CONFIG[selectedCorpo.nivelRisco].color }} />
                      <Text style={[{ fontSize: 11, color: NIVEL_CONFIG[selectedCorpo.nivelRisco].color, fontWeight: '600' }, { fontFamily: questrial }]}>
                        {NIVEL_CONFIG[selectedCorpo.nivelRisco].subtitulo}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={{ marginLeft: 6 }} onPress={fecharDetalhe}>
                    <Ionicons name="chevron-down" size={22} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>

                {lastUpdate !== '' && (
                  <Text style={[styles.sheetUpdateTime, { fontFamily: questrial }]}>
                    Última atualização • Hoje • {lastUpdate}
                  </Text>
                )}

                {/* Stats */}
                {loadingDetalhe ? (
                  <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ paddingVertical: 4 }}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                  >
                    <StatCard
                      icon="flask-outline"
                      label="pH médio"
                      value={detalheCarregado?.phMedio != null
                        ? detalheCarregado.phMedio.toFixed(1)
                        : '—'
                      }
                      sub={detalheCarregado?.phMedio != null
                        ? (detalheCarregado.phMedio < 6.5 ? 'Ácido' : detalheCarregado.phMedio > 7.5 ? 'Básico' : 'Neutro')
                        : 'Sem dados'
                      }
                      subColor={detalheCarregado?.phMedio != null && detalheCarregado.phMedio < 6.5 ? '#EF4444' : '#9CA3AF'}
                      fontFamily={questrial}
                    />
                    <StatCard
                      icon="cloud-outline"
                      label="Odor"
                      value={detalheCarregado?.odorMaisFrequente ?? 'Sem dados'}
                      sub={detalheCarregado?.odorMaisFrequente ? 'Recorrente' : ''}
                      subColor="#F97316"
                      fontFamily={questrial}
                    />
                    <StatCard
                      icon="megaphone-outline"
                      label="Denúncias"
                      value={String(detalheCarregado?.totalDenuncias ?? 0)}
                      sub={`${detalheCarregado?.recorrencia ?? '—'} recorrência`}
                      subColor="#8B5CF6"
                      fontFamily={questrial}
                    />
                    <StatCard
                      icon="trending-up-outline"
                      label="Recorrência"
                      value={detalheCarregado?.recorrencia ?? '—'}
                      sub=""
                      subColor="#EF4444"
                      fontFamily={questrial}
                    />
                    <StatCard
                      icon="people-outline"
                      label="Equipes atuando"
                      value={String(detalheCarregado?.equipes ?? 0)}
                      sub={detalheCarregado?.equipes ? 'Em campo' : 'Nenhuma'}
                      subColor={detalheCarregado?.equipes ? '#22C55E' : '#9CA3AF'}
                      fontFamily={questrial}
                    />
                  </ScrollView>
                )}

                {/* Gráfico de evolução */}
                <View style={styles.chartSection}>
                  <Text style={[styles.chartTitle, { fontFamily: questrial }]}>
                    Evolução do risco{' '}
                    <Text style={{ color: TEXT_MUTED, fontWeight: '400' }}>(últimos 7 dias)</Text>
                  </Text>
                  <RiskChart nivel={selectedCorpo.nivelRisco} fontFamily={questrial} />
                </View>

                {/* Ações */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.actionPrimary}
                    onPress={() => router.push('/(tabs)/critical_analyses' as any)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#004d48', '#0a6b5e']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.actionPrimaryGradient}
                    >
                      <Ionicons name="bar-chart-outline" size={18} color="#fff" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actionPrimaryLabel, { fontFamily: questrial }]}>Ver análise</Text>
                        <Text style={[styles.actionPrimarySub, { fontFamily: questrial }]}>Detalhes e histórico</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => router.push('/(tabs)/manage_technicians' as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="people-outline" size={18} color={PRIMARY} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionSecondaryLabel, { fontFamily: questrial }]}>Encaminhar equipe</Text>
                      <Text style={[styles.actionSecondarySub, { fontFamily: questrial }]}>Enviar equipe técnica</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 12 }} />
              </ScrollView>
            </Animated.View>
          )}
        </View>

        {/* ══ BOTTOM NAV ══ */}
        <ManagerBottomNav activeTab="mapa" fontFamily={questrial} />

        {/* ══ MODAL: Tipo de mapa ══ */}
        <Modal visible={mapTypeVisible} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setMapTypeVisible(false)}>
            <View style={styles.menuCard}>
              <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Estilo do Mapa</Text>
              {['standard', 'satellite', 'hybrid', 'terrain'].map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.menuItem, tipoMapa === mode && styles.menuItemAtivo]}
                  onPress={() => { setTipoMapa(mode); setMapTypeVisible(false); }}
                >
                  <Text style={[styles.menuItemText, { fontFamily: questrial }, tipoMapa === mode && styles.menuItemTextAtivo]}>
                    {mode.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ══ MODAL: Camadas ══ */}
        <Modal visible={layersVisible} animationType="slide" transparent>
          <View style={styles.modalOverlayBottom}>
            <View style={styles.menuBottom}>
              <View style={styles.menuHeader}>
                <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Camadas Ativas</Text>
                <TouchableOpacity onPress={() => setLayersVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 16 }} />
              {[
                { key: 'municipios', label: 'MUNICÍPIOS' },
                { key: 'corposHidricos', label: 'CORPOS HÍDRICOS' },
              ].map(item => (
                <View key={item.key} style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { fontFamily: questrial }]}>{item.label}</Text>
                  <TouchableOpacity
                    style={[styles.toggle, visibilidade[item.key as keyof typeof visibilidade] && styles.toggleAtivo]}
                    onPress={() =>
                      setVisibilidade(p => ({ ...p, [item.key]: !p[item.key as keyof typeof visibilidade] }))
                    }
                  >
                    <View style={[
                      styles.toggleCircle,
                      visibilidade[item.key as keyof typeof visibilidade] && styles.toggleCircleAtivo,
                    ]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </Modal>

        {/* ══ MODAL: Filtros ══ */}
        <Modal visible={filtrosVisible} animationType="slide" transparent>
          <View style={styles.modalOverlayBottom}>
            <View style={styles.menuBottom}>
              <View style={styles.menuHeader}>
                <Text style={[styles.menuTitle, { fontFamily: questrial }]}>Filtrar por Nível de Risco</Text>
                <TouchableOpacity onPress={() => setFiltrosVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 16 }} />
              {([
                [null, 'Todos os níveis', PRIMARY],
                ['critico', 'Crítico', '#EF4444'],
                ['atencao', 'Atenção', '#F97316'],
                ['normal', 'Normal', '#22C55E'],
                ['semDados', 'Sem dados', '#9CA3AF'],
                ['recorrente', 'Denúncias recorrentes', '#8B5CF6'],
              ] as [NivelRisco | null, string, string][]).map(([nivel, label, color]) => (
                <TouchableOpacity
                  key={String(nivel)}
                  style={[styles.menuItem, filtroNivel === nivel && styles.menuItemAtivo]}
                  onPress={() => { setFiltroNivel(nivel); setFiltrosVisible(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                    <Text style={[
                      styles.menuItemText, { fontFamily: questrial },
                      filtroNivel === nivel && styles.menuItemTextAtivo,
                    ]}>
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerGradient: {},
  headerSafe: { paddingBottom: 10 },
  headerTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8,
    gap: 5,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 2,
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 9.5, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  headerBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, gap: 2,
  },
  headerBtnLabel: { fontSize: 9, color: '#fff', fontWeight: '600' },
  alertBadge: {
    position: 'absolute', top: -4, right: -5,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 13, height: 13,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  alertBadgeText: { fontSize: 7.5, color: '#fff', fontWeight: '800' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  searchBarFocused: { shadowOpacity: 0.22, elevation: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#333' },
  tipoMapaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  tipoMapaText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  legendaRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT,
    maxHeight: 44,
  },
  legendaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#fff',
  },
  legendaDot: { width: 8, height: 8, borderRadius: 4 },
  legendaChipText: { fontSize: 11, color: '#374151', fontWeight: '500' },
  searchDropdown: {
    position: 'absolute', left: 0, right: 0, zIndex: 200,
    top: Platform.OS === 'ios' ? 182 : 166,
    backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 16, maxHeight: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 10, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14, gap: 10,
  },
  dropdownIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dropdownName: { fontSize: 13, color: '#333', fontWeight: '600' },
  dropdownSub: { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },
  customMarker: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  markerCritico: {
    shadowColor: '#EF4444', shadowOpacity: 0.7, shadowRadius: 8, elevation: 10,
  },
  sideControls: { position: 'absolute', right: 12, bottom: 12 },
  botaoCircular: {
    backgroundColor: 'rgba(255,255,255,0.95)', padding: 11, borderRadius: 26,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 18,
    maxHeight: SCREEN_HEIGHT * 0.58,
  },
  sheetHandleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  sheetBodyIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E6F4F1', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sheetBodyName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sheetBodyLocation: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  sheetUpdateTime: {
    fontSize: 11, color: TEXT_MUTED,
    paddingHorizontal: 16, marginBottom: 6,
  },
  statCard: {
    backgroundColor: SURFACE, borderRadius: 10,
    padding: 10, minWidth: 88, alignItems: 'flex-start', gap: 2,
  },
  statLabel: { fontSize: 10, color: TEXT_MUTED, marginTop: 3 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statSub: { fontSize: 10, fontWeight: '600' },
  chartSection: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sheetActions: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 8 },
  actionPrimary: { borderRadius: 12, overflow: 'hidden' },
  actionPrimaryGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  actionPrimaryLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  actionPrimarySub: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: BORDER_LIGHT,
  },
  actionSecondaryLabel: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  actionSecondarySub: { fontSize: 10, color: TEXT_MUTED, marginTop: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.97)', width: '100%',
    borderRadius: 20, padding: 20, elevation: 6,
  },
  menuTitle: { fontSize: 17, fontWeight: '700', color: PRIMARY, marginBottom: 14, letterSpacing: 0.3 },
  menuItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuItemAtivo: {
    backgroundColor: 'rgba(0,77,72,0.08)', borderRadius: 8,
    paddingHorizontal: 10, borderBottomWidth: 0,
  },
  menuItemText: { fontSize: 14, color: TEXT_MUTED, fontWeight: '500' },
  menuItemTextAtivo: { fontWeight: '700', color: PRIMARY },
  modalOverlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
  },
  menuBottom: {
    backgroundColor: 'rgba(255,255,255,0.98)', width: '100%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
    maxHeight: '65%', elevation: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  menuHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 12,
    backgroundColor: '#f9fafa', marginBottom: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0',
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  toggle: {
    width: 48, height: 26, backgroundColor: '#ddd',
    borderRadius: 13, padding: 2, justifyContent: 'center',
  },
  toggleAtivo: { backgroundColor: PRIMARY },
  toggleCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignSelf: 'flex-start',
  },
  toggleCircleAtivo: { alignSelf: 'flex-end' },
});