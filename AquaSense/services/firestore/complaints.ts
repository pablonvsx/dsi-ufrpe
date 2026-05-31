/**
 * services/firestore/complaints.ts
 *
 * Service para a coleção `denuncias`.
 * A coleção é criada automaticamente no Firestore ao salvar o primeiro documento.
 */

import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLECAO = "denuncias";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusDenuncia = "pendente" | "em_analise" | "resolvida";

export interface CriarDenunciaInput {
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    titulo: string;
    descricao: string;
    tipoProblema?: string;
    cidade?: string;
    estado?: string;
    // Campos reservados para extensões futuras
    [key: string]: unknown;
}

export interface Denuncia {
    id: string;
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    titulo: string;
    descricao: string;
    tipoProblema?: string;
    cidade?: string;
    estado?: string;
    status: StatusDenuncia;
    dataCriacao: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizarDoc(id: string, data: Record<string, unknown>): Denuncia {
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
        usuarioNome: data.usuarioNome as string | undefined,
        corpoHidricoId: data.corpoHidricoId as string | undefined,
        corpoHidricoNome: data.corpoHidricoNome as string | undefined,
        titulo: (data.titulo as string) ?? "Denúncia",
        descricao: (data.descricao as string) ?? "",
        tipoProblema: data.tipoProblema as string | undefined,
        cidade: data.cidade as string | undefined,
        estado: data.estado as string | undefined,
        status: (data.status as StatusDenuncia) ?? "pendente",
        dataCriacao,
    };
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Cria uma nova denúncia no Firestore.
 * A coleção `denuncias` é criada automaticamente no primeiro registro.
 *
 * @returns ID do documento criado
 */
export async function createComplaint(data: CriarDenunciaInput): Promise<string> {
    const payload = {
        usuarioId: data.usuarioId,
        usuarioNome: data.usuarioNome ?? null,
        corpoHidricoId: data.corpoHidricoId ?? null,
        corpoHidricoNome: data.corpoHidricoNome ?? null,
        titulo: data.titulo,
        descricao: data.descricao,
        tipoProblema: data.tipoProblema ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        status: "pendente" as StatusDenuncia,
        dataCriacao: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLECAO), payload);
    return docRef.id;
}

/**
 * Retorna todas as denúncias feitas por um usuário específico,
 * ordenadas da mais recente para a mais antiga.
 */
export async function getComplaintsByUser(uid: string): Promise<Denuncia[]> {
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
        console.warn("[complaints] getComplaintsByUser:", err);
        return [];
    }
}

/**
 * Retorna todas as denúncias associadas a um corpo hídrico específico,
 * ordenadas da mais recente para a mais antiga.
 */
export async function getComplaintsByWaterBody(
    corpoHidricoId: string
): Promise<Denuncia[]> {
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
        console.warn("[complaints] getComplaintsByWaterBody:", err);
        return [];
    }
}