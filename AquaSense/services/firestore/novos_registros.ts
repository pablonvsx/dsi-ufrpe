import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export type StatusQualidade = "Crítico" | "Atenção" | "Normal" | "Sem dados";
export type StatusRegistro = "aguardando_validacao" | "necessita_revisao";

export interface RegistroPendente {
  id: string;
  nome: string;
  tipo: string;
  municipio: string;
  estado: string;
  criadoPorNome: string;
  criadoPorTipo: string;
  statusRegistro: StatusRegistro;
  dataCriacao: Date;
  dataEnvio: Date;
  observacaoAlerta: string;
  comentariosCount: number;
  fotosCount: number;
  analisesCount: number;
}

export interface CorpoHidricoComStatus {
  id: string;
  nome: string;
  tipo: string;
  municipio: string;
  statusQualidade: StatusQualidade;
  ultimaAtualizacao: Date;
  totalAnalises: number;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (
    typeof val === "object" &&
    val !== null &&
    "seconds" in (val as object)
  )
    return new Date((val as { seconds: number }).seconds * 1000);
  if (typeof val === "string") return new Date(val);
  return new Date();
}

function nivelToStatus(nivel: number): StatusQualidade {
  if (nivel >= 4) return "Crítico";
  if (nivel === 3) return "Atenção";
  return "Normal";
}

export async function buscarRegistrosPendentes(): Promise<RegistroPendente[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "corposHidricos"), where("cadastroValido", "==", false))
    );
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          nome: data.nome ?? "Corpo hídrico",
          tipo: data.tipo ?? "Não informado",
          municipio: data.municipio ?? "",
          estado: data.estado ?? "",
          criadoPorNome: data.criadoPorNome ?? data.usuarioNome ?? "",
          criadoPorTipo: data.criadoPorTipo ?? data.tipoUsuario ?? "usuário",
          statusRegistro:
            (data.statusRegistro as StatusRegistro) ?? "aguardando_validacao",
          dataCriacao: toDate(data.dataCriacao),
          dataEnvio: toDate(data.dataEnvio ?? data.dataCriacao),
          observacaoAlerta: data.observacaoAlerta ?? data.descricao ?? "",
          comentariosCount: data.comentariosCount ?? 0,
          fotosCount: data.fotosCount ?? 0,
          analisesCount: data.analisesCount ?? 0,
        };
      })
      .sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime());
  } catch (err) {
    console.warn("[novos_registros] pendentes:", err);
    return [];
  }
}

export async function buscarCorposHidricosComStatus(): Promise<CorpoHidricoComStatus[]> {
  try {
    const [bodiesSnap, coletasSnap] = await Promise.all([
      getDocs(
        query(collection(db, "corposHidricos"), where("cadastroValido", "==", true))
      ),
      getDocs(collection(db, "coletaSimples")),
    ]);

    const nivelMap = new Map<string, number>();
    const countMap = new Map<string, number>();
    const dateMap = new Map<string, Date>();

    coletasSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, any>;
      const bodyId = data.corpoHidricoId as string | undefined;
      if (!bodyId) return;
      const nivel = (data.nivelAlerta as number) ?? 2;
      const date = toDate(data.data ?? data.dataCriacao);
      nivelMap.set(bodyId, Math.max(nivelMap.get(bodyId) ?? 0, nivel));
      countMap.set(bodyId, (countMap.get(bodyId) ?? 0) + 1);
      if (!dateMap.has(bodyId) || date > dateMap.get(bodyId)!) {
        dateMap.set(bodyId, date);
      }
    });

    return bodiesSnap.docs
      .map((d) => {
        const data = d.data() as Record<string, any>;
        const nivel = nivelMap.get(d.id);
        return {
          id: d.id,
          nome: data.nome ?? "Corpo hídrico",
          tipo: data.tipo ?? "Não informado",
          municipio: data.municipio ?? "",
          statusQualidade:
            nivel !== undefined ? nivelToStatus(nivel) : "Sem dados",
          ultimaAtualizacao: dateMap.get(d.id) ?? toDate(data.dataCriacao),
          totalAnalises: countMap.get(d.id) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime()
      );
  } catch (err) {
    console.warn("[novos_registros] com status:", err);
    return [];
  }
}

export async function contarEnviadosHoje(): Promise<number> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const snap = await getDocs(
      query(
        collection(db, "corposHidricos"),
        where("dataCriacao", ">=", Timestamp.fromDate(start))
      )
    );
    return snap.size;
  } catch (err) {
    console.warn("[novos_registros] enviados hoje:", err);
    return 0;
  }
}

export async function solicitarAjuste(id: string, motivo: string): Promise<void> {
  await updateDoc(doc(db, "corposHidricos", id), {
    statusRegistro: "necessita_revisao",
    motivoAjuste: motivo,
    updatedAt: Timestamp.now(),
  });
}