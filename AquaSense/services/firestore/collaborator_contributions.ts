/**
 * Service unificado de contribuições do colaborador
 * Busca de: observacoes, denuncias, medicoesColaborador, coletaSimples
 *
 * CAMPOS aceitos (compatibilidade com dados antigos e novos):
 *   usuarioId | criadoPor | userId | colaboradorId
 *   dataCriacao | createdAt
 *   status | statusValidacao
 */

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    limit,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// ─── Tipo padronizado ─────────────────────────────────────────────────────────

export type TipoContribuicao = "measurement" | "observation" | "complaint" | "water_body";

export type StatusContribuicao = "validada" | "pendente" | "em_analise" | "arquivada" | "rascunho";

export interface ContribuicaoUnificada {
    id: string;
    tipo: TipoContribuicao;
    titulo: string;
    corpoHidricoNome?: string;
    descricao?: string;
    status: StatusContribuicao;
    criadoEm: Date;
    // campos extras para exibição
    ph?: number;
    temperatura?: number;
    turbidez?: string;
    tipoProblema?: string;
}

// ─── Normalização de status ───────────────────────────────────────────────────

function normalizarStatus(raw?: string): StatusContribuicao {
    if (!raw) return "pendente";
    const map: Record<string, StatusContribuicao> = {
        validada: "validada",
        validated: "validada",
        aprovada: "validada",
        pendente: "pendente",
        pending: "pendente",
        em_analise: "em_analise",
        em_análise: "em_analise",
        encaminhada_equipe: "em_analise",
        recebida: "em_analise",
        arquivada: "arquivada",
        archived: "arquivada",
        resolvida: "arquivada",
        rascunho: "rascunho",
        draft: "rascunho",
        invalida: "arquivada",
    };
    return map[raw.toLowerCase()] ?? "pendente";
}

function toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date(0);
}

// ─── Campos de usuário aceitos ────────────────────────────────────────────────

const USER_FIELDS = ["usuarioId", "criadoPor", "userId", "colaboradorId"];

// Tenta buscar por cada campo de usuário possível (sem índice composto)
async function fetchByUserFields(
    colName: string,
    uid: string,
    maxItems = 50
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const results: Array<{ id: string; data: Record<string, unknown> }> = [];
    const seenIds = new Set<string>();

    for (const field of USER_FIELDS) {
        try {
            const q = query(
                collection(db, colName),
                where(field, "==", uid),
                limit(maxItems)
            );
            const snap = await getDocs(q);
            for (const doc of snap.docs) {
                if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id);
                    results.push({ id: doc.id, data: doc.data() as Record<string, unknown> });
                }
            }
        } catch {
            // campo não existe nessa coleção ou índice ausente — silencioso
        }
    }

    return results;
}

// ─── Busca por coleção ────────────────────────────────────────────────────────

async function buscarMedicoes(uid: string): Promise<ContribuicaoUnificada[]> {
    const docs = await fetchByUserFields("medicoesColaborador", uid);
    return docs.map(({ id, data }) => {
        const ph = data.ph as number | undefined;
        const temp = data.temperatura as number | undefined;
        const turbidez = data.turbidez as string | undefined;
        const partes: string[] = [];
        if (ph !== undefined) partes.push(`pH: ${ph}`);
        if (turbidez) partes.push(`Turbidez: ${turbidez}`);
        if (temp !== undefined) partes.push(`Temp.: ${temp}°C`);

        return {
            id,
            tipo: "measurement" as const,
            titulo: `Medição simples - ${(data.corpoHidricoNome as string) ?? "Corpo hídrico"}`,
            corpoHidricoNome: data.corpoHidricoNome as string | undefined,
            descricao: partes.join(" · ") || (data.observacao as string | undefined),
            status: normalizarStatus(data.status as string),
            criadoEm: toDate(data.dataCriacao ?? data.createdAt),
            ph,
            temperatura: temp,
            turbidez,
        };
    });
}

async function buscarObservacoes(uid: string): Promise<ContribuicaoUnificada[]> {
    const docs = await fetchByUserFields("observacoes", uid);
    return docs.map(({ id, data }) => {
        const partes: string[] = [];
        if (data.cor) partes.push(`Cor: ${data.cor}`);
        if (data.odor) partes.push(`Odor: ${data.odor}`);
        if (data.lixo === "sim") partes.push("Lixo detectado");
        if (data.animais === "sim") partes.push("Animais detectados");

        return {
            id,
            tipo: "observation" as const,
            titulo: `Observação - ${(data.corpoHidricoNome ?? data.corpoHidricoId ?? "Corpo hídrico") as string}`,
            corpoHidricoNome: (data.corpoHidricoNome ?? data.corpoHidricoId) as string | undefined,
            descricao: partes.join(" · ") || (data.descricao as string | undefined),
            status: normalizarStatus(data.status as string ?? "pendente"),
            criadoEm: toDate(data.dataCriacao ?? data.createdAt),
        };
    });
}

async function buscarDenuncias(uid: string): Promise<ContribuicaoUnificada[]> {
    const docs = await fetchByUserFields("denuncias", uid);

    const TIPO_MAP: Record<string, string> = {
        esgoto: "Esgoto irregular",
        lixo: "Lixo / Resíduos",
        poluicao_agua: "Poluição da água",
        desmatamento: "Desmatamento",
        queimada: "Queimada",
        fumaca: "Emissão de fumaça",
        outro: "Outro",
    };

    return docs.map(({ id, data }) => {
        const tipoRaw = data.tipoProblema as string | undefined;
        const tipoLabel = tipoRaw ? (TIPO_MAP[tipoRaw] ?? tipoRaw) : undefined;

        return {
            id,
            tipo: "complaint" as const,
            titulo: (data.titulo as string) ?? "Denúncia",
            corpoHidricoNome: (data.corpoHidricoNome ?? data.cidade) as string | undefined,
            descricao: tipoLabel ?? (data.descricao as string | undefined),
            status: normalizarStatus(data.status as string),
            criadoEm: toDate(data.dataCriacao ?? data.createdAt),
            tipoProblema: tipoLabel,
        };
    });
}

async function buscarColetaSimples(uid: string): Promise<ContribuicaoUnificada[]> {
    const docs = await fetchByUserFields("coletaSimples", uid);
    return docs.map(({ id, data }) => {
        const tipo = (data.tipo as string) ?? "observation";
        const isMedicao = tipo === "medicao" || tipo === "measurement";

        return {
            id,
            tipo: isMedicao ? ("measurement" as const) : ("observation" as const),
            titulo: isMedicao
                ? `Medição simples - ${(data.ambientalInfo as any)?.municipio ?? "—"}`
                : `Observação - ${(data.ambientalInfo as any)?.municipio ?? "—"}`,
            corpoHidricoNome: (data.ambientalInfo as any)?.regiaoHidrica,
            descricao: data.descricao as string | undefined,
            status: normalizarStatus(
                (data.status as string) ??
                (data.validacaoTecnica as any)?.validada ? "validada" : "pendente"
            ),
            criadoEm: toDate(data.dataCriacao ?? data.createdAt),
        };
    });
}

// ─── Função principal exportada ───────────────────────────────────────────────

export async function getCollaboratorContributions(
    uid: string
): Promise<ContribuicaoUnificada[]> {
    const [medicoes, observacoes, denuncias, coleta] = await Promise.allSettled([
        buscarMedicoes(uid),
        buscarObservacoes(uid),
        buscarDenuncias(uid),
        buscarColetaSimples(uid),
    ]);

    const all: ContribuicaoUnificada[] = [
        ...(medicoes.status === "fulfilled" ? medicoes.value : []),
        ...(observacoes.status === "fulfilled" ? observacoes.value : []),
        ...(denuncias.status === "fulfilled" ? denuncias.value : []),
        ...(coleta.status === "fulfilled" ? coleta.value : []),
    ];

    // Deduplicar por id
    const seen = new Set<string>();
    const unique = all.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });

    // Ordenar por mais recente
    return unique.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
}