/**
 * Tipos para Contribuições Ambientais (coletaSimples)
 * Entidades registradas por colaboradores da comunidade
 */

/**
 * Observações visuais categorizadas
 */
export interface ObservacaoVisual {
  lixo: boolean;
  animaisMortos: boolean;
  despejosEsgoto: boolean;
  esgotoVisivel: boolean;
  coloracaoAnormal: boolean;
  odorAnormal: boolean;
  espumaOuResiduos: boolean;
  outrasObservacoes: string[];
}

/**
 * Informações ambientais obtidas via GeoService
 */
export interface InfoAmbientalGeo {
  municipio: string;
  regiaoHidrica: string;
  bioma: string;
  macrorregiao: string;
  mesorregiao: string;
  microrregiao: string;
  corpoHidricoId?: string; // referência ao corpo hídrico
  corpoHidricoNome?: string;
}

/**
 * Dados de validação técnica
 */
export interface ValidacaoTecnica {
  validada: boolean;
  validadoPorId?: string;
  validadoPorNome?: string;
  dataValidacao?: Date;
  motivo?: string;
}

/**
 * Contribuição Ambiental Simples
 * Tipo de dado registrado por colaboradores
 */
export interface ContribuicaoAmbiental {
  id?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  latitude: number;
  longitude: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // INFORMAÇÕES DO USUÁRIO
  // ═══════════════════════════════════════════════════════════════════════════
  usuarioId: string;
  usuarioNome: string;
  usuarioCodigo?: string;
  usuarioEmail?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // TIPO DE CONTRIBUIÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  tipo: "medicao" | "observacao";
  descricao: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DADOS DE MEDIÇÃO (quando tipo = "medicao")
  // ═══════════════════════════════════════════════════════════════════════════
  pH?: number; // 0-14
  cor?: string; // descrição da cor (clara, ligeiramente turva, turva, etc.)
  odor?: string; // descrição do odor
  temperatura?: number; // temperatura da água em °C
  outrosDados?: {
    [key: string]: any;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVAÇÃO VISUAL (quando tipo = "observacao")
  // ═══════════════════════════════════════════════════════════════════════════
  observacaoVisual?: ObservacaoVisual;

  // ═══════════════════════════════════════════════════════════════════════════
  // MÍDIA (FOTOS - URLs do Supabase)
  // ═══════════════════════════════════════════════════════════════════════════
  fotos: string[]; // Array de URLs do Supabase Storage
  fotosMetadata?: Array<{
    url: string;
    nomeOriginal: string;
    dataUpload: Date;
    tamanho: number; // em bytes
  }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // INFORMAÇÕES AMBIENTAIS (via GeoService)
  // ═══════════════════════════════════════════════════════════════════════════
  ambientalInfo: InfoAmbientalGeo;

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAÇÃO TÉCNICA
  // ═══════════════════════════════════════════════════════════════════════════
  validacaoTecnica: ValidacaoTecnica;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS E AUDITORIA
  // ═══════════════════════════════════════════════════════════════════════════
  status: "pendente" | "validada" | "invalida" | "arquivada";
  ativa: boolean; // soft delete
  motivo_invalidade?: string; // motivo da invalidação
  dataCriacao: Date;
  dataAtualizacao: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEMENTAÇÕES (para o Update natural)
  // ═══════════════════════════════════════════════════════════════════════════
  complementacoes?: Array<{
    tipo: "foto" | "descricao" | "observacao_visual" | "correcao_local" | "info_complementar";
    dados: any;
    dataAdicao: Date;
    usuarioId: string;
  }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════════
  versao: number; // para controle de versão da contribuição
  tags?: string[]; // tags para busca (poluição, lixo, pH alto, etc.)
  notasInternas?: string; // notas do gestor/técnico
}

/**
 * DTO para criação de contribuição
 */
export interface CreateContribuicaoDTO {
  latitude: number;
  longitude: number;
  usuarioId: string;
  usuarioNome: string;
  tipo: "medicao" | "observacao";
  descricao: string;
  pH?: number;
  cor?: string;
  odor?: string;
  temperatura?: number;
  observacaoVisual?: ObservacaoVisual;
  fotos?: string[]; // URLs já uploadadas
}

/**
 * DTO para atualizar/complementar contribuição
 */
export interface UpdateContribuicaoDTO {
  descricao?: string;
  pH?: number;
  cor?: string;
  odor?: string;
  temperatura?: number;
  observacaoVisual?: ObservacaoVisual;
  novasFotos?: string[];
  complementacao?: {
    tipo: "foto" | "descricao" | "observacao_visual" | "correcao_local" | "info_complementar";
    dados: any;
  };
}

/**
 * Filtros para busca de contribuições
 */
export interface FiltroContribuicoes {
  usuarioId?: string;
  status?: "pendente" | "validada" | "invalida" | "arquivada";
  tipo?: "medicao" | "observacao";
  municipio?: string;
  regiaoHidrica?: string;
  dataDe?: Date;
  dataAte?: Date;
  ativa?: boolean;
  validada?: boolean;
}
