// AquaSense/app/(tabs)/map.tsx
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ScrollView, Modal } from 'react-native';
import MapView, { Marker, Geojson, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Importação do Serviço Geográfico
import { obterContextoGeografico } from '../../services/geoService';
import { db } from '../../config/firebase';
import { CorpoHidrico, PontoDeUso } from '../../types/water_bodies';

// Importação das camadas geoespaciais
import stateData from '../../assets/map_layers/pe_aquasense.json';
import municipiosData from '../../assets/map_layers/municipios_pe.json';

const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

type DetalheMapa =
  | { tipo: 'corpoHidrico'; dado: CorpoHidrico }
  | { tipo: 'pontoDeUso'; dado: PontoDeUso };

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  
  const [mapTypeVisible, setMapTypeVisible] = useState(false);
  const [layersVisible, setLayersVisible] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<string>('satellite');
  const [modoInteligencia, setModoInteligencia] = useState(false);
  
  // Novos estados para o teste de Contexto Geográfico
  const [pontoSelecionado, setPontoSelecionado] = useState<{latitude: number, longitude: number} | null>(null);
  const [contextoExibicao, setContextoExibicao] = useState<any>(null);
  const [corposHidricosValidados, setCorposHidricosValidados] = useState<CorpoHidrico[]>([]);
  const [pontosDeUsoValidados, setPontosDeUsoValidados] = useState<PontoDeUso[]>([]);
  const [detalheSelecionado, setDetalheSelecionado] = useState<DetalheMapa | null>(null);
  const [detalheModalVisible, setDetalheModalVisible] = useState(false);

  const [visibilidade, setVisibilidade] = useState({
    municipios: true,
    corposHidricos: true,
    pontosDeUso: true,
  });

  const labelsCamadas: Record<keyof typeof visibilidade, string> = {
    municipios: 'MUNICIPIOS',
    corposHidricos: 'CORPOS HIDRICOS',
    pontosDeUso: 'PONTOS DE USO',
  };

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

  useEffect(() => {
    const carregarPontosValidados = async () => {
      try {
        const [corposSnapshot, pontosSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'corposHidricos'), where('cadastroValido', '==', true))),
          getDocs(query(collection(db, 'pontosDeUso'), where('cadastroValido', '==', true))),
        ]);

        const corpos = corposSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as CorpoHidrico))
          .filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number');

        const pontos = pontosSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as PontoDeUso))
          .filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number');

        setCorposHidricosValidados(corpos);
        setPontosDeUsoValidados(pontos);
      } catch (error) {
        console.log('Erro ao carregar pontos validados:', error);
      }
    };

    carregarPontosValidados();
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

  const abrirDetalhes = (detalhe: DetalheMapa) => {
    setDetalheSelecionado(detalhe);
    setDetalheModalVisible(true);
  };

  const fecharDetalhes = () => {
    setDetalheModalVisible(false);
    setDetalheSelecionado(null);
  };

  const formatarTiposUso = (tipo: PontoDeUso['tipoDeUso']) => {
    if (Array.isArray(tipo)) return tipo.join(', ');
    return tipo;
  };

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
        {visibilidade.municipios && <Geojson geojson={municipiosData as any} strokeColor={(tipoMapa === 'standard' || tipoMapa === 'terrain') ? '#FF8C00' : '#FFFFFF'} fillColor="rgba(255, 255, 255, 0.1)" strokeWidth={1} />}

        {/* Marcadores de registros validados */}
        {visibilidade.corposHidricos && corposHidricosValidados.map((item) => (
          <Marker
            key={`ch-${item.id ?? `${item.latitude}-${item.longitude}`}`}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            title={item.nome || 'Corpo hidrico'}
            description={`Tipo: ${item.tipo}`}
            onPress={() => abrirDetalhes({ tipo: 'corpoHidrico', dado: item })}
          >
            <View style={[styles.customMarker, styles.markerCorpoHidrico]}>
              <Ionicons name="water" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        ))}

        {visibilidade.pontosDeUso && pontosDeUsoValidados.map((item) => (
          <Marker
            key={`pu-${item.id ?? `${item.latitude}-${item.longitude}`}`}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            title={item.nomeLocalPopular || formatarTiposUso(item.tipoDeUso)}
            description={`Uso: ${formatarTiposUso(item.tipoDeUso)}`}
            onPress={() => abrirDetalhes({ tipo: 'pontoDeUso', dado: item })}
          >
            <View style={[styles.customMarker, styles.markerPontoDeUso]}>
              <Ionicons name="location" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        ))}

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
              {(Object.keys(visibilidade) as Array<keyof typeof visibilidade>).map((key) => (
                <View key={key} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{labelsCamadas[key]}</Text>
                  <TouchableOpacity 
                    style={[styles.toggle, visibilidade[key as keyof typeof visibilidade] && styles.toggleAtivo]}
                    onPress={() => setVisibilidade(p => ({...p, [key]: !p[key as keyof typeof visibilidade]}))}
                  >
                    <View style={[styles.toggleCircle, visibilidade[key as keyof typeof visibilidade] && styles.toggleCircleAtivo]} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: DETALHES DO PONTO */}
      <Modal visible={detalheModalVisible} transparent animationType="fade" onRequestClose={fecharDetalhes}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={fecharDetalhes}>
          <TouchableOpacity activeOpacity={1} style={styles.detailsCard} onPress={() => {}}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>
                {detalheSelecionado?.tipo === 'corpoHidrico' ? 'Corpo Hidrico' : 'Ponto de Uso'}
              </Text>
              <TouchableOpacity onPress={fecharDetalhes}>
                <Ionicons name="close" size={22} color="#004d48" />
              </TouchableOpacity>
            </View>

            {detalheSelecionado?.tipo === 'corpoHidrico' && (
              <View>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Nome:</Text> {detalheSelecionado.dado.nome}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Tipo:</Text> {detalheSelecionado.dado.tipo}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Municipio:</Text> {detalheSelecionado.dado.municipio}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Bioma:</Text> {detalheSelecionado.dado.bioma}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Macro RH:</Text> {detalheSelecionado.dado.macroRH}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Meso RH:</Text> {detalheSelecionado.dado.mesoRH}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Micro RH:</Text> {detalheSelecionado.dado.microRH}</Text>
                {detalheSelecionado.dado.comentario && (
                  <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Comentario:</Text> {detalheSelecionado.dado.comentario}</Text>
                )}
              </View>
            )}

            {detalheSelecionado?.tipo === 'pontoDeUso' && (
              <View>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Tipos de uso:</Text> {formatarTiposUso(detalheSelecionado.dado.tipoDeUso)}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Nome local:</Text> {detalheSelecionado.dado.nomeLocalPopular || 'Nao informado'}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Referencia:</Text> {detalheSelecionado.dado.nomeCorpoHidricoReferencia || 'Nao informada'}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Frequencia:</Text> {detalheSelecionado.dado.frequenciaUso || 'Nao informada'}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Municipio:</Text> {detalheSelecionado.dado.municipio}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Bioma:</Text> {detalheSelecionado.dado.bioma}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Macro RH:</Text> {detalheSelecionado.dado.macroRH}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Meso RH:</Text> {detalheSelecionado.dado.mesoRH}</Text>
                <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Micro RH:</Text> {detalheSelecionado.dado.microRH}</Text>
                {detalheSelecionado.dado.comentario && (
                  <Text style={styles.detailsLine}><Text style={styles.detailsLabel}>Comentario:</Text> {detalheSelecionado.dado.comentario}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#f9fafa', marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  toggle: { width: 50, height: 28, backgroundColor: '#ddd', borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleAtivo: { backgroundColor: PRIMARY },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleCircleAtivo: { alignSelf: 'flex-end' },

  // Modal de detalhes de marcador
  detailsCard: {
    width: '88%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 18,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eeee',
    paddingBottom: 8,
  },
  detailsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PRIMARY,
  },
  detailsLine: {
    fontSize: 14,
    color: '#5f6f6f',
    marginBottom: 6,
  },
  detailsLabel: {
    fontWeight: '700',
    color: PRIMARY,
  },

  // Marcadores customizados para diferenciar tipos de ponto
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  markerCorpoHidrico: {
    backgroundColor: '#0B63CE',
  },
  markerPontoDeUso: {
    backgroundColor: '#D35400',
  },
});