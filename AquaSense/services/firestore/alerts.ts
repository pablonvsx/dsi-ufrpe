import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  arrayUnion,
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
}

export async function buscarAlertasDoUsuario(uid: string): Promise<Alerta[]> {
  const globaisQuery = query(
    collection(db, "alertas"),
    where("tipo", "==", "global"),
    orderBy("criadoEm", "desc")
  );

  const pessoaisQuery = query(
    collection(db, "alertas"),
    where("destinatarios", "array-contains", uid),
    orderBy("criadoEm", "desc")
  );

  const [globaisSnap, pessoaisSnap] = await Promise.all([
    getDocs(globaisQuery),
    getDocs(pessoaisQuery),
  ]);

  const globais = globaisSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Alerta[];

  const pessoais = pessoaisSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Alerta[];

  const unidos = [...globais, ...pessoais];

  const semDuplicados = Array.from(
    new Map(unidos.map((alerta) => [alerta.id, alerta])).values()
  );

  return semDuplicados.sort((a, b) => {
    const dataA = a.criadoEm?.toDate?.()?.getTime?.() ?? 0;
    const dataB = b.criadoEm?.toDate?.()?.getTime?.() ?? 0;
    return dataB - dataA;
  });
}

export async function marcarAlertaComoLido(
  alertaId: string,
  uid: string
): Promise<void> {
  const ref = doc(db, "alertas", alertaId);

  await updateDoc(ref, {
    lidoPor: arrayUnion(uid),
  });
}