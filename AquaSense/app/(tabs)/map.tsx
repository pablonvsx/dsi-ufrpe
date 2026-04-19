// AquaSense/app/(tabs)/map.tsx
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ScrollView, Modal } from 'react-native';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE, MapTypes } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Importação do Serviço Geográfico
import { obterContextoGeografico } from '../../services/geoService';

// Importação das camadas geoespaciais
import stateData from '../../assets/map_layers/pe_aquasense.json';
import biomasData from '../../assets/map_layers/biomas_aquasense.json';
import macroData from '../../assets/map_layers/macro_rh_aquasense.json';
import mesoData from '../../assets/map_layers/meso_rh_aquasense.json';
import microData from '../../assets/map_layers/micro_rh_aquasense.json';
import municipiosData from '../../assets/map_layers/municipios_pe.json';
import riversData from '../../assets/map_layers/rivers_aquasense.json';

const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  
  const [mapTypeVisible, setMapTypeVisible] = useState(false);
  const [layersVisible, setLayersVisible] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<string>('satellite');
  const [modoInteligencia, setModoInteligencia] = useState(false);
  
  // Novos estados para o teste de Contexto Geográfico
  const [pontoSelecionado, setPontoSelecionado] = useState<{latitude: number, longitude: number} | null>(null);
  const [contextoExibicao, setContextoExibicao] = useState<any>(null);

  // Estado para camadas RH (apenas 1 ativa por vez)
  const [cemadasRHAtiva, setCemadasRHAtiva] = useState<'macro' | 'meso' | 'micro' | null>(null);

  const [visibilidade, setVisibilidade] = useState({
    municipios: true,
    biomas: false,
    rivers: false,
  });

  // Effect para carregar a localização do dispositivo ao abrir o mapa
  useEffect(() => {
    const loadUserLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permissão de localização negada');
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({});
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 1000);
        }
      } catch (error) {
        console.log('Erro ao obter localização:', error);
      }
    };

    loadUserLocation();
  }, []);

  // Função disparada ao tocar no mapa
  const handleMapPress = (e: any) => {
    // Só ativa inteligência territorial se estiver em modo inteligência
    if (!modoInteligencia) return;
    
    const { latitude, longitude } = e.nativeEvent.coordinate;
    
    // 1. Salva a coordenada para desenhar o marcador
    setPontoSelecionado({ latitude, longitude });

    // 2. Chama o serviço para descobrir onde o usuário clicou
    const contexto = obterContextoGeografico(latitude, longitude);
    
    // 3. Salva o resultado para exibir na tela
    setContextoExibicao(contexto);
  };

  const goToMyLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    let location = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);
  };

  const resetNorth = () => {
    mapRef.current?.animateCamera({ heading: 0 }, { duration: 1000 });
  };

  // Cores disponíveis para diferentes regiões
  const colors = [
    { fill: 'rgba(255, 99, 71, 0.45)', stroke: 'rgba(255, 99, 71, 0.45)' },    // Tomato
    { fill: 'rgba(70, 130, 180, 0.45)', stroke: 'rgba(70, 130, 180, 0.45)' },  // Steel Blue
    { fill: 'rgba(34, 139, 34, 0.45)', stroke: 'rgba(34, 139, 34, 0.45)' },    // Forest Green
    { fill: 'rgba(184, 134, 11, 0.45)', stroke: 'rgba(184, 134, 11, 0.45)' },  // Dark Goldenrod
    { fill: 'rgba(139, 69, 19, 0.45)', stroke: 'rgba(139, 69, 19, 0.45)' },    // Saddle Brown
    { fill: 'rgba(47, 79, 79, 0.45)', stroke: 'rgba(47, 79, 79, 0.45)' },      // Dark Slate Gray
    { fill: 'rgba(100, 149, 237, 0.45)', stroke: 'rgba(100, 149, 237, 0.45)' }, // Cornflower Blue
    { fill: 'rgba(210, 105, 30, 0.45)', stroke: 'rgba(210, 105, 30, 0.45)' },  // Chocolate
  ];

  // Separar biomas por tipo
  const biomasCaatinga = {
    ...biomasData,
    features: (biomasData as any).features.filter((feature: any) => feature.properties?.nm_bm === 'Caatinga')
  };

  const biomasMataAtlantica = {
    ...biomasData,
    features: (biomasData as any).features.filter((feature: any) => feature.properties?.nm_bm === 'Mata Atlântica')
  };

  // Separar macro RH por região
  const macroRegions = [...new Set((macroData as any).features.map((f: any) => f.properties?.nm_macroRH))].filter(Boolean) as string[];
  const macroSubsets = macroRegions.map((region, idx) => ({
    region,
    data: {
      ...macroData,
      features: (macroData as any).features.filter((feature: any) => feature.properties?.nm_macroRH === region)
    },
    color: colors[idx % colors.length]
  }));

  // Separar meso RH por região
  const mesoRegions = [...new Set((mesoData as any).features.map((f: any) => f.properties?.nm_mesoRH))].filter(Boolean) as string[];
  const mesoSubsets = mesoRegions.map((region, idx) => ({
    region,
    data: {
      ...mesoData,
      features: (mesoData as any).features.filter((feature: any) => feature.properties?.nm_mesoRH === region)
    },
    color: colors[idx % colors.length]
  }));

  // Separar micro RH por região
  const microRegions = [...new Set((microData as any).features.map((f: any) => f.properties?.nm_microRH))].filter(Boolean) as string[];
  const microSubsets = microRegions.map((region, idx) => ({
    region,
    data: {
      ...microData,
      features: (microData as any).features.filter((feature: any) => feature.properties?.nm_microRH === region)
    },
    color: colors[idx % colors.length]
  }));

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.mapa}
        provider={PROVIDER_GOOGLE}
        initialRegion={REGIAO_INICIAL}
        mapType={tipoMapa as any}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={handleMapPress}
      >
        {/* Camadas controláveis */}
        {visibilidade.biomas && biomasCaatinga.features.length > 0 && <Geojson geojson={biomasCaatinga as any} fillColor="rgba(210, 105, 30, 0.25)" strokeColor="rgba(210, 105, 30, 0.25)" strokeWidth={0.5} />}
        {visibilidade.biomas && biomasMataAtlantica.features.length > 0 && <Geojson geojson={biomasMataAtlantica as any} fillColor="rgba(34, 139, 34, 0.25)" strokeColor="rgba(34, 139, 34, 0.25)" strokeWidth={0.5} />}
        {cemadasRHAtiva === 'macro' && macroSubsets.map(subset => (
          <Geojson key={String(subset.region)} geojson={subset.data as any} fillColor={subset.color.fill} strokeColor={subset.color.stroke} strokeWidth={0.5} />
        ))}
        {cemadasRHAtiva === 'meso' && mesoSubsets.map(subset => (
          <Geojson key={String(subset.region)} geojson={subset.data as any} fillColor={subset.color.fill} strokeColor={subset.color.stroke} strokeWidth={0.5} />
        ))}
        {cemadasRHAtiva === 'micro' && microSubsets.map(subset => (
          <Geojson key={String(subset.region)} geojson={subset.data as any} fillColor={subset.color.fill} strokeColor={subset.color.stroke} strokeWidth={0.5} />
        ))}
        {visibilidade.municipios && <Geojson geojson={municipiosData as any} strokeColor={(tipoMapa === 'standard' || tipoMapa === 'terrain') ? '#FF8C00' : '#FFFFFF'} fillColor="rgba(255, 255, 255, 0.1)" strokeWidth={1} />}
        {visibilidade.rivers && <Geojson geojson={riversData as any} strokeColor="#1E90FF" strokeWidth={1.5} />}

        {/* Camada fixa de Pernambuco - sempre por cima */}
        <Geojson geojson={stateData as any} fillColor="rgba(255, 0, 0, 0)" strokeColor="#FF0000" strokeWidth={3} />

        {/* Marcador do ponto clicado */}
        {pontoSelecionado && (
          <Marker 
            coordinate={pontoSelecionado} 
            pinColor="#F1C40F"
            title="Local da Coleta"
          />
        )}
      </MapView>

      {/* CARD FLUTUANTE DE RESULTADO (Exibido apenas quando há um clique) */}
      {contextoExibicao && (
        <View style={styles.cardContexto}>
          <View style={styles.cardContextoHeader}>
            <Text style={styles.cardTitle}>Inteligência Territorial</Text>
            <TouchableOpacity onPress={() => { setContextoExibicao(null); setPontoSelecionado(null); }}>
              <Ionicons name="close" size={20} color="#004d48" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.cardText}><Text style={styles.bold}>Município:</Text> {contextoExibicao.municipio}</Text>
          <Text style={styles.cardText}><Text style={styles.bold}>Microbacia:</Text> {contextoExibicao.microRH}</Text>
          <Text style={styles.cardText}><Text style={styles.bold}>Mesobacia:</Text> {contextoExibicao.mesoRH}</Text>
          <Text style={styles.cardText}><Text style={styles.bold}>Macrobacia:</Text> {contextoExibicao.macroRH}</Text>
          <Text style={styles.cardText}><Text style={styles.bold}>Bioma:</Text> {contextoExibicao.bioma}</Text>
          <Text style={styles.cardText}><Text style={styles.bold}>Corpo hídrico:</Text> {contextoExibicao.rio}</Text>
        </View>
      )}

      {/* BOTÕES LATERAIS (INFERIOR DIREITO) */}
      <View style={styles.controlesDireita}>
        <TouchableOpacity style={styles.botaoCircular} onPress={() => setMapTypeVisible(true)}>
          <Ionicons name="map" size={24} color="#004d48" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoCircular, { marginTop: 12 }]} onPress={() => setLayersVisible(true)}>
          <Ionicons name="layers" size={24} color="#004d48" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoCircular, { marginTop: 12 }, modoInteligencia && styles.botaoCircularAtivo]} onPress={() => {
          setModoInteligencia(!modoInteligencia);
          if (modoInteligencia) {
            setContextoExibicao(null);
            setPontoSelecionado(null);
          }
        }}>
          <Ionicons name="information-circle" size={26} color={modoInteligencia ? '#FFF' : '#004d48'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoCircular, { marginTop: 12 }]} onPress={resetNorth}>
          <Ionicons name="arrow-up" size={26} color="#004d48" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoCircular, { marginTop: 12 }]} onPress={goToMyLocation}>
          <Ionicons name="locate" size={26} color="#004d48" />
        </TouchableOpacity>
      </View>

      {/* MODAL: TIPO DE MAPA */}
      <Modal visible={mapTypeVisible} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMapTypeVisible(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Estilo do Mapa</Text>
            {['standard', 'satellite', 'hybrid', 'terrain'].map((mode) => (
              <TouchableOpacity 
                key={mode} 
                style={[styles.itemMenu, tipoMapa === mode && styles.itemAtivo]}
                onPress={() => { setTipoMapa(mode); setMapTypeVisible(false); }}
              >
                <Text style={[styles.textoItem, tipoMapa === mode && styles.textoAtivo]}>{mode.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: CAMADAS */}
      <Modal visible={layersVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuBottom}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Camadas Ativas</Text>
              <TouchableOpacity onPress={() => setLayersVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#004d48" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Camadas Simples (com toggle) */}
              <Text style={styles.secaoTitulo}>Camadas Gerais</Text>
              {Object.keys(visibilidade).map((key) => (
                <View key={key} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{key.toUpperCase()}</Text>
                  <TouchableOpacity 
                    style={[styles.toggle, visibilidade[key as keyof typeof visibilidade] && styles.toggleAtivo]}
                    onPress={() => setVisibilidade(p => ({...p, [key]: !p[key as keyof typeof visibilidade]}))}
                  >
                    <View style={[styles.toggleCircle, visibilidade[key as keyof typeof visibilidade] && styles.toggleCircleAtivo]} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Camadas RH (exclusivas) */}
              <Text style={[styles.secaoTitulo, { marginTop: 20 }]}>Regiões Hidrográficas</Text>
              <Text style={styles.secaoDesc}>Apenas uma camada por vez</Text>
              
              {['macro', 'meso', 'micro'].map((layer) => (
                <View key={layer} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{layer === 'macro' ? 'MACRO RH' : layer === 'meso' ? 'MESO RH' : 'MICRO RH'}</Text>
                  <TouchableOpacity 
                    style={[styles.toggle, cemadasRHAtiva === layer && styles.toggleAtivo]}
                    onPress={() => setCemadasRHAtiva(cemadasRHAtiva === layer ? null : (layer as 'macro' | 'meso' | 'micro'))}
                  >
                    <View style={[styles.toggleCircle, cemadasRHAtiva === layer && styles.toggleCircleAtivo]} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const BORDER_RADIUS = 50;
const PRIMARY = '#004d48';

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapa: { flex: 1 },
  
  // Estilos do Card de Inteligência Territorial
  cardContexto: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 10,
  },
  cardContextoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: PRIMARY },
  cardText: { fontSize: 14, color: '#6b7a7a', marginBottom: 4 },
  bold: { fontWeight: 'bold', color: PRIMARY },

  // Controles de botões
  controlesDireita: { position: 'absolute', bottom: 40, left: 20 },
  botaoCircular: { backgroundColor: 'rgba(255, 255, 255, 0.92)', padding: 12, borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, alignItems: 'center', justifyContent: 'center' },
  botaoCircularAtivo: { backgroundColor: '#004d48' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuCard: { backgroundColor: 'rgba(255, 255, 255, 0.95)', width: '75%', borderRadius: BORDER_RADIUS, padding: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 },
  menuBottom: { backgroundColor: 'rgba(255, 255, 255, 0.95)', width: '100%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, position: 'absolute', bottom: 0, maxHeight: '60%', elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0, 77, 72, 0.1)', paddingBottom: 12 },
  menuTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY, letterSpacing: 0.3 },
  itemMenu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemAtivo: { backgroundColor: 'rgba(63, 243, 231, 0.15)', borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0 },
  textoItem: { fontSize: 15, color: '#6b7a7a', fontWeight: '500' },
  textoAtivo: { fontWeight: '700', color: PRIMARY },
  camadaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  camadaText: { fontSize: 16, fontWeight: '500', color: PRIMARY },

  // Estilos dos Toggles
  secaoTitulo: { fontSize: 14, fontWeight: '700', color: PRIMARY, marginBottom: 12, marginTop: 8, letterSpacing: 0.5 },
  secaoDesc: { fontSize: 12, color: '#999', marginBottom: 12, marginTop: -8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#f9fafa', marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  toggle: { width: 50, height: 28, backgroundColor: '#ddd', borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleAtivo: { backgroundColor: PRIMARY },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleCircleAtivo: { alignSelf: 'flex-end' },
});