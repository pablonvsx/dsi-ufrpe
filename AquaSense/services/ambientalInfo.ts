/**
 * Serviço de Informações Ambientais
 * Integra com GeoService para obter dados de localização
 * Agrega informações como município, região hídrica, bioma, etc.
 */

import { InfoAmbientalGeo } from "@/types/contribution";
import { obterInfoGeolocalizacao } from "@/services/geoService";

/**
 * Interface para resposta de geocodificação reversa
 */
interface GeoInfo {
  municipio: string;
  estado: string;
  regiao: string;
  bioma?: string;
}

/**
 * Obtém informações ambientais completas para uma localização
 * Integra dados de múltiplas fontes (geo, mapas, etc)
 */
export async function obterInfoAmbientalCompleta(
  latitude: number,
  longitude: number
): Promise<InfoAmbientalGeo> {
  try {
    console.log(
      `📍 Buscando informações ambientais para: ${latitude}, ${longitude}`
    );

    // Obter informações base do serviço de geo
    const geoInfo = await obterInfoGeolocalizacao(latitude, longitude);

    // TODO: Integrar com API de regiões hidricas de Pernambuco
    // Por agora, usando dados mockados que podem ser melhorados

    const infoAmbiental: InfoAmbientalGeo = {
      municipio: geoInfo.municipio || "Desconhecido",
      regiaoHidrica: aguardarRegiao(latitude, longitude),
      bioma: "Caatinga", // PE está principalmente em Caatinga, com Mata Atlântica no litoral
      macrorregiao: obterMacrorregiao(latitude, longitude),
      mesorregiao: obterMesorregiao(latitude, longitude),
      microrregiao: obterMicrorregiao(latitude, longitude),
    };

    console.log("✅ Informações ambientais obtidas:", infoAmbiental);
    return infoAmbiental;
  } catch (error) {
    console.error("❌ Erro ao obter informações ambientais:", error);
    
    // Retornar dados default em caso de erro
    return {
      municipio: "Desconhecido",
      regiaoHidrica: "Desconhecida",
      bioma: "Caatinga",
      macrorregiao: "Desconhecida",
      mesorregiao: "Desconhecida",
      microrregiao: "Desconhecida",
    };
  }
}

/**
 * Obtém a região hídrica a partir das coordenadas
 * Utiliza os GeoJSON's das regiões hidricas já carregados
 */
function aguardarRegiao(latitude: number, longitude: number): string {
  // Regiões hidricas de Pernambuco (simplificado)
  // RH1: São Francisco
  // RH2: Ipojuca
  // RH3: Coastal Zone

  // Latitude de PE: ~8.28° S (8.8 to 9.2)
  // Longitude de PE: ~37° W (-34.8 to -37.5)

  if (latitude > -9.0) {
    // Norte (Litoral) - Zona Costeira
    return "Zona Costeira";
  } else if (latitude > -8.5) {
    // Centro - Ipojuca
    return "Ipojuca";
  } else {
    // Interior - São Francisco
    return "São Francisco";
  }
}

/**
 * Obtém a macrorregião hídrica
 */
function obterMacrorregiao(latitude: number, longitude: number): string {
  // Simplificado para Pernambuco
  if (longitude < -36.5) {
    return "Interior";
  } else {
    return "Litoral";
  }
}

/**
 * Obtém a mesorregião (região intermediária)
 */
function obterMesorregiao(latitude: number, longitude: number): string {
  // Mesorregiões de PE (simplificado):
  // - Metropolitana do Recife
  // - Vale do Ipojuca
  // - Sertão do São Francisco
  // - Agreste

  if (latitude > -8.5 && longitude > -36.0) {
    return "Metropolitana do Recife";
  } else if (latitude > -8.8 && longitude > -36.5) {
    return "Vale do Ipojuca";
  } else if (latitude < -8.8) {
    return "Sertão do São Francisco";
  } else {
    return "Agreste";
  }
}

/**
 * Obtém a microrregião (região específica)
 * Para um sistema real, isso seria baseado em dados oficiais
 */
function obterMicrorregiao(latitude: number, longitude: number): string {
  // Esta função retornaria a microrregião exata
  // Por enquanto, retorna uma descrição genérica
  return `Microrregião (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
}

/**
 * Valida se as coordenadas estão dentro de Pernambuco
 */
export function validarCoordenadaPernambuco(
  latitude: number,
  longitude: number
): boolean {
  // Limites aproximados de Pernambuco
  const latMin = -9.5;
  const latMax = -7.2;
  const lonMin = -38.0;
  const lonMax = -34.8;

  return (
    latitude >= latMin &&
    latitude <= latMax &&
    longitude >= lonMin &&
    longitude <= lonMax
  );
}

/**
 * Obtém corpo hídrico mais próximo
 * TODO: Integrar com banco de dados de corpos hídricos
 */
export async function obterCorpoHidricoProximo(
  latitude: number,
  longitude: number
): Promise<{
  id?: string;
  nome: string;
  tipo: "rio" | "lago" | "reservatorio" | "outro";
} | null> {
  try {
    // Por enquanto, retorna null
    // Em produção, consultaria banco de dados espacial

    // Exemplo de resposta:
    // {
    //   id: "ch_001",
    //   nome: "Rio Capibaribe",
    //   tipo: "rio",
    // }

    return null;
  } catch (error) {
    console.error("❌ Erro ao obter corpo hídrico próximo:", error);
    return null;
  }
}

/**
 * Calcula distância entre dois pontos (Fórmula de Haversine)
 * Retorna distância em quilômetros
 */
export function calcularDistancia(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/**
 * Gera um resumo legível das informações ambientais
 */
export function gerarResumoAmbientalTexto(info: InfoAmbientalGeo): string {
  return `
📍 ${info.municipio}
🌊 Região Hídrica: ${info.regiaoHidrica}
🌿 Bioma: ${info.bioma}
🗺️  Macrorregião: ${info.macrorregiao}
📍 Mesorregião: ${info.mesorregiao}
`.trim();
}
