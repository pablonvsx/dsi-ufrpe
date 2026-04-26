// Descrições institucionais fixas por nome de corpo hídrico.
// Chave: nome normalizado (lowercase, sem acentos).
// Se não houver correspondência exata, usa a descrição genérica por tipo.

const DESCRICOES: Record<string, string> = {
  'rio capibaribe':
    'Um dos principais rios de Recife, o Capibaribe atravessa o centro da cidade e é um importante recurso hídrico para a população urbana.',
  'rio beberibe':
    'Rio que percorre a zona norte do Recife, historicamente ligado ao abastecimento e à cultura local.',
  'canal do fragoso':
    'Canal artificial localizado em Olinda, utilizado para drenagem urbana e com histórico de pressão ambiental pela urbanização ao redor.',
  'rio goiana':
    'Rio que marca a divisa entre Pernambuco e Paraíba, com relevância ecológica e econômica para a região canavieira.',
  'açude bodocongó':
    'Reservatório localizado em Campina Grande, utilizado historicamente para abastecimento e irrigação no semiárido.',
  'rio ipojuca':
    'Rio que atravessa o Agreste pernambucano até o litoral sul, com importância para irrigação e uso industrial.',
  'rio una':
    'Rio da região da Mata Sul de Pernambuco, com bacia hidrográfica relevante para a agricultura canavieira.',
  'lagoa do araçá':
    'Lagoa costeira de pequeno porte com ecossistema sensível, sujeita a pressões urbanas e sazonalidade hídrica.',
  'riacho fundo':
    'Curso d\'água de menor porte inserido em área urbana, sujeito a alterações de qualidade por ocupação irregular das margens.',
};

const DESCRICOES_POR_TIPO: Record<string, string> = {
  rio: 'Rio cadastrado no sistema AquaSense. Os dados de qualidade são coletados por usuários e revisados pela equipe gestora.',
  riacho:
    'Riacho de pequeno porte registrado no sistema. A qualidade da água pode variar conforme o uso do solo ao redor.',
  lago: 'Lago registrado no sistema AquaSense. Corpo hídrico lêntico com dinâmica própria de qualidade.',
  açude:
    'Açude catalogado no sistema, comum na região semiárida de Pernambuco. Fundamental para abastecimento e irrigação.',
  barragem:
    'Barragem registrada no sistema. Estrutura de represamento com papel importante no abastecimento regional.',
  cacimba:
    'Cacimba identificada no sistema. Fonte de água subterrânea utilizada especialmente no semiárido pernambucano.',
  nascente:
    'Nascente registrada no sistema AquaSense. Área de afloramento de água subterrânea com proteção ambiental recomendada.',
  canal:
    'Canal artificial cadastrado no sistema. Estrutura de drenagem ou irrigação sujeita a variações de qualidade urbana ou agrícola.',
  outro:
    'Corpo hídrico cadastrado no sistema AquaSense. Informações de qualidade baseadas em observações da comunidade.',
};

/** Normaliza string para busca: lowercase + remove acentos */
function normalizar(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Retorna a descrição institucional do corpo hídrico.
 * Prioridade: 1) descrição específica por nome  2) descrição por tipo  3) genérica
 */
export function obterDescricaoInstitucional(nome: string, tipo?: string): string {
  const chave = normalizar(nome);

  // Busca exata
  if (DESCRICOES[chave]) return DESCRICOES[chave];

  // Busca parcial (ex: "Canal do Fragoso - Olinda" → "canal do fragoso")
  const entrada = Object.keys(DESCRICOES).find((k) => chave.includes(k) || k.includes(chave));
  if (entrada) return DESCRICOES[entrada];

  // Fallback por tipo
  if (tipo) {
    const tipoNorm = normalizar(tipo);
    if (DESCRICOES_POR_TIPO[tipoNorm]) return DESCRICOES_POR_TIPO[tipoNorm];
  }

  return 'Corpo hídrico cadastrado no sistema AquaSense. Informações de qualidade baseadas em observações da comunidade local.';
}