import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";

const EQUIPES_COLECAO = "equipesTecnicas";
const USUARIOS_COLECAO = "usuarios";

export type StatusEquipe = "ativa" | "inativa";
export type StatusNaEquipe = "ativo" | "removido";

export interface EquipeTecnicaInput {
  nome: string;
  codigoEquipe: string;
  areaAtuacao: string;
  descricao?: string;
  gestorId?: string;
}

export interface EquipeTecnica extends EquipeTecnicaInput {
  id: string;
  status: StatusEquipe;
  dataCriacao: Date;
}

export interface MembroTecnico {
  uid: string;
  nome: string;
  email: string;
  codigoEquipe: string;
  statusNaEquipe?: StatusNaEquipe;
}

function toDate(value: any): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date();
}

function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase();
}

function normalizarEquipe(id: string, data: any): EquipeTecnica {
  return {
    id,
    nome: data.nome ?? "Equipe técnica",
    codigoEquipe: data.codigoEquipe ?? "",
    areaAtuacao: data.areaAtuacao ?? "",
    descricao: data.descricao ?? "",
    gestorId: data.gestorId ?? "",
    status: data.status ?? "ativa",
    dataCriacao: toDate(data.dataCriacao),
  };
}

export async function criarEquipeTecnica(
  input: EquipeTecnicaInput
): Promise<string> {
  const codigoEquipe = normalizarCodigo(input.codigoEquipe);

  const existente = await getDocs(
    query(
      collection(db, EQUIPES_COLECAO),
      where("codigoEquipe", "==", codigoEquipe)
    )
  );

  if (!existente.empty) {
    throw new Error("Já existe uma equipe com esse código.");
  }

  const docRef = await addDoc(collection(db, EQUIPES_COLECAO), {
    nome: input.nome.trim(),
    codigoEquipe,
    areaAtuacao: input.areaAtuacao.trim(),
    descricao: input.descricao?.trim() ?? "",
    gestorId: input.gestorId ?? null,
    status: "ativa",
    dataCriacao: serverTimestamp(),
  });

  return docRef.id;
}

export async function listarEquipesTecnicas(): Promise<EquipeTecnica[]> {
  const q = query(
    collection(db, EQUIPES_COLECAO),
    orderBy("dataCriacao", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => normalizarEquipe(d.id, d.data()));
}

export async function buscarEquipePorCodigo(
  codigoEquipe: string
): Promise<EquipeTecnica | null> {
  const q = query(
    collection(db, EQUIPES_COLECAO),
    where("codigoEquipe", "==", normalizarCodigo(codigoEquipe))
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const item = snap.docs[0];

  return normalizarEquipe(item.id, item.data());
}

export async function atualizarEquipeTecnica(
  id: string,
  data: Partial<Pick<EquipeTecnicaInput, "nome" | "areaAtuacao" | "descricao">>
): Promise<void> {
  await updateDoc(doc(db, EQUIPES_COLECAO, id), {
    ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
    ...(data.areaAtuacao !== undefined
      ? { areaAtuacao: data.areaAtuacao.trim() }
      : {}),
    ...(data.descricao !== undefined
      ? { descricao: data.descricao.trim() }
      : {}),
  });
}

export async function desativarEquipeTecnica(id: string): Promise<void> {
  await updateDoc(doc(db, EQUIPES_COLECAO, id), {
    status: "inativa",
  });
}

export async function ativarEquipeTecnica(id: string): Promise<void> {
  await updateDoc(doc(db, EQUIPES_COLECAO, id), {
    status: "ativa",
  });
}

export async function buscarTecnicosDaEquipe(
  codigoEquipe: string
): Promise<MembroTecnico[]> {
  const q = query(
    collection(db, USUARIOS_COLECAO),
    where("tipoUsuario", "==", "tecnico"),
    where("codigoEquipe", "==", normalizarCodigo(codigoEquipe))
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();

    return {
      uid: d.id,
      nome: data.nome ?? "Técnico",
      email: data.email ?? "",
      codigoEquipe: data.codigoEquipe ?? codigoEquipe,
      statusNaEquipe: data.statusNaEquipe ?? "ativo",
    };
  });
}

export async function removerMembroDaEquipe(uid: string): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COLECAO, uid), {
    statusNaEquipe: "removido",
  });
}

export async function reativarMembroDaEquipe(uid: string): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COLECAO, uid), {
    statusNaEquipe: "ativo",
  });
}


export interface MetricasDiariasEquipe {
  enviadas: number;
  concluidas: number;
  alertas: number;
  ultimaAtividade: Date | null;
}

export async function buscarMetricasDiariasEquipe(
  uidsAtivos: string[]
): Promise<MetricasDiariasEquipe> {
  if (uidsAtivos.length === 0) {
    return {
      enviadas: 0,
      concluidas: 0,
      alertas: 0,
      ultimaAtividade: null,
    };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  try {
    const q = query(
      collection(db, "coletaSimples"),
      where("usuarioId", "in", uidsAtivos.slice(0, 10)),
      where("dataCriacao", ">=", Timestamp.fromDate(hoje)),
      orderBy("dataCriacao", "desc")
    );

    const snap = await getDocs(q);

    const concluidas = snap.docs.filter(
      (d) => d.data().status === "validado"
    ).length;

    const ultimaRaw = snap.docs[0]?.data().dataCriacao;

    return {
      enviadas: snap.size,
      concluidas,
      alertas: 0,
      ultimaAtividade: ultimaRaw ? toDate(ultimaRaw) : null,
    };
  } catch {
    return {
      enviadas: 0,
      concluidas: 0,
      alertas: 0,
      ultimaAtividade: null,
    };
  }
}

export async function buscarMetricasGlobaisHoje(): Promise<{
  analisesHoje: number;
  concluidasHoje: number;
}> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  try {
    const q = query(
      collection(db, "coletaSimples"),
      where("dataCriacao", ">=", Timestamp.fromDate(hoje))
    );

    const snap = await getDocs(q);

    return {
      analisesHoje: snap.size,
      concluidasHoje: snap.docs.filter(
        (d) => d.data().status === "validado"
      ).length,
    };
  } catch {
    return {
      analisesHoje: 0,
      concluidasHoje: 0,
    };
  }
}