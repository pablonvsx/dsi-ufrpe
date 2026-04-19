import * as turf from '@turf/turf';

// Importação das camadas otimizadas
import biomasData from '../assets/map_layers/biomas_aquasense.json';
import macroData from '../assets/map_layers/macro_rh_aquasense.json';
import mesoData from '../assets/map_layers/meso_rh_aquasense.json';
import microData from '../assets/map_layers/micro_rh_aquasense.json';
import municipiosData from '../assets/map_layers/municipios_pe.json';
import riversData from '../assets/map_layers/rivers_aquasense.json';

// Definição da interface para garantir a tipagem correta no React Native
export interface GeoContexto {
  bioma: string;
  macroRH: string;
  mesoRH: string;
  microRH: string;
  municipio: string;
  rio: string;
}

/**
 * Função utilitária genérica para buscar o nome do polígono que contém o ponto.
 * @param pt Ponto gerado pelo Turf.js
 * @param geojsonData A camada GeoJSON a ser pesquisada
 * @param chavesPropriedade Array com os possíveis nomes da coluna na tabela de atributos (ex: ['NM_MUN', 'nome'])
 */
const encontrarNomePoligono = (pt: any, geojsonData: any, chavesPropriedade: string[]): string => {
  try {
    for (const feature of geojsonData.features) {
      if (turf.booleanPointInPolygon(pt, feature)) {
        // Se o ponto estiver dentro do polígono, procura qual chave contém o nome
        for (const chave of chavesPropriedade) {
          if (feature.properties && feature.properties[chave]) {
            return String(feature.properties[chave]);
          }
        }
        return "Atributo não encontrado no JSON";
      }
    }
    return "Fora da área mapeada";
  } catch (error) {
    console.error("Erro ao processar camada geográfica:", error);
    return "Erro de processamento";
  }
};

/**
 * Função para buscar o rio mais próximo do ponto (dentro de 2km).
 * @param pt Ponto gerado pelo Turf.js
 * @param geojsonData A camada GeoJSON de rios
 * @param distanciaMaximaKm Distância máxima em km (padrão: 2km = 2000m)
 */
const encontrarRioProximo = (pt: any, geojsonData: any, distanciaMaximaKm: number = 2): string => {
  try {
    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
      return "Sem curso d'água próximo";
    }

    let rioMaisProximo: any = null;
    let distanciaMinima = Infinity;

    for (const feature of geojsonData.features) {
      try {
        // Trata LineString e MultiLineString
        let distancia = Infinity;
        
        if (feature.geometry.type === 'LineString') {
          distancia = turf.pointToLineDistance(pt, feature, { units: 'kilometers' });
        } else if (feature.geometry.type === 'MultiLineString') {
          // Para MultiLineString, precisa testar cada linha
          for (const line of feature.geometry.coordinates) {
            const lineFeature = turf.lineString(line);
            const dist = turf.pointToLineDistance(pt, lineFeature, { units: 'kilometers' });
            distancia = Math.min(distancia, dist);
          }
        }

        if (distancia < distanciaMinima) {
          distanciaMinima = distancia;
          rioMaisProximo = feature;
        }
      } catch (featureError) {
        // Continua para o próximo feature se houver erro
        continue;
      }
    }

    // Se encontrou um rio dentro da distância máxima, retorna o nome
    if (rioMaisProximo && distanciaMinima <= distanciaMaximaKm) {
      const nomeRio = rioMaisProximo.properties?.NORIOCOMP || rioMaisProximo.properties?.nome || "Rio desconhecido";
      return String(nomeRio);
    }

    return "Sem curso d'água próximo";
  } catch (error) {
    console.error("Erro ao processar camada de rios:", error);
    return "Sem curso d'água próximo";
  }
};

/**
 * Retorna o contexto geográfico completo de uma coordenada consultando todas as camadas locais.
 */
export function obterContextoGeografico(latitude: number, longitude: number): GeoContexto {
  // ATENÇÃO: O Turf.js exige o formato [longitude, latitude]
  const pt = turf.point([longitude, latitude]);

  return {
    bioma: encontrarNomePoligono(pt, biomasData, ['nm_bm']),
    macroRH: encontrarNomePoligono(pt, macroData, ['nm_macroRH']),
    mesoRH: encontrarNomePoligono(pt, mesoData, ['nm_mesoRH']),
    microRH: encontrarNomePoligono(pt, microData, ['nm_microRH']),
    municipio: encontrarNomePoligono(pt, municipiosData, ['NM_MUN']),
    rio: encontrarRioProximo(pt, riversData)
  };
}