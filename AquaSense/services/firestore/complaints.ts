import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    limit,
} from "firebase/firestore";
import { db } from "@/config/firebase";

const COLECAO = "denuncias";

export type StatusDenuncia =
    | "recebida"
    | "em_analise"
    | "encaminhada_equipe"
    | "resolvida"
    | "arquivada"
    | "pendente"; // mantido para retrocompatibilidade

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
    bairro?: string | null;
    areaChave?: string;
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
    bairro?: string | null;
    areaChave?: string;
    status: StatusDenuncia;
    dataCriacao: Date;
}

function normalizarDoc(id: string, data: Record<string, unknown>): Denuncia {
    const ts = data.dataCriacao;
    const dataCriacao =
        ts instanceof Timestamp ? ts.toDate() :
        ts instanceof Date ? ts :
        new Date();

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
        bairro: data.bairro as string | null | undefined,
        areaChave: data.areaChave as string | undefined,
        status: (data.status as StatusDenuncia) ?? "pendente",
        dataCriacao,
    };
}

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
        estado: data.estado ?? "PE",
        bairro: data.bairro ?? null,
        areaChave: data.areaChave ?? null,
        status: "pendente" as StatusDenuncia,
        dataCriacao: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLECAO), payload);
    return docRef.id;
}

export async function getComplaintsByUser(uid: string): Promise<Denuncia[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("usuarioId", "==", uid),
            orderBy("dataCriacao", "desc")
        );

        const snap = await getDocs(q);
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[complaints] getComplaintsByUser:", err);
        return [];
    }
}

export async function getComplaintsByWaterBody(corpoHidricoId: string): Promise<Denuncia[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("corpoHidricoId", "==", corpoHidricoId),
            orderBy("dataCriacao", "desc")
        );

        const snap = await getDocs(q);
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[complaints] getComplaintsByWaterBody:", err);
        return [];
    }
}

export async function getComplaintsByArea(areaChave: string, maxItems = 20): Promise<Denuncia[]> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("areaChave", "==", areaChave),
            orderBy("dataCriacao", "desc"),
            limit(maxItems)
        );

        const snap = await getDocs(q);
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[complaints] getComplaintsByArea:", err);
        return [];
    }
}

// Alias para compatibilidade com my_contributions.tsx
export const buscarDenunciasPorUsuario = getComplaintsByUser;

export async function updateComplaintStatus(
    id: string,
    status: StatusDenuncia
): Promise<void> {
    await updateDoc(doc(db, COLECAO, id), { status });
}

export async function archiveComplaint(id: string): Promise<void> {
    await updateDoc(doc(db, COLECAO, id), { status: "arquivada" as StatusDenuncia });
}