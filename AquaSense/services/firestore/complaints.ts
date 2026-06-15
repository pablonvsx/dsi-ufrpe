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

export async function getComplaintsCountByPeriod(daysBack: number): Promise<number> {
    try {
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - daysBack);
        const q = query(
            collection(db, COLECAO),
            where("dataCriacao", ">=", Timestamp.fromDate(dataInicio))
        );
        const snap = await getDocs(q);
        return snap.size;
    } catch (err) {
        console.warn("[complaints] getComplaintsCountByPeriod:", err);
        return 0;
    }
}

export async function getDailyComplaintsCount(daysBack: number): Promise<{ date: string; count: number }[]> {
    try {
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - daysBack);
        const q = query(
            collection(db, COLECAO),
            where("dataCriacao", ">=", Timestamp.fromDate(dataInicio))
        );
        const snap = await getDocs(q);
        const countsByDate = new Map<string, number>();
        snap.docs.forEach((d) => {
            const ts = d.data().dataCriacao;
            const date = ts instanceof Timestamp ? ts.toDate() : new Date();
            const dateStr = date.toISOString().split("T")[0];
            countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
        });
        return Array.from(countsByDate.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
        console.warn("[complaints] getDailyComplaintsCount:", err);
        return [];
    }
}

export async function getPreviousPeriodComplaintsCount(daysBack: number): Promise<number> {
    try {
        const dataFim = new Date();
        dataFim.setDate(dataFim.getDate() - daysBack);
        const dataInicio = new Date(dataFim);
        dataInicio.setDate(dataInicio.getDate() - daysBack);
        const q = query(
            collection(db, COLECAO),
            where("dataCriacao", ">=", Timestamp.fromDate(dataInicio)),
            where("dataCriacao", "<", Timestamp.fromDate(dataFim))
        );
        const snap = await getDocs(q);
        return snap.size;
    } catch (err) {
        console.warn("[complaints] getPreviousPeriodComplaintsCount:", err);
        return 0;
    }
}

export async function getComplaintsInProgressCount(): Promise<number> {
    try {
        const q = query(
            collection(db, COLECAO),
            where("status", "in", ["em_analise", "encaminhada_equipe"])
        );
        const snap = await getDocs(q);
        return snap.size;
    } catch (err) {
        console.warn("[complaints] getComplaintsInProgressCount:", err);
        return 0;
    }
}