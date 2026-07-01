import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  arrayUnion,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";

export type NivelAlerta = "Crítico" | "Atenção" | "Informativo";
export type TipoAlerta = "global" | "pessoal";

export interface Alerta {
  id: string;
  titulo: string;
  mensagem: string;
  nivel: NivelAlerta;
  tipo: TipoAlerta;
  corpoHidricoId?: string;
  corpoHidricoNome?: string;
  destinatarios?: string[];
  lidoPor?: string[];
  criadoEm: any;
  ativo?: boolean;
  cidade?: string;
  estado?: string;
  subtitulo?: string;
  recorrente?: boolean;
  tipoOrigem?: "automatico" | "operacional";
  criadorId?: string;
  detalhes?: string[];
}

function normalizarAlerta(id: string, data: any): Alerta {
  return {
    id,
    titulo: data.titulo ?? "Alerta",
    mensagem: data.mensagem ?? "",
    nivel: data.nivel ?? "Informativo",
    tipo: data.tipo ?? "global",
    corpoHidricoId: data.corpoHidricoId,
    corpoHidricoNome: data.corpoHidricoNome,
    destinatarios: data.destinatarios ?? [],
    lidoPor: data.lidoPor ?? [],
    criadoEm: data.criadoEm,
    ativo: data.ativo ?? true,
    cidade: data.cidade,
    estado: data.estado,
    subtitulo: data.subtitulo,
    recorrente: data.recorrente ?? false,
    tipoOrigem: data.tipoOrigem ?? "automatico",
    criadorId: data.criadorId,
    detalhes: data.detalhes ?? [],
  };
}

export async function buscarAlertasDoUsuario(uid: string): Promise<Alerta[]> {
  try {
    const alertasRef = collection(db, "alertas");

    const globaisQuery = query(
      alertasRef,
      where("tipo", "==", "global"),
      orderBy("criadoEm", "desc")
    );

    const pessoaisQuery = query(
      alertasRef,
      where("destinatarios", "array-contains", uid),
      orderBy("criadoEm", "desc")
    );

    const [globaisSnap, pessoaisSnap] = await Promise.all([
      getDocs(globaisQuery),
      getDocs(pessoaisQuery),
    ]);

    const globais = globaisSnap.docs.map((d) =>
      normalizarAlerta(d.id, d.data())
    );

    const pessoais = pessoaisSnap.docs.map((d) =>
      normalizarAlerta(d.id, d.data())
    );

    const unidos = [...globais, ...pessoais].filter(
      (alerta) => alerta.ativo !== false
    );

    const semDuplicados = Array.from(
      new Map(unidos.map((alerta) => [alerta.id, alerta])).values()
    );

    return semDuplicados.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() ?? 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() ?? 0;

      return dataB - dataA;
    });
  } catch (error) {
    console.error("Erro ao buscar alertas do usuário:", error);
    return [];
  }
}

export async function marcarAlertaComoLido(
  alertaId: string,
  uid: string
): Promise<void> {
  try {
    const ref = doc(db, "alertas", alertaId);

    await updateDoc(ref, {
      lidoPor: arrayUnion(uid),
    });
  } catch (error) {
    console.error("Erro ao marcar alerta como lido:", error);
  }
}

export async function buscarAlertasParaGestor(): Promise<Alerta[]> {
  try {
    const alertasRef = collection(db, "alertas");
    const q = query(alertasRef, orderBy("criadoEm", "desc"));

    const snap = await getDocs(q);

    return snap.docs.map((d) => normalizarAlerta(d.id, d.data()));
  } catch (error) {
    console.error("Erro ao buscar alertas para gestor:", error);
    return [];
  }
}

export async function criarAlertaOperacional(data: {
  titulo: string;
  mensagem: string;
  nivel: NivelAlerta;
  corpoHidricoId?: string;
  corpoHidricoNome?: string;
  criadorId: string;
}): Promise<string> {
  const alertasRef = collection(db, "alertas");

  const docRef = await addDoc(alertasRef, {
    ...data,
    tipo: "pessoal" as TipoAlerta,
    tipoOrigem: "operacional",
    ativo: true,
    recorrente: false,
    detalhes: [],
    criadoEm: serverTimestamp(),
  });

  return docRef.id;
}

export async function encerrarAlertaGestor(alertaId: string): Promise<void> {
  try {
    const ref = doc(db, "alertas", alertaId);

    await updateDoc(ref, {
      ativo: false,
    });
  } catch (error) {
    console.error("Erro ao encerrar alerta:", error);
  }
}