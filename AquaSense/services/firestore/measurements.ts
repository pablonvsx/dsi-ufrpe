import {
    collection,
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

const COLECAO = "medicoesColaborador";

export type StatusMedicao = "pendente" | "validada" | "rejeitada";

export interface CriarMedicaoColaboradorInput {
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    cidade?: string;
    estado?: string;
    bairro?: string | null;
    areaChave?: string;
    ph?: number;
    temperatura?: number;
    turbidez?: string;
    observacao?: string;
    [key: string]: unknown;
}

export interface MedicaoColaborador {
    id: string;
    usuarioId: string;
    usuarioNome?: string;
    corpoHidricoId?: string;
    corpoHidricoNome?: string;
    cidade?: string;
    estado?: string;
    bairro?: string | null;
    areaChave?: string;
    ph?: number;
    temperatura?: number;
    turbidez?: string;
    observacao?: string;
    tipoMedicao: "simples";
    origem: "colaborador";
    status: StatusMedicao;
    dataCriacao: Date;
}

function normalizarDoc(id: string, data: Record<string, unknown>): MedicaoColaborador {
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
        cidade: data.cidade as string | undefined,
        estado: data.estado as string | undefined,
        bairro: data.bairro as string | null | undefined,
        areaChave: data.areaChave as string | undefined,
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

export async function createCollaboratorMeasurement(
    data: CriarMedicaoColaboradorInput
): Promise<string> {
    const payload = {
        usuarioId: data.usuarioId,
        usuarioNome: data.usuarioNome ?? null,
        corpoHidricoId: data.corpoHidricoId ?? null,
        corpoHidricoNome: data.corpoHidricoNome ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? "PE",
        bairro: data.bairro ?? null,
        areaChave: data.areaChave ?? null,
        ph: data.ph ?? null,
        temperatura: data.temperatura ?? null,
        turbidez: data.turbidez ?? null,
        observacao: data.observacao ?? null,
        tipoMedicao: "simples",
        origem: "colaborador",
        status: "pendente" as StatusMedicao,
        dataCriacao: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLECAO), payload);
    return docRef.id;
}

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
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[measurements] getCollaboratorMeasurementsByUser:", err);
        return [];
    }
}

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
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[measurements] getCollaboratorMeasurementsByWaterBody:", err);
        return [];
    }
}

export async function getCollaboratorMeasurementsByArea(
    areaChave: string,
    maxItems = 20
): Promise<MedicaoColaborador[]> {
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
        console.warn("[measurements] getCollaboratorMeasurementsByArea:", err);
        return [];
    }
}

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
        return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch (err) {
        console.warn("[measurements] getRecentCollaboratorMeasurements:", err);
        return [];
    }
}