// Arquivo de serviços de coletas.
// Centraliza funções para buscar e processar dados de coletas simples e completas.

import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";

/**
 * Contagem de coletas por nível de alerta
 */
export interface ColetasPorNivel {
  boa: number; // nivelAlerta = 1
  normal: number; // nivelAlerta = 2
  atencao: number; // nivelAlerta = 3
  critico: number; // nivelAlerta = 4
  total: number;
}

/**
 * Dados de análises diárias
 */
export interface DailyAnalysisData {
  date: string; // formato YYYY-MM-DD
  count: number;
}

/**
 * Dados diários por nível de alerta
 */
export interface DailyLevelData {
  date: string; // formato YYYY-MM-DD
  boa: number;
  normal: number;
  atencao: number;
  critico: number;
}

/**
 * Busca coletas simples de um período e as agrupa por nivelAlerta
 * @param daysBack - Quantos dias atrás buscar (padrão: 30 dias)
 * @returns Contagem de coletas por nível de alerta
 */
export async function getColetasSimplesPorNivel(daysBack: number = 30): Promise<ColetasPorNivel> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaSimples"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    const contagem: ColetasPorNivel = { boa: 0, normal: 0, atencao: 0, critico: 0, total: 0 };

    querySnapshot.forEach((doc) => {
      const nivelAlerta = doc.data().nivelAlerta ?? 2;
      contagem.total++;

      if (nivelAlerta === 1) contagem.boa++;
      else if (nivelAlerta === 2) contagem.normal++;
      else if (nivelAlerta === 3) contagem.atencao++;
      else if (nivelAlerta === 4) contagem.critico++;
    });

    return contagem;
  } catch (error) {
    console.error("Erro ao buscar coletas simples por nível:", error);
    throw error;
  }
}

/**
 * Busca coletas completas de um período e as agrupa por nivelAlerta
 * @param daysBack - Quantos dias atrás buscar (padrão: 30 dias)
 * @returns Contagem de coletas por nível de alerta
 */
export async function getColetasCompletasPorNivel(daysBack: number = 30): Promise<ColetasPorNivel> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaCompleta"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    const contagem: ColetasPorNivel = { boa: 0, normal: 0, atencao: 0, critico: 0, total: 0 };

    querySnapshot.forEach((doc) => {
      const nivelAlerta = doc.data().nivelAlerta ?? 2;
      contagem.total++;

      if (nivelAlerta === 1) contagem.boa++;
      else if (nivelAlerta === 2) contagem.normal++;
      else if (nivelAlerta === 3) contagem.atencao++;
      else if (nivelAlerta === 4) contagem.critico++;
    });

    return contagem;
  } catch (error) {
    console.error("Erro ao buscar coletas completas por nível:", error);
    throw error;
  }
}

/**
 * Busca contagem total de coletas simples num período
 */
export async function getColetasSimples(daysBack: number = 30): Promise<number> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaSimples"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Erro ao buscar contagem de coletas simples:", error);
    throw error;
  }
}

/**
 * Busca contagem total de coletas completas num período
 */
export async function getColetasCompletas(daysBack: number = 30): Promise<number> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaCompleta"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Erro ao buscar contagem de coletas completas:", error);
    throw error;
  }
}

/**
 * Busca dados diários de coletas simples para um período
 * @param daysBack - Quantos dias atrás buscar
 * @returns Array com contagem de coletas por dia
 */
export async function getDailyColetasSimples(daysBack: number = 30): Promise<DailyAnalysisData[]> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaSimples"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    
    // Agrupar por dia
    const dailyData: { [key: string]: number } = {};
    
    querySnapshot.forEach((doc) => {
      const timestamp = doc.data().data;
      if (timestamp) {
        const date = new Date(timestamp.toDate());
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dailyData[dateStr] = (dailyData[dateStr] || 0) + 1;
      }
    });

    // Converter para array e ordenar por data
    const result = Object.entries(dailyData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  } catch (error) {
    console.error("Erro ao buscar coletas simples diárias:", error);
    throw error;
  }
}

/**
 * Busca dados diários de coletas completas para um período
 * @param daysBack - Quantos dias atrás buscar
 * @returns Array com contagem de coletas por dia
 */
export async function getDailyColetasCompletas(daysBack: number = 30): Promise<DailyAnalysisData[]> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const q = query(
      collection(db, "coletaCompleta"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const querySnapshot = await getDocs(q);
    
    // Agrupar por dia
    const dailyData: { [key: string]: number } = {};
    
    querySnapshot.forEach((doc) => {
      const timestamp = doc.data().data;
      if (timestamp) {
        const date = new Date(timestamp.toDate());
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dailyData[dateStr] = (dailyData[dateStr] || 0) + 1;
      }
    });

    // Converter para array e ordenar por data
    const result = Object.entries(dailyData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  } catch (error) {
    console.error("Erro ao buscar coletas completas diárias:", error);
    throw error;
  }
}

/**
 * Busca contagem de coletas simples nos 14 dias ANTERIORES a um período
 * @param daysBack - Quantos dias atrás começou o período atual
 * @returns Total de coletas nos 14 dias antes
 */
export async function getPreviousPeriodColetasSimples(daysBack: number = 30): Promise<number> {
  try {
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() - daysBack); // Último dia do período anterior

    const dataInicio = new Date(dataFim);
    dataInicio.setDate(dataInicio.getDate() - 14); // 14 dias antes

    const q = query(
      collection(db, "coletaSimples"),
      where("data", ">=", Timestamp.fromDate(dataInicio)),
      where("data", "<", Timestamp.fromDate(dataFim))
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Erro ao buscar período anterior de coletas simples:", error);
    throw error;
  }
}

/**
 * Busca contagem de coletas completas nos 14 dias ANTERIORES a um período
 * @param daysBack - Quantos dias atrás começou o período atual
 * @returns Total de coletas nos 14 dias antes
 */
export async function getPreviousPeriodColetasCompletas(daysBack: number = 30): Promise<number> {
  try {
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() - daysBack); // Último dia do período anterior

    const dataInicio = new Date(dataFim);
    dataInicio.setDate(dataInicio.getDate() - 14); // 14 dias antes

    const q = query(
      collection(db, "coletaCompleta"),
      where("data", ">=", Timestamp.fromDate(dataInicio)),
      where("data", "<", Timestamp.fromDate(dataFim))
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Erro ao buscar período anterior de coletas completas:", error);
    throw error;
  }
}

/**
 * Busca dados diários unificados (simples + completas) agrupados por nível de alerta
 * @param daysBack - Quantos dias atrás buscar
 * @returns Array com dados de cada nível por dia
 */
export async function getDailyQualityLevels(daysBack: number = 30): Promise<DailyLevelData[]> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    // Buscar ambas as coleções
    const qSimples = query(
      collection(db, "coletaSimples"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const qCompletas = query(
      collection(db, "coletaCompleta"),
      where("data", ">=", Timestamp.fromDate(dataInicio))
    );

    const [snapshotSimples, snapshotCompletas] = await Promise.all([
      getDocs(qSimples),
      getDocs(qCompletas),
    ]);

    // Agrupar por dia e nível
    const dailyLevels: { [key: string]: DailyLevelData } = {};

    // Processar coletas simples
    snapshotSimples.forEach((doc) => {
      const timestamp = doc.data().data;
      const nivel = doc.data().nivelAlerta ?? 2;

      if (timestamp) {
        const date = new Date(timestamp.toDate());
        const dateStr = date.toISOString().split("T")[0];

        if (!dailyLevels[dateStr]) {
          dailyLevels[dateStr] = { date: dateStr, boa: 0, normal: 0, atencao: 0, critico: 0 };
        }

        if (nivel === 1) dailyLevels[dateStr].boa++;
        else if (nivel === 2) dailyLevels[dateStr].normal++;
        else if (nivel === 3) dailyLevels[dateStr].atencao++;
        else if (nivel === 4) dailyLevels[dateStr].critico++;
      }
    });

    // Processar coletas completas
    snapshotCompletas.forEach((doc) => {
      const timestamp = doc.data().data;
      const nivel = doc.data().nivelAlerta ?? 2;

      if (timestamp) {
        const date = new Date(timestamp.toDate());
        const dateStr = date.toISOString().split("T")[0];

        if (!dailyLevels[dateStr]) {
          dailyLevels[dateStr] = { date: dateStr, boa: 0, normal: 0, atencao: 0, critico: 0 };
        }

        if (nivel === 1) dailyLevels[dateStr].boa++;
        else if (nivel === 2) dailyLevels[dateStr].normal++;
        else if (nivel === 3) dailyLevels[dateStr].atencao++;
        else if (nivel === 4) dailyLevels[dateStr].critico++;
      }
    });

    // Converter para array e ordenar por data
    const result = Object.values(dailyLevels).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return result;
  } catch (error) {
    console.error("Erro ao buscar dados diários de qualidade por nível:", error);
    throw error;
  }
}