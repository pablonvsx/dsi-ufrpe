export type TipoUsuario = "comum" | "colaborador" | "tecnico" | "gestor";

export interface UsuarioBase {
    uid: string;
    nome: string;
    email: string;
    tipoUsuario: TipoUsuario;
    statusConta: "ativa" | "inativa";
    dataCriacao?: any;
}

export interface UsuarioComum extends UsuarioBase {
    tipoUsuario: "comum";
    cidade: string;
}

export interface UsuarioColaborador extends UsuarioBase {
    tipoUsuario: "colaborador"
    organizacao: string;
    cidade: string;

}

export interface UsuarioTecnico extends UsuarioBase {
    tipoUsuario: "tecnico"
    equipeId: string;
    codigoEquipe: string;
}

export interface UsuarioGestor extends UsuarioBase {
    tipoUsuario: "gestor";
    organizacao: string;
    cidade: string;
}

export type Usuario = 
    | UsuarioComum
    | UsuarioColaborador
    | UsuarioTecnico
    | UsuarioGestor;

    