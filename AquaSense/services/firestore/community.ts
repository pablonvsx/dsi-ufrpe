/**
 * services/firestore/community.ts
 *
 * Service que alimenta o Painel Comunitário no AquaSense.
 * Fontes de dados: usuarios, corposHidricos, medicoesColaborador, denuncias.
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

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLECAO_USUARIOS = "usuarios";
const COLECAO_CORPOS_HIDRICOS = "corposHidricos";
const COLECAO_MEDICOES = "medicoesColaborador";
const COLECAO_DENUNCIAS = "denuncias";
// Reservadas para uso futuro — descomente quando as coleções forem criadas:
// const COLECAO_OBSERVACOES = "observacoes";
// const COLECAO_ACOES = "acoesComunitarias";
// const COLECAO_ATIVIDADES = "atividadesComunidade";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface CorpoHidricoComunidade {
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
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
    dataCriacao: Date;
}

/**
 * Retorno consolidado para o Painel Comunitário —
 * reduz o número de chamadas do componente.
 */
export interface CommunityPanelData {
    corpoHidricoId: string | null;
    stats: CommunityStats;
    atividades: AtividadeComunidade[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    return new Date();
}

/** Monta descrição resumida de uma medição para exibição nas atividades */
function resumoMedicao(data: Record<string, unknown>): string {
    const partes: string[] = [];
    if (data.ph != null) partes.push(`pH: ${data.ph}`);
    if (data.turbidez) partes.push(`Turbidez: ${data.turbidez}`);
    if (data.temperatura != null) partes.push(`Temp.: ${data.temperatura}°C`);
    return partes.join(" • ") || "Medição registrada";
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Resolve o contexto comunitário do usuário:
 * retorna o ID do último corpo hídrico acessado (ou null).
 */
export async function getCommunityContext(
    uid: string
): Promise<{ corpoHidricoId: string | null; corpoHidrico: CorpoHidricoComunidade | null }> {
    try {
        const usuarioSnap = await getDoc(doc(db, COLECAO_USUARIOS, uid));
        if (!usuarioSnap.exists()) return { corpoHidricoId: null, corpoHidrico: null };

        const corpoHidricoId =
            (usuarioSnap.data()?.ultimoCorpoHidricoAcessadoId as string) ?? null;
        if (!corpoHidricoId) return { corpoHidricoId: null, corpoHidrico: null };

        const corpoSnap = await getDoc(
            doc(db, COLECAO_CORPOS_HIDRICOS, corpoHidricoId)
        );
        if (!corpoSnap.exists()) return { corpoHidricoId, corpoHidrico: null };

        const d = corpoSnap.data();
        return {
            corpoHidricoId,
            corpoHidrico: {
                id: corpoSnap.id,
                nome: (d.nome as string) ?? "Corpo hídrico",
                cidade: (d.cidade ?? d.municipio) as string | undefined,
                estado: (d.estado ?? d.uf) as string | undefined,
                status: (d.status ?? d.qualidade) as string | undefined,
            },
        };
    } catch (err) {
        console.warn("[community] getCommunityContext:", err);
        return { corpoHidricoId: null, corpoHidrico: null };
    }
}

/**
 * Retorna as estatísticas da comunidade para o corpo hídrico informado.
 *
 * - contribuicoes: documentos em medicoesColaborador (filtrado por corpoHidricoId quando houver)
 * - participantes: usuariosId únicos em medicoesColaborador
 * - denuncias: documentos em denuncias (coleção pode ainda não existir → 0)
 * - acoes: documentos em acoesComunitarias (coleção pode ainda não existir → 0)
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

    // ── Contribuições e participantes (medicoesColaborador) ─────────────────
    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_MEDICOES),
                  where("corpoHidricoId", "==", corpoHidricoId)
              )
            : query(collection(db, COLECAO_MEDICOES));

        const snap = await getDocs(q);
        stats.contribuicoes = snap.size;

        // Conta usuários únicos
        const usuariosUnicos = new Set<string>();
        snap.forEach((d) => {
            const uid = d.data().usuarioId as string | undefined;
            if (uid) usuariosUnicos.add(uid);
        });
        stats.participantes = usuariosUnicos.size;
    } catch (err) {
        console.warn("[community] getCommunityStats (medicoes):", err);
    }

    // ── Denúncias ───────────────────────────────────────────────────────────
    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_DENUNCIAS),
                  where("corpoHidricoId", "==", corpoHidricoId)
              )
            : query(collection(db, COLECAO_DENUNCIAS));

        const snap = await getDocs(q);
        stats.denuncias = snap.size;
    } catch (err) {
        // Coleção pode ainda não existir — silencia
        console.warn("[community] getCommunityStats (denuncias):", err);
    }

    // ── Ações comunitárias (futura) ─────────────────────────────────────────
    // Descomente quando a coleção `acoesComunitarias` for criada:
    //
    // try {
    //   const q = corpoHidricoId
    //     ? query(
    //         collection(db, "acoesComunitarias"),
    //         where("corpoHidricoId", "==", corpoHidricoId)
    //       )
    //     : query(collection(db, "acoesComunitarias"));
    //   const snap = await getDocs(q);
    //   stats.acoes = snap.size;
    // } catch (err) {
    //   console.warn("[community] getCommunityStats (acoes):", err);
    // }

    return stats;
}

/**
 * Retorna a lista de atividades da comunidade (máximo 30, mais recentes primeiro).
 *
 * Fontes atuais:
 * - medicoesColaborador → tipo "contribuicao"
 * - denuncias           → tipo "denuncia"
 *
 * Fontes preparadas para uso futuro:
 * - observacoes         → tipo "observacao"
 * - acoesComunitarias   → tipo "acao"
 */
export async function getCommunityActivities(
    corpoHidricoId?: string
): Promise<AtividadeComunidade[]> {
    const atividades: AtividadeComunidade[] = [];

    // ── Medições do colaborador ─────────────────────────────────────────────
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
                usuarioId: data.usuarioId as string | undefined,
                usuarioNome: data.usuarioNome as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        console.warn("[community] getCommunityActivities (medicoes):", err);
    }

    // ── Denúncias ───────────────────────────────────────────────────────────
    try {
        const q = corpoHidricoId
            ? query(
                  collection(db, COLECAO_DENUNCIAS),
                  where("corpoHidricoId", "==", corpoHidricoId),
                  orderBy("dataCriacao", "desc"),
                  limit(10)
              )
            : query(
                  collection(db, COLECAO_DENUNCIAS),
                  orderBy("dataCriacao", "desc"),
                  limit(10)
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
                usuarioId: data.usuarioId as string | undefined,
                usuarioNome: data.usuarioNome as string | undefined,
                dataCriacao: toDate(data.dataCriacao),
            });
        });
    } catch (err) {
        // Coleção pode ainda não existir — silencia
        console.warn("[community] getCommunityActivities (denuncias):", err);
    }

    // ── Observações (futura) ────────────────────────────────────────────────
    // Descomente quando a coleção `observacoes` for criada:
    //
    // try {
    //   const q = corpoHidricoId
    //     ? query(
    //         collection(db, "observacoes"),
    //         where("corpoHidricoId", "==", corpoHidricoId),
    //         orderBy("dataCriacao", "desc"),
    //         limit(10)
    //       )
    //     : query(
    //         collection(db, "observacoes"),
    //         orderBy("dataCriacao", "desc"),
    //         limit(10)
    //       );
    //   const snap = await getDocs(q);
    //   snap.forEach((d) => {
    //     const data = d.data() as Record<string, unknown>;
    //     atividades.push({
    //       id: d.id,
    //       tipo: "observacao",
    //       titulo: `Observação – ${(data.tipo as string) ?? "Ambiental"}`,
    //       descricao: (data.descricao as string) ?? "",
    //       corpoHidricoId: data.corpoHidricoId as string | undefined,
    //       corpoHidricoNome: data.corpoHidricoNome as string | undefined,
    //       usuarioId: data.usuarioId as string | undefined,
    //       usuarioNome: data.usuarioNome as string | undefined,
    //       dataCriacao: toDate(data.dataCriacao),
    //     });
    //   });
    // } catch (err) {
    //   console.warn("[community] getCommunityActivities (observacoes):", err);
    // }

    // ── Ações comunitárias (futura) ─────────────────────────────────────────
    // Descomente quando a coleção `acoesComunitarias` for criada:
    //
    // try {
    //   const q = corpoHidricoId
    //     ? query(
    //         collection(db, "acoesComunitarias"),
    //         where("corpoHidricoId", "==", corpoHidricoId),
    //         orderBy("dataCriacao", "desc"),
    //         limit(10)
    //       )
    //     : query(
    //         collection(db, "acoesComunitarias"),
    //         orderBy("dataCriacao", "desc"),
    //         limit(10)
    //       );
    //   const snap = await getDocs(q);
    //   snap.forEach((d) => {
    //     const data = d.data() as Record<string, unknown>;
    //     atividades.push({
    //       id: d.id,
    //       tipo: "acao",
    //       titulo: (data.titulo as string) ?? "Ação comunitária",
    //       descricao: (data.descricao as string) ?? "",
    //       corpoHidricoId: data.corpoHidricoId as string | undefined,
    //       corpoHidricoNome: data.corpoHidricoNome as string | undefined,
    //       usuarioId: data.usuarioId as string | undefined,
    //       usuarioNome: data.usuarioNome as string | undefined,
    //       dataCriacao: toDate(data.dataCriacao),
    //     });
    //   });
    // } catch (err) {
    //   console.warn("[community] getCommunityActivities (acoes):", err);
    // }

    // Ordena todas as fontes globalmente por data decrescente
    return atividades
        .sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime())
        .slice(0, 30);
}

/**
 * Função agregadora — chama getCommunityContext, getCommunityStats e
 * getCommunityActivities em paralelo para reduzir latência.
 *
 * É o ponto de entrada preferido para o componente CommunityPanel.
 */
export async function getCommunityPanelData(
    uid: string
): Promise<CommunityPanelData> {
    // 1. Resolve o corpo hídrico do usuário
    const { corpoHidricoId } = await getCommunityContext(uid);

    // 2. Busca stats e atividades em paralelo
    const [stats, atividades] = await Promise.all([
        getCommunityStats(corpoHidricoId ?? undefined),
        getCommunityActivities(corpoHidricoId ?? undefined),
    ]);

    return { corpoHidricoId, stats, atividades };
}