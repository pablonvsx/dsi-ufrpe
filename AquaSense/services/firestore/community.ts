/**
 * services/firestore/community.ts
 *
 * Service que alimenta o Painel Comunitário no AquaSense.
 * Filtro principal: areaChave do usuário.
 * Fontes: usuarios, corposHidricos, medicoesColaborador, observacoes, denuncias.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

const COLECAO_USUARIOS = "usuarios";
const COLECAO_CORPOS_HIDRICOS = "corposHidricos";
const COLECAO_MEDICOES = "medicoesColaborador";
const COLECAO_DENUNCIAS = "denuncias";
const COLECAO_OBSERVACOES = "observacoes";

export interface CorpoHidricoComunidade {
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
    bairro?: string | null;
    areaChave?: string;
    status?: string;
}

export interface CommunityStats {
    contribuicoes: number;
    denuncias: number;
    participantes: number;
    acoes: number;
}

export type TipoAtividade =
    | "contribuicao"
    | "denuncia"
    | "observacao"
    | "acao"
    | "medicao";

export interface AtividadeComunidade {
    id: string;
    tipo: TipoAtividade;
    titulo: string;
    descricao: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    usuarioId?: string;
    usuarioNome?: string;
    cidade?: string;
    estado?: string;
    bairro?: string | null;
    areaChave?: string;
    dataCriacao: Date;
}

export interface CommunityContext {
    areaChave: string | null;
    cidade: string | null;
    estado: string | null;
    bairro: string | null;
    corpoHidricoId: string | null;
    corpoHidrico: CorpoHidricoComunidade | null;
}

export interface CommunityPanelData {
    contexto: CommunityContext;
    stats: CommunityStats;
    atividades: AtividadeComunidade[];
}

function toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    return new Date();
}

function resumoMedicao(data: Record<string, unknown>): string {
    const partes: string[] = [];

    if (data.ph != null) partes.push(`pH: ${data.ph}`);
    if (data.turbidez) partes.push(`Turbidez: ${data.turbidez}`);
    if (data.temperatura != null) partes.push(`Temp.: ${data.temperatura}°C`);

    return partes.join(" • ") || "Medição registrada";
}

function resumoObservacao(data: Record<string, unknown>): string {
    const partes: string[] = [];

    if (data.cor) partes.push(`Cor: ${data.cor}`);
    if (data.odor) partes.push(`Odor: ${data.odor}`);
    if (data.lixo) partes.push(`Lixo: ${data.lixo}`);
    if (data.animais) partes.push(`Animais: ${data.animais}`);

    return partes.join(" • ") || "Observação ambiental registrada";
}

function getUsuarioId(data: Record<string, unknown>): string | undefined {
    return (
        (data.usuarioId as string | undefined) ??
        (data.criadoPor as string | undefined)
    );
}

/**
 * Resolve o contexto comunitário do usuário.
 * O painel deve usar areaChave como filtro principal.
 */
export async function getCommunityContext(uid: string): Promise<CommunityContext> {
    try {
        const usuarioSnap = await getDoc(doc(db, COLECAO_USUARIOS, uid));

        if (!usuarioSnap.exists()) {
            return {
                areaChave: null,
                cidade: null,
                estado: null,
                bairro: null,
                corpoHidricoId: null,
                corpoHidrico: null,
            };
        }

        const usuario = usuarioSnap.data();

        const areaChave = (usuario.areaChave as string | undefined) ?? null;
        const cidade = (usuario.cidade as string | undefined) ?? null;
        const estado = (usuario.estado as string | undefined) ?? null;
        const bairro = (usuario.bairro as string | null | undefined) ?? null;

        const corpoHidricoId =
            (usuario.ultimoCorpoHidricoAcessadoId as string | undefined) ?? null;

        let corpoHidrico: CorpoHidricoComunidade | null = null;

        if (corpoHidricoId) {
            const corpoSnap = await getDoc(
                doc(db, COLECAO_CORPOS_HIDRICOS, corpoHidricoId)
            );

            if (corpoSnap.exists()) {
                const d = corpoSnap.data();

                corpoHidrico = {
                    id: corpoSnap.id,
                    nome: (d.nome as string) ?? "Corpo hídrico",
                    cidade: (d.cidade ?? d.municipio) as string | undefined,
                    estado: (d.estado ?? d.uf) as string | undefined,
                    bairro: d.bairro as string | null | undefined,
                    areaChave: d.areaChave as string | undefined,
                    status: (d.status ?? d.qualidade) as string | undefined,
                };
            }
        }

        return {
            areaChave,
            cidade,
            estado,
            bairro,
            corpoHidricoId,
            corpoHidrico,
        };
    } catch (err) {
        console.warn("[community] getCommunityContext:", err);

        return {
            areaChave: null,
            cidade: null,
            estado: null,
            bairro: null,
            corpoHidricoId: null,
            corpoHidrico: null,
        };
    }
}

/**
 * Estatísticas do painel por área/comunidade.
 *
 * contribuicoes = medições dos colaboradores + observações dos usuários comuns
 * denuncias = denúncias da área
 * participantes = usuários únicos que contribuíram na área
 * acoes = reservado para ações comunitárias futuras
 */
export async function getCommunityStatsByArea(
    areaChave: string
): Promise<CommunityStats> {
    const stats: CommunityStats = {
        contribuicoes: 0,
        denuncias: 0,
        participantes: 0,
        acoes: 0,
    };

    const participantes = new Set<string>();

    try {
        const q = query(
            collection(db, COLECAO_MEDICOES),
            where("areaChave", "==", areaChave)
        );

        const snap = await getDocs(q);
        stats.contribuicoes += snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] stats medicoes:", err);
    }

    try {
        const q = query(
            collection(db, COLECAO_OBSERVACOES),
            where("areaChave", "==", areaChave)
        );

        const snap = await getDocs(q);
        stats.contribuicoes += snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] stats observacoes:", err);
    }

    try {
        const q = query(
            collection(db, COLECAO_DENUNCIAS),
            where("areaChave", "==", areaChave)
        );

        const snap = await getDocs(q);
        stats.denuncias = snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] stats denuncias:", err);
    }

    stats.participantes = participantes.size;

    return stats;
}

/**
 * Mantém compatibilidade com chamadas antigas por corpo hídrico.
 */
export async function getCommunityStats(
    corpoHidricoId?: string
): Promise<CommunityStats> {
    const stats: CommunityStats = {
        contribuicoes: 0,
        denuncias: 0,
        participantes: 0,
        acoes: 0,
    };

    const participantes = new Set<string>();

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_MEDICOES),
                  where("corpoHidricoId", "==", corpoHidricoId)
              )
            : query(collection(db, COLECAO_MEDICOES));

        const snap = await getDocs(q);
        stats.contribuicoes += snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] getCommunityStats medicoes:", err);
    }

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_OBSERVACOES),
                  where("corpoHidricoId", "==", corpoHidricoId)
              )
            : query(collection(db, COLECAO_OBSERVACOES));

        const snap = await getDocs(q);
        stats.contribuicoes += snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] getCommunityStats observacoes:", err);
    }

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_DENUNCIAS),
                  where("corpoHidricoId", "==", corpoHidricoId)
              )
            : query(collection(db, COLECAO_DENUNCIAS));

        const snap = await getDocs(q);
        stats.denuncias = snap.size;

        snap.forEach((d) => {
            const uid = getUsuarioId(d.data() as Record<string, unknown>);
            if (uid) participantes.add(uid);
        });
    } catch (err) {
        console.warn("[community] getCommunityStats denuncias:", err);
    }

    stats.participantes = participantes.size;

    return stats;
}

export async function getCommunityActivitiesByArea(
    areaChave: string
): Promise<AtividadeComunidade[]> {
    const atividades: AtividadeComunidade[] = [];

    try {
        const q = query(
            collection(db, COLECAO_MEDICOES),
            where("areaChave", "==", areaChave),
            orderBy("dataCriacao", "desc"),
            limit(20)
        );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "contribuicao",
                titulo: "Nova medição registrada",
                descricao: resumoMedicao(data),
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] activities medicoes:", err);
    }

    try {
        const q = query(
            collection(db, COLECAO_OBSERVACOES),
            where("areaChave", "==", areaChave),
            orderBy("dataCriacao", "desc"),
            limit(20)
        );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "observacao",
                titulo: "Nova observação registrada",
                descricao: resumoObservacao(data),
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] activities observacoes:", err);
    }

    try {
        const q = query(
            collection(db, COLECAO_DENUNCIAS),
            where("areaChave", "==", areaChave),
            orderBy("dataCriacao", "desc"),
            limit(20)
        );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "denuncia",
                titulo: (data.titulo as string) ?? "Denúncia registrada",
                descricao:
                    (data.descricao as string) ||
                    (data.tipoProblema as string) ||
                    "Problema ambiental reportado",
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] activities denuncias:", err);
    }

    return atividades
        .sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime())
        .slice(0, 30);
}

/**
 * Mantém compatibilidade com chamadas antigas por corpo hídrico.
 */
export async function getCommunityActivities(
    corpoHidricoId?: string
): Promise<AtividadeComunidade[]> {
    const atividades: AtividadeComunidade[] = [];

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_MEDICOES),
                  where("corpoHidricoId", "==", corpoHidricoId),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              )
            : query(
                  collection(db, COLECAO_MEDICOES),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "contribuicao",
                titulo: "Nova medição registrada",
                descricao: resumoMedicao(data),
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] getCommunityActivities medicoes:", err);
    }

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_OBSERVACOES),
                  where("corpoHidricoId", "==", corpoHidricoId),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              )
            : query(
                  collection(db, COLECAO_OBSERVACOES),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "observacao",
                titulo: "Nova observação registrada",
                descricao: resumoObservacao(data),
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] getCommunityActivities observacoes:", err);
    }

    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_DENUNCIAS),
                  where("corpoHidricoId", "==", corpoHidricoId),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              )
            : query(
                  collection(db, COLECAO_DENUNCIAS),
                  orderBy("dataCriacao", "desc"),
                  limit(20)
              );

        const snap = await getDocs(q);

        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;

            atividades.push({
                id: d.id,
                tipo: "denuncia",
                titulo: (data.titulo as string) ?? "Denúncia registrada",
                descricao:
                    (data.descricao as string) ||
                    (data.tipoProblema as string) ||
                    "Problema ambiental reportado",
                corpoHidricoId: data.corpoHidricoId as string | undefined,
                corpoHidricoNome: data.corpoHidricoNome as string | undefined,
                usuarioId: getUsuarioId(data),
                usuarioNome: data.usuarioNome as string | undefined,
                cidade: data.cidade as string | undefined,
                estado: data.estado as string | undefined,
                bairro: data.bairro as string | null | undefined,
                areaChave: data.areaChave as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] getCommunityActivities denuncias:", err);
    }

    return atividades
        .sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime())
        .slice(0, 30);
}

/**
 * Entrada principal do Painel Comunitário.
 *
 * Prioridade:
 * 1. Usar areaChave do usuário.
 * 2. Se não houver areaChave, cair para último corpo hídrico.
 * 3. Se não houver nenhum contexto, retornar vazio.
 */
export async function getCommunityPanelData(uid: string): Promise<CommunityPanelData> {
    const contexto = await getCommunityContext(uid);

    if (contexto.areaChave) {
        const [stats, atividades] = await Promise.all([
            getCommunityStatsByArea(contexto.areaChave),
            getCommunityActivitiesByArea(contexto.areaChave),
        ]);

        return { contexto, stats, atividades };
    }

    if (contexto.corpoHidricoId) {
        const [stats, atividades] = await Promise.all([
            getCommunityStats(contexto.corpoHidricoId),
            getCommunityActivities(contexto.corpoHidricoId),
        ]);

        return { contexto, stats, atividades };
    }

    return {
        contexto,
        stats: {
            contribuicoes: 0,
            denuncias: 0,
            participantes: 0,
            acoes: 0,
        },
        atividades: [],
    };
}