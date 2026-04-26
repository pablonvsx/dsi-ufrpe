import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface ObservacaoInput {
  corpoHidricoId: string;
  criadoPor: string;
  cor: string | null;
  corDesc: string;
  odor: string | null;
  odorDesc: string;
  animais: 'sim' | 'nao' | null;
  animaisDesc: string;
  lixo: 'sim' | 'nao' | null;
  lixoDesc: string;
}

export interface Observacao extends ObservacaoInput {
  id: string;
  dataCriacao: any;
}

export interface QualidadeResumo {
  label: string;
  color: string;
  score: number;
  hint: string;
  hasAlert: boolean;
}

/**
 * Salva uma observação vinculada a um corpo hídrico.
 * Retorna o ID do documento criado.
 */
export async function salvarObservacao(input: ObservacaoInput): Promise<string> {
  const docRef = await addDoc(collection(db, 'observacoes'), {
    ...input,
    dataCriacao: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Busca as últimas N observações de um corpo hídrico.
 * Padrão: últimas 20.
 *
 * ATENÇÃO: esta query usa where('corpoHidricoId') + orderBy('dataCriacao'),
 * o que exige um índice composto no Firestore:
 *   coleção: observacoes
 *   campos:  corpoHidricoId ASC  +  dataCriacao DESC
 *
 * Se o índice não existir, o Firestore lança um erro com um link direto
 * para criá-lo. Esse link aparece no console após a correção do catch abaixo.
 
 */
export async function buscarObservacoesPorCorpo(
  corpoHidricoId: string,
  maxItems = 20
): Promise<Observacao[]> {
  try {
    const q = query(
      collection(db, 'observacoes'),
      where('corpoHidricoId', '==', corpoHidricoId),
      orderBy('dataCriacao', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Observacao));
  } catch (e) {
    
    console.error('[buscarObservacoesPorCorpo] Erro ao buscar observações:', e);
    return [];
  }
}

/**
 * Calcula a média/resumo das observações de um corpo hídrico.
 * Retorna label de qualidade, cor, e contagens por parâmetro.
 */
export function calcularResumoObservacoes(observacoes: Observacao[]): ResumoObservacoes {
  if (observacoes.length === 0) {
    return {
      totalObservacoes: 0,
      qualidade: {
        label: 'Sem dados',
        color: '#90a4ae',
        score: -1,
        hint: 'Ainda não há observações suficientes',
        hasAlert: false,
      },
      corMaisFrequente: null,
      odorMaisFrequente: null,
      percentualLixo: null,
      percentualAnimais: null,
      estrelas: 0,
    };
  }

  const n = observacoes.length;

  // Frequência de cor
  const corCount: Record<string, number> = {};
  observacoes.forEach((o) => {
    if (o.cor) corCount[o.cor] = (corCount[o.cor] ?? 0) + 1;
  });
  const corMaisFrequente = Object.entries(corCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Frequência de odor
  const odorCount: Record<string, number> = {};
  observacoes.forEach((o) => {
    if (o.odor) odorCount[o.odor] = (odorCount[o.odor] ?? 0) + 1;
  });
  const odorMaisFrequente =
    Object.entries(odorCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Percentuais
  const comLixo = observacoes.filter((o) => o.lixo === 'sim').length;
  const semLixoNull = observacoes.filter((o) => o.lixo !== null).length;
  const percentualLixo = semLixoNull > 0 ? Math.round((comLixo / semLixoNull) * 100) : null;

  const comAnimais = observacoes.filter((o) => o.animais === 'sim').length;
  const semAnimaisNull = observacoes.filter((o) => o.animais !== null).length;
  const percentualAnimais =
    semAnimaisNull > 0 ? Math.round((comAnimais / semAnimaisNull) * 100) : null;

  
  let pontosPenalidade = 0;
  let totalCampos = 0;

  const COR_PENALIDADE: Record<string, number> = {
    Transparente: 0,
    Esverdeada: 30,
    Amarelada: 40,
    Marrom: 70,
    Escura: 90,
    Outra: 20,
  };

  if (corMaisFrequente) {
    pontosPenalidade += COR_PENALIDADE[corMaisFrequente] ?? 20;
    totalCampos++;
  }

  const ODOR_PENALIDADE: Record<string, number> = {
    'Sem odor': 0,
    'Cheiro leve': 20,
    'Cheiro forte': 70,
    'Cheiro químico': 90,
  };

  if (odorMaisFrequente) {
    pontosPenalidade += ODOR_PENALIDADE[odorMaisFrequente] ?? 20;
    totalCampos++;
  }

  if (percentualLixo !== null) {
    pontosPenalidade += percentualLixo * 0.5;
    totalCampos++;
  }

  const scoreFinal = totalCampos > 0 ? pontosPenalidade / totalCampos : 0;

  let qualidade: QualidadeResumo;

  if (totalCampos === 0) {
    qualidade = {
      label: 'Sem dados',
      color: '#90a4ae',
      score: -1,
      hint: 'Ainda não há observações suficientes',
      hasAlert: false,
    };
  } else if (scoreFinal <= 15) {
    qualidade = {
      label: 'Boa',
      color: '#2e7d32',
      score: scoreFinal,
      hint: 'Condição visual favorável',
      hasAlert: false,
    };
  } else if (scoreFinal <= 35) {
    qualidade = {
      label: 'Moderada',
      color: '#f57c00',
      score: scoreFinal,
      hint: 'Atenção ao contato com a água',
      hasAlert: false,
    };
  } else if (scoreFinal <= 60) {
    qualidade = {
      label: 'Ruim',
      color: '#c62828',
      score: scoreFinal,
      hint: 'Evite contato prolongado',
      hasAlert: true,
    };
  } else {
    qualidade = {
      label: 'Crítica',
      color: '#7b0000',
      score: scoreFinal,
      hint: 'Risco elevado de contaminação',
      hasAlert: true,
    };
  }

  const estrelas =
    qualidade.label === 'Boa'
      ? 5
      : qualidade.label === 'Moderada'
      ? 3
      : qualidade.label === 'Ruim'
      ? 2
      : qualidade.label === 'Crítica'
      ? 1
      : 0;

  return {
    totalObservacoes: n,
    qualidade,
    corMaisFrequente,
    odorMaisFrequente,
    percentualLixo,
    percentualAnimais,
    estrelas,
  };
}

export interface ResumoObservacoes {
  totalObservacoes: number;
  qualidade: QualidadeResumo;
  corMaisFrequente: string | null;
  odorMaisFrequente: string | null;
  percentualLixo: number | null;
  percentualAnimais: number | null;
  estrelas: number;
}