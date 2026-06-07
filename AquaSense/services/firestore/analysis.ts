/**
 * Service: Análises de Corpo Hídrico
 * Busca e processa dados de coletaSimples e coletaCompleta
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Query,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface ColetaSimples {
  id: string;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  tipo: "medicao" | "observacao";
  latitude?: number;
  longitude?: number;
  pH?: number;
  temperatura?: number;
  cor?: string;
  odor?: string;
  observacaoVisual?: {
    lixo: boolean;
    animaisMortos: boolean;
    despejosEsgoto: boolean;
    esgotoVisivel: boolean;
    coloracaoAnormal: boolean;
    odorAnormal: boolean;
    espumaOuResiduos: boolean;
  };
  descricao: string;
  usuarioNome: string;
  dataCriacao: any;
  status: "pendente" | "validado" | "revisado";
}

export interface ColetaCompleta {
  id: string;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  usuarioNome: string;
  dataCriacao: any;
  pH?: number;
  temperatura?: number;
  turbidez?: number;
  conductividade?: number;
  [key: string]: any;
}

export interface AnalisadoData {
  ultimaMedicao: ColetaSimples | ColetaCompleta | null;
  ultimaObservacao: ColetaSimples | null;
  totalMedicoes: number;
  totalObservacoes: number;
  mediacaoPH: number;
  medicaoTemperatura: number;
  todasAnalises: (ColetaSimples | ColetaCompleta)[];
}

// ─────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Busca todas as análises (simples e completas) para um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns AnalisadoData com estatísticas
 */
export async function buscarAnalisesPorCorpo(
  corpoHidricoId: string
): Promise<AnalisadoData> {
  try {
    // Buscar coletaSimples
    const coletasSimples = await buscarColetasSimples(corpoHidricoId);

    // Buscar coletaCompleta
    const coletasCompleta = await buscarColetasCompleta(corpoHidricoId);

    // Processar dados
    const medicoes = coletasSimples.filter((c) => c.tipo === "medicao");
    const observacoes = coletasSimples.filter((c) => c.tipo === "observacao");

    const ultimaMedicao = medicoes.length > 0 ? medicoes[0] : null;
    const ultimaObservacao = observacoes.length > 0 ? observacoes[0] : null;

    // Calcular médias
    const mediacaoPH = medicoes.length > 0
      ? medicoes.reduce((acc, m) => acc + (m.pH || 0), 0) / medicoes.length
      : 0;

    const medicaoTemperatura = medicoes.length > 0
      ? medicoes.reduce((acc, m) => acc + (m.temperatura || 0), 0) / medicoes.length
      : 0;

    // Combinar todas as análises
    const todasAnalises = [...medicoes, ...observacoes, ...coletasCompleta]
      .sort((a, b) => {
        const dataA = a.dataCriacao?.toDate?.() || a.dataCriacao || new Date(0);
        const dataB = b.dataCriacao?.toDate?.() || b.dataCriacao || new Date(0);
        return new Date(dataB).getTime() - new Date(dataA).getTime();
      });

    return {
      ultimaMedicao: ultimaMedicao || (coletasCompleta.length > 0 ? coletasCompleta[0] : null),
      ultimaObservacao,
      totalMedicoes: medicoes.length,
      totalObservacoes: observacoes.length,
      mediacaoPH: Math.round(mediacaoPH * 100) / 100,
      medicaoTemperatura: Math.round(medicaoTemperatura * 100) / 100,
      todasAnalises,
    };
  } catch (error) {
    console.error("Erro ao buscar análises:", error);
    return {
      ultimaMedicao: null,
      ultimaObservacao: null,
      totalMedicoes: 0,
      totalObservacoes: 0,
      mediacaoPH: 0,
      medicaoTemperatura: 0,
      todasAnalises: [],
    };
  }
}

/**
 * Busca coletasSimples relacionadas a um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns Array de ColetaSimples ordenadas por data (mais recente primeiro)
 */
async function buscarColetasSimples(corpoHidricoId: string): Promise<ColetaSimples[]> {
  try {
    const constraints: QueryConstraint[] = [
      where("corpoHidricoId", "==", corpoHidricoId),
      where("status", "in", ["validado", "revisado"]), // Apenas validadas
      orderBy("dataCriacao", "desc"),
    ];

    const q = query(collection(db, "coletaSimples"), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as ColetaSimples));
  } catch (error) {
    console.error("Erro ao buscar coletasSimples:", error);
    return [];
  }
}

/**
 * Busca coletasCompleta relacionadas a um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns Array de ColetaCompleta ordenadas por data (mais recente primeiro)
 */
async function buscarColetasCompleta(corpoHidricoId: string): Promise<ColetaCompleta[]> {
  try {
    const constraints: QueryConstraint[] = [
      where("corpoHidricoId", "==", corpoHidricoId),
      orderBy("dataCriacao", "desc"),
    ];

    const q = query(collection(db, "coletaCompleta"), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as ColetaCompleta));
  } catch (error) {
    console.error("Erro ao buscar coletasCompleta:", error);
    return [];
  }
}

/**
 * Busca última medição de um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns ColetaSimples ou ColetaCompleta mais recente
 */
export async function buscarUltimaMedicao(
  corpoHidricoId: string
): Promise<ColetaSimples | ColetaCompleta | null> {
  try {
    const coletasSimples = await buscarColetasSimples(corpoHidricoId);
    const coletasCompleta = await buscarColetasCompleta(corpoHidricoId);

    const medicoes = coletasSimples.filter((c) => c.tipo === "medicao");

    if (medicoes.length > 0) return medicoes[0];
    if (coletasCompleta.length > 0) return coletasCompleta[0];

    return null;
  } catch (error) {
    console.error("Erro ao buscar última medição:", error);
    return null;
  }
}

/**
 * Calcula estatísticas para um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns Objeto com estatísticas
 */
export async function calcularEstatisticas(corpoHidricoId: string) {
  try {
    const analises = await buscarAnalisesPorCorpo(corpoHidricoId);

    const medicoes = analises.todasAnalises.filter((a) => (a as any).tipo === "medicao");

    return {
      totalAnalises: analises.todasAnalises.length,
      totalMedicoes: analises.totalMedicoes,
      totalObservacoes: analises.totalObservacoes,
      mediacaoPH: analises.mediacaoPH,
      medicaoTemperatura: analises.medicaoTemperatura,
      pHMinimo: medicoes.length > 0
        ? Math.min(...medicoes.map((m) => (m as any).pH || 0))
        : 0,
      pHMaximo: medicoes.length > 0
        ? Math.max(...medicoes.map((m) => (m as any).pH || 0))
        : 0,
      temperaturaMinima: medicoes.length > 0
        ? Math.min(...medicoes.map((m) => (m as any).temperatura || 0))
        : 0,
      temperaturaMaxima: medicoes.length > 0
        ? Math.max(...medicoes.map((m) => (m as any).temperatura || 0))
        : 0,
      ultimaAtualizacao: analises.ultimaMedicao?.dataCriacao || null,
    };
  } catch (error) {
    console.error("Erro ao calcular estatísticas:", error);
    return null;
  }
}

/**
 * Busca análises com filtros opcionais
 * @param corpoHidricoId - ID do corpo hídrico
 * @param filtros - Filtros opcionais (tipo, status, dataInicio, dataFim)
 * @returns Array de análises filtradas
 */
export async function buscarAnalisesComFiltro(
  corpoHidricoId: string,
  filtros?: {
    tipo?: "medicao" | "observacao" | "completa";
    status?: "pendente" | "validado" | "revisado";
    dataInicio?: Date;
    dataFim?: Date;
  }
): Promise<(ColetaSimples | ColetaCompleta)[]> {
  try {
    const analises = await buscarAnalisesPorCorpo(corpoHidricoId);

    let resultado = [...analises.todasAnalises];

    // Filtrar por tipo
    if (filtros?.tipo && filtros.tipo !== "completa") {
      resultado = resultado.filter((a) => (a as any).tipo === filtros.tipo);
    }

    // Filtrar por status
    if (filtros?.status) {
      resultado = resultado.filter((a) => (a as any).status === filtros.status);
    }

    // Filtrar por data
    if (filtros?.dataInicio) {
      resultado = resultado.filter((a) => {
        const data = a.dataCriacao?.toDate?.() || a.dataCriacao;
        return new Date(data) >= filtros.dataInicio!;
      });
    }

    if (filtros?.dataFim) {
      resultado = resultado.filter((a) => {
        const data = a.dataCriacao?.toDate?.() || a.dataCriacao;
        return new Date(data) <= filtros.dataFim!;
      });
    }

    return resultado;
  } catch (error) {
    console.error("Erro ao buscar análises com filtro:", error);
    return [];
  }
}

/**
 * Busca análises por usuário em um corpo hídrico
 * @param corpoHidricoId - ID do corpo hídrico
 * @param usuarioNome - Nome do usuário
 * @returns Array de análises do usuário
 */
export async function buscarAnalisesDoUsuario(
  corpoHidricoId: string,
  usuarioNome: string
): Promise<(ColetaSimples | ColetaCompleta)[]> {
  try {
    const analises = await buscarAnalisesPorCorpo(corpoHidricoId);
    return analises.todasAnalises.filter(
      (a) => (a as any).usuarioNome === usuarioNome
    );
  } catch (error) {
    console.error("Erro ao buscar análises do usuário:", error);
    return [];
  }
}

/**
 * Busca tendência de qualidade (últimas N análises)
 * @param corpoHidricoId - ID do corpo hídrico
 * @param quantidade - Quantidade de últimas análises (padrão: 10)
 * @returns Array com últimas N análises
 */
export async function buscarTendencia(
  corpoHidricoId: string,
  quantidade: number = 10
): Promise<(ColetaSimples | ColetaCompleta)[]> {
  try {
    const analises = await buscarAnalisesPorCorpo(corpoHidricoId);
    return analises.todasAnalises.slice(0, quantidade);
  } catch (error) {
    console.error("Erro ao buscar tendência:", error);
    return [];
  }
}

/**
 * Avalia a saúde do corpo hídrico com base nas análises
 * @param corpoHidricoId - ID do corpo hídrico
 * @returns Status: "excelente", "bom", "alerta", "crítico"
 */
export async function avaliarSaudeCorporoHidrico(
  corpoHidricoId: string
): Promise<{ status: string; descricao: string; score: number }> {
  try {
    const stats = await calcularEstatisticas(corpoHidricoId);

    if (!stats) {
      return {
        status: "sem_dados",
        descricao: "Sem dados para análise",
        score: 0,
      };
    }

    let score = 0;
    let problemas = 0;

    // Avaliar pH
    if (stats.mediacaoPH >= 6 && stats.mediacaoPH <= 8.5) {
      score += 25;
    } else if (stats.mediacaoPH >= 5 && stats.mediacaoPH <= 9) {
      score += 15;
      problemas++;
    } else {
      problemas += 2;
    }

    // Avaliar temperatura
    if (stats.medicaoTemperatura >= 15 && stats.medicaoTemperatura <= 35) {
      score += 25;
    } else {
      problemas++;
    }

    // Avaliar quantidade de dados
    if (stats.totalAnalises >= 10) {
      score += 25;
    } else if (stats.totalAnalises >= 5) {
      score += 15;
    } else {
      score += 5;
    }

    // Avaliar frequência
    if (stats.ultimaAtualizacao) {
      const diasDesdeUltima = Math.floor(
        (Date.now() - new Date(stats.ultimaAtualizacao).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeUltima <= 7) {
        score += 25;
      } else if (diasDesdeUltima <= 30) {
        score += 15;
      } else {
        score += 5;
      }
    }

    let status = "excelente";
    let descricao = "Qualidade da água excelente";

    if (score >= 90) {
      status = "excelente";
      descricao = "Parâmetros dentro dos limites recomendados";
    } else if (score >= 70) {
      status = "bom";
      descricao = "Qualidade boa, alguns parâmetros requerem atenção";
    } else if (score >= 50) {
      status = "alerta";
      descricao = "Qualidade comprometida, monitoramento necessário";
    } else {
      status = "critico";
      descricao = "Condições críticas detectadas";
    }

    return { status, descricao, score };
  } catch (error) {
    console.error("Erro ao avaliar saúde:", error);
    return {
      status: "erro",
      descricao: "Erro ao processar dados",
      score: 0,
    };
  }
}
