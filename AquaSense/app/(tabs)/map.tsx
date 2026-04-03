// AquaSense/app/(tabs)/map.tsx
// Tela principal de mapa, exibe os rios, alertas e permite a navegação para detalhes.

import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

// Configurações Iniciais Temporárias
const REGIAO_INICIAL = {
  latitude: -8.28,
  longitude: -37.95,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

const PONTOS_EXEMPLO = [
  {
    id: '1',
    nome: 'Rio Capibaribe — Recife',
    latitude: -8.0476,
    longitude: -34.9023,
    status: 'grave',
  },
  {
    id: '2',
    nome: 'Açude de Itaparica',
    latitude: -8.6069,
    longitude: -38.3058,
    status: 'normal',
  },
  {
    id: '3',
    nome: 'Rio Ipojuca — Caruaru',
    latitude: -8.2760,
    longitude: -35.9753,
    status: 'atencao',
  },
];

const COR_STATUS: Record<string, string> = {
  normal:  '#1D9E75',
  atencao: '#F39C12',
  grave:   '#E74C3C',
};

export default function MapaScreen() {
  const [pontoSelecionado, setPontoSelecionado] = useState<string | null>(null);

  // Define o provedor dinamicamente: Google para Android, Padrão (Apple) para iOS
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.mapa}
        provider={PROVIDER_GOOGLE}
        initialRegion={REGIAO_INICIAL}
        mapType="hybrid"
        showsUserLocation
        showsMyLocationButton
      >
        {PONTOS_EXEMPLO.map(ponto => (
          <Marker
            key={ponto.id}
            coordinate={{ latitude: ponto.latitude, longitude: ponto.longitude }}
            title={ponto.nome}
            description={`Status: ${ponto.status}`}
            pinColor={COR_STATUS[ponto.status]}
            onPress={() => setPontoSelecionado(ponto.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapa: {
    flex: 1,
  },
});