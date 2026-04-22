export type TipoCorpoHidrico = 
  | "rio" 
  | "riacho" 
  | "lago" 
  | "açude" 
  | "barragem" 
  | "cacimba" 
  | "nascente" 
  | "canal" 
  | "outro";

export type TipoUsoAgua = 
  | "Consumo humano" 
  | "Uso na agricultura" 
  | "Uso por animais" 
  | "Pesca" 
  | "Lazer" 
  | "Descarte de resíduos"
  | "Outro";

// Observações visuais do corpo hídrico (cadastradas pelo usuário comum)
export type CorAgua = "Transparente" | "Esverdeada" | "Amarelada" | "Marrom" | "Escura";
export type OdorAgua = "Sem odor" | "Cheiro leve" | "Cheiro forte";
export type PresencaLixo = "Sim" | "Não";
export type PresencaAnimais = "Sim" | "Não";

export interface ObservacoesVisuais {
  cor?: CorAgua;
  odor?: OdorAgua;
  presencaLixo?: PresencaLixo;
  presencaAnimais?: PresencaAnimais;
  quaisAnimais?: string; // Campo livre, preenchido se presencaAnimais === "Sim"
}

export interface CorpoHidrico {
  id?: string;
  nome: string;
  tipo: TipoCorpoHidrico;
  tipoOutro?: string;           // Preenchido se tipo === "outro"
  descricao?: string;
  tiposDeUso: TipoUsoAgua[];

  // Dados Espaciais Brutos
  latitude: number;
  longitude: number;

  // Contexto Geográfico (gerado automaticamente pelo geoService)
  bioma: string;
  macroRH: string;
  mesoRH: string;
  microRH: string;
  municipio: string;

  // Observações visuais registradas pelo usuário no momento do cadastro
  observacoes?: ObservacoesVisuais;

  // Metadados de Controle e Auditoria
  cadastroValido: boolean;
  criadoPor: string;
  comentario?: string;
  validadoPor?: string;
  dataCriacao: Date | any;
}

export interface PontoDeUso {
  id?: string;
  corpoHidricoId?: string; 
  nomeCorpoHidricoReferencia?: string; 

  tipoDeUso: TipoUsoAgua[] | TipoUsoAgua;
  nomeLocalPopular?: string;
  frequenciaUso?: "Diária" | "Semanal" | "Mensal" | "Apenas na Seca" | "Apenas na Chuva";
  descricao?: string;
  
  latitude: number;
  longitude: number;

  bioma: string;
  macroRH: string;
  mesoRH: string;
  microRH: string;
  municipio: string;

  cadastroValido: boolean;
  criadoPor: string;
  comentario?: string;
  validadoPor?: string;
  dataCriacao: any;
}