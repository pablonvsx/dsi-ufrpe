/**
 * services/firestore/measurements.ts
 *
 * Service para a coleção `medicoesColaborador`.
 * Fonte principal de medições feitas por colaboradores no AquaSense.
 */

import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLECAO = "medicoesColaborador";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusMedicao = "pendente" | "validada" | "rejeitada";

/** Dados de entrada para criar uma nova medição */
export interface CriarMedicaoColaboradorInput {
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    cidade?: string;
    estado?: string;
    ph?: number;
    temperatura?: number;
    turbidez?: string;
    observacao?: string;
    // Campos reservados para extensões futuras
    [key: string]: unknown;
}

/** Documento normalizado retornado pelos métodos de leitura */
export interface MedicaoColaborador {
    id: string;
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    cidade?: string;
    estado?: string;
    ph?: number;
    temperatura?: number;
    turbidez?: string;
    observacao?: string;
    tipoMedicao: "simples";
    origem: "colaborador";
    status: StatusMedicao;
    dataCriacao: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizarDoc(id: string, data: Record<string, unknown>): MedicaoColaborador {
    const ts = data.dataCriacao;
    const dataCriacao =
        ts instanceof Timestamp
            ? ts.toDate()
            : ts instanceof Date
            ? ts
            : new Date();

    return {
        id,
        usuarioId: (data.usuarioId as string) ?? "",
        usuarioNome: (data.usuarioNome as string | undefined),
        corpoHidricoId: (data.corpoHidricoId as string | undefined),
        corpoHidricoNome: (data.corpoHidricoNome as string | undefined),
        cidade: (data.cidade as string | undefined),
        estado: (data.estado as string | undefined),
        ph: data.ph as number | undefined,
        temperatura: data.temperatura as number | undefined,
        turbidez: data.turbidez as string | undefined,
        observacao: data.observacao as string | undefined,
        tipoMedicao: "simples",
        origem: "colaborador",
        status: (data.status as StatusMedicao) ?? "pendente",
        dataCriacao,
    };
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Salva uma nova medição do colaborador no Firestore.
 * A coleção `medicoesColaborador` é criada automaticamente no primeiro registro.
 *
 * @returns ID do documento criado
 */
export async function createCollaboratorMeasurement(
    data: CriarMedicaoColaboradorInput
): Promise<string> {
    const payload = {
        usuarioId: data.usuarioId,
        usuarioNome: data.usuarioNome ?? null,
        corpoHidricoId: data.corpoHidricoId ?? null,
        corpoHidricoNome: data.corpoHidricoNome ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        ph: data.ph ?? null,
        temperatura: data.temperatura ?? null,
        turbidez: data.turbidez ?? null,
        observacao: data.observacao ?? null,
        tipoMedicao: "simples",
        origem: "colaborador",
        status: "pendente",
        dataCriacao: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLECAO), payload);
    return docRef.id;
}

/**
 * Retorna todas as medições de um colaborador específico,
 * ordenadas da mais recente para a mais antiga.
 */
export async function getCollaboratorMeasurementsByUser(
    uid: string
): Promise<MedicaoColaborador[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("usuarioId", "==", uid),
            orderBy("dataCriacao", "desc")
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
            normalizarDoc(d.id, d.data() as Record<string, unknown>)
        );
    } catch (err) {
        console.warn("[measurements] getCollaboratorMeasurementsByUser:", err);
        return [];
    }
}

/**
 * Retorna todas as medições associadas a um corpo hídrico específico,
 * ordenadas da mais recente para a mais antiga.
 */
export async function getCollaboratorMeasurementsByWaterBody(
    corpoHidricoId: string
): Promise<MedicaoColaborador[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("corpoHidricoId", "==", corpoHidricoId),
            orderBy("dataCriacao", "desc")
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
            normalizarDoc(d.id, d.data() as Record<string, unknown>)
        );
    } catch (err) {
        console.warn("[measurements] getCollaboratorMeasurementsByWaterBody:", err);
        return [];
    }
}

/**
 * Retorna as N medições mais recentes (de todos os colaboradores).
 * Útil para feeds globais ou painéis administrativos.
 *
 * @param limitNumber Padrão: 20
 */
export async function getRecentCollaboratorMeasurements(
    limitNumber = 20
): Promise<MedicaoColaborador[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            orderBy("dataCriacao", "desc"),
            limit(limitNumber)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) =>
            normalizarDoc(d.id, d.data() as Record<string, unknown>)
        );
    } catch (err) {
        console.warn("[measurements] getRecentCollaboratorMeasurements:", err);
        return [];
    }
}