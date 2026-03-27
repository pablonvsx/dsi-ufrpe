// Estrutura do endereco da equipe tecnica
export interface Endereco {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    
}

export interface EquipeTecnica {
    id?: string;
    nomeEquipe: string;
    gestorResponsavelId: string;
    codigoEquipe: string;
    status: "ativa" | "inativa";
    dataCriacao?: any;
    endereco: Endereco;

}

