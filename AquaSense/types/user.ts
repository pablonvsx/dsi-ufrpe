export type TipoUsuario = "comum" | "colaborador" | "tecnico" | "gestor";

export interface UsuarioBase {
    uid: string;
    nome: string;
    email: string;
    tipoUsuario: TipoUsuario;

    statusConta:
        | "ativa"
        | "inativa"
        | "pendente_verificacao"
        | "ativo";

    dataCriacao?: any;

    hasSeenTutorial: boolean;

    cidade?: string;
    estado?: string;
    bairro?: string;

    areaChave?: string;

    latitude?: number;
    longitude?: number;
}

export interface UsuarioComum extends UsuarioBase {
    tipoUsuario: "comum";
    
}

export interface UsuarioColaborador extends UsuarioBase {
    tipoUsuario: "colaborador";
    organizacao: string;
    
}

export interface UsuarioTecnico extends UsuarioBase {
    tipoUsuario: "tecnico";
    equipeId: string;
    
}

export interface UsuarioGestor extends UsuarioBase {
    tipoUsuario: "gestor";
    organizacao: string;
    
}

export type Usuario =
    | UsuarioComum
    | UsuarioColaborador
    | UsuarioTecnico
    | UsuarioGestor;