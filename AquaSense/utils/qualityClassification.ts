// Lógica de classificação de qualidade da água a partir de observações agregadas

export interface QualidadeInfo {
  label: 'Ótima' | 'Boa' | 'Regular' | 'Ruim' | 'Crítica' | 'Sem dados';
  color: string;
  hint: string | null;
  hasAlert: boolean;
}

/**
 * Deriva uma classificação de qualidade a partir de parâmetros observados.
 * Por enquanto é uma heurística simples baseada nos campos disponíveis.
 */
export function classificarQualidade(params: {
  cor?: string | null;
  odor?: string | null;
  lixo?: 'sim' | 'nao' | null;
  totalObservacoes: number;
}): QualidadeInfo {
  const { cor, odor, lixo, totalObservacoes } = params;

  if (totalObservacoes === 0) {
    return { label: 'Sem dados', color: '#90a4ae', hint: null, hasAlert: false };
  }

  let score = 0; // 0 = ótima, maior = pior

  // Penalidades por cor
  if (cor === 'Escura' || cor === 'Marrom') score += 3;
  else if (cor === 'Esverdeada' || cor === 'Amarelada') score += 2;
  else if (cor === 'Turva') score += 2;
  else if (cor === 'Transparente' || cor === 'Incolor') score += 0;
  else if (cor) score += 1;

  // Penalidades por odor
  if (odor === 'Cheiro químico') score += 3;
  else if (odor === 'Cheiro forte' || odor === 'Cheiro de esgoto') score += 3;
  else if (odor === 'Cheiro leve') score += 1;
  else if (odor === 'Sem odor') score += 0;

  // Penalidade por lixo
  if (lixo === 'sim') score += 2;

  if (score <= 0) return { label: 'Ótima', color: '#00897B', hint: null, hasAlert: false };
  if (score <= 1) return { label: 'Boa', color: '#43A047', hint: null, hasAlert: false };
  if (score <= 2) return { label: 'Regular', color: '#FFA000', hint: null, hasAlert: false };
  if (score <= 4) return { label: 'Ruim', color: '#E64A19', hint: 'Evite contato prolongado', hasAlert: true };
  return { label: 'Crítica', color: '#B71C1C', hint: 'Evite qualquer contato', hasAlert: true };
}

/**
 * Converte score de qualidade em número de estrelas (1–5)
 */
export function qualidadeParaEstrelas(label: QualidadeInfo['label']): number {
  const map: Record<QualidadeInfo['label'], number> = {
    'Ótima': 5,
    'Boa': 4,
    'Regular': 3,
    'Ruim': 2,
    'Crítica': 1,
    'Sem dados': 0,
  };
  return map[label] ?? 0;
}