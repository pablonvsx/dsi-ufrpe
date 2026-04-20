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
  | "Abastecimento Humano" 
  | "Irrigação" 
  | "Dessedentação Animal" 
  | "Pesca" 
  | "Lazer / Balneabilidade" 
  | "Lançamento de Efluentes";

export interface CorpoHidrico {
  id?: string;                  // A interrogação indica que é opcional no momento da criação (o Firebase que gera)
  nome: string;
  tipo: TipoCorpoHidrico;
  descricao?: string;           // Opcional, somente geston e técnicos podem preencher
  tiposDeUso: TipoUsoAgua[];    // Nosso array de múltiplos usos!

  // Dados Espaciais Brutos
  latitude: number;
  longitude: number;

  // Contexto Geográfico (Gerado automaticamente pelo geoService)
  bioma: string;
  macroRH: string;
  mesoRH: string;
  microRH: string;
  municipio: string;

  // Metadados de Controle e Auditoria > Fundamentais para Ciência Cidadã)
  cadastroValido: boolean;  // Se false, ainda precisa de aprovação de um Técnico/Gestor
  criadoPor: string;        // Vai receber o UID (User ID) do Firebase Auth do usuário logado
  comentario?: string;       // Campo para o usuario deixar uma observação ou comentário no cadastro (opcional)
  validadoPor?: string;     // UID do Técnico/Gestor que validou o cadastro (opcional, só preenchido após validação)  
  dataCriacao: Date | any;  // O Firebase trabalha com "Timestamp", então usaremos `any` ou i
                            // importar o tipo do Firebase previne erros de tipagem
}

export interface PontoDeUso {
  id?: string;
  // Chave Estrangeira (Relacionamento)
  // Opcional, pois o usuário pode cadastrar um ponto de uso num 
  // riacho que ainda não tem cadastro oficial no app
  corpoHidricoId?: string; 
  nomeCorpoHidricoReferencia?: string; 

  // Dados Específicos do Uso
  tipoDeUso: TipoUsoAgua[] | TipoUsoAgua; // Novo formato: seleção múltipla (mantém compatibilidade com registros antigos)
  nomeLocalPopular?: string; // Ex: "Prainha do rio", "Poço da pedra"
  frequenciaUso?: "Diária" | "Semanal" | "Mensal" | "Apenas na Seca" | "Apenas na Chuva"; // Excelente dado para análise temporal!
  descricao?: string; // Alterado pela gestão ou técnico. Texto oficial para o ponto de uso
  // pode conter observações importantes para outros usuários.
  
  // Dados Espaciais Brutos
  latitude: number;
  longitude: number;

  // Contexto Territorial (Sempre enriquecido pelo seu geoService)
  bioma: string;
  macroRH: string;
  mesoRH: string;
  microRH: string;
  municipio: string;

  // Metadados de Auditoria
  cadastroValido: boolean;
  criadoPor: string;
  comentario?: string; // Campo para o usuario deixar uma observação ou comentário no cadastro (opcional)
  validadoPor?: string;
  dataCriacao: any; // serverTimestamp
}
