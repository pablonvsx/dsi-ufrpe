import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";

export type TipoValidacao =
  | "analise_tecnica"
  | "medicao_simples"
  | "medicao_completa"
  | "novo_registro"
  | "denuncia";

export type NivelCriticidade = "critica" | "atencao" | "normal";

export interface ItemValidacao {
  id: string;
  tipo: TipoValidacao;
  corpoHidricoNome: string;
  corpoHidricoId?: string;
  colaboradorNome: string;
  colaboradorId?: string;
  equipeNome?: string;
  criticidade?: NivelCriticidade;
  statusOriginal: string;
  dataColeta?: Date;
  dataEnvio?: Date;
  localidade?: string;
  tipoDenuncia?: string;
  descricao?: string;
  origem?: string;
  dataCriacao: Date;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;

  if (typeof val === "object" && val !== null && "seconds" in (val as object)) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }

  if (typeof val === "string") return new Date(val);

  return new Date();
}

function mapCriticidade(data: Record<string, any>): NivelCriticidade | undefined {
  const raw =
    data.riscoAmbiental ??
    data.classificacao ??
    data.nivelRisco ??
    data.statusQualidade;

  if (!raw) return undefined;

  const s = String(raw).toLowerCase();

  if (s === "critico" || s === "critica") return "critica";
  if (s === "atencao") return "atencao";

  return "normal";
}

export async function buscarValidacoesPendentes(): Promise<ItemValidacao[]> {
  const resultado: ItemValidacao[] = [];

  try {
    const snap = await getDocs(
      query(
        collection(db, "analisesTecnicas"),
        where("status", "==", "pendente_validacao")
      )
    );

    snap.docs.forEach((d) => {
      const data = d.data();

      const dataColetaStr = data.dataColeta
        ? `${data.dataColeta}T${data.horarioColeta ?? "00:00"}`
        : undefined;

      resultado.push({
        id: d.id,
        tipo: "analise_tecnica",
        corpoHidricoNome:
          data.nomeCorpoHidrico ?? data.corpoHidricoNome ?? "Corpo hídrico",
        corpoHidricoId: data.corpoHidricoId,
        colaboradorNome:
          data.tecnicoNome ?? data.colaboradorNome ?? "Técnico",
        colaboradorId: data.tecnicoId ?? data.colaboradorId,
        equipeNome: data.equipeNome,
        criticidade: mapCriticidade(data),
        statusOriginal: data.status ?? "pendente_validacao",
        dataColeta: dataColetaStr ? new Date(dataColetaStr) : undefined,
        dataEnvio: toDate(data.updatedAt ?? data.createdAt),
        descricao:
          data.observacoes ??
          data.descricao ??
          "Análise técnica aguardando validação.",
        dataCriacao: toDate(data.createdAt ?? data.dataCriacao),
      });
    });
  } catch (err) {
    console.warn("[validacoes] analisesTecnicas pendentes:", err);
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "coletaSimples"),
        where("status", "==", "pendente_validacao")
      )
    );

    snap.docs.forEach((d) => {
      const data = d.data();

      resultado.push({
        id: d.id,
        tipo: "medicao_simples",
        corpoHidricoNome:
          data.corpoHidricoNome ??
          data.localNome ??
          data.local ??
          "Corpo hídrico",
        corpoHidricoId: data.corpoHidricoId ?? data.localId,
        colaboradorNome:
          data.usuarioNome ?? data.colaboradorNome ?? "Colaborador",
        colaboradorId: data.usuarioId ?? data.colaboradorId,
        criticidade: mapCriticidade(data),
        statusOriginal: data.status ?? "pendente_validacao",
        dataColeta: toDate(data.dataCriacao),
        dataEnvio: toDate(data.updatedAt ?? data.dataCriacao),
        descricao:
          data.descricao ??
          data.observacao ??
          "Medição aguardando validação.",
        dataCriacao: toDate(data.dataCriacao),
      });
    });
  } catch (err) {
    console.warn("[validacoes] coletaSimples pendentes:", err);
  }
   try {
    const snap = await getDocs(
      query(
        collection(db, "denuncias"),
        where("status", "==", "pendente_validacao")
      )
    );

    snap.docs.forEach((d) => {
      const data = d.data();

      resultado.push({
        id: d.id,
        tipo: "denuncia",
        corpoHidricoNome:
          data.corpoHidricoNome ??
          data.local ??
          "Local informado",
        corpoHidricoId: data.corpoHidricoId,
        colaboradorNome:
          data.denuncianteNome ??
          data.usuarioNome ??
          "Denunciante",
        colaboradorId:
          data.denuncianteId ??
          data.usuarioId,
        criticidade: mapCriticidade(data),
        statusOriginal:
          data.status ?? "pendente_validacao",
        tipoDenuncia:
          data.tipoDenuncia ??
          data.categoria,
        descricao:
          data.descricao ??
          "Denúncia aguardando validação.",
        localidade:
          data.localidade ??
          data.cidade,
        dataCriacao: toDate(
          data.createdAt ??
            data.dataCriacao
        ),
      });
    });
  } catch (err) {
    console.warn(
      "[validacoes] denuncias pendentes:",
      err
    );
  }

  resultado.sort(
    (a, b) =>
      b.dataCriacao.getTime() -
      a.dataCriacao.getTime()
  );

  return resultado;
}

export async function aprovarValidacao(
  item: ItemValidacao,
  gestorId: string
): Promise<void> {
  const colecao =
    item.tipo === "analise_tecnica"
      ? "analisesTecnicas"
      : item.tipo === "denuncia"
      ? "denuncias"
      : "coletaSimples";

  await updateDoc(
    doc(db, colecao, item.id),
    {
      status: "validado",
      validadoPor: gestorId,
      dataValidacao: Timestamp.now(),
    }
  );
}

export async function rejeitarValidacao(
  item: ItemValidacao,
  gestorId: string,
  motivo: string
): Promise<void> {
  const colecao =
    item.tipo === "analise_tecnica"
      ? "analisesTecnicas"
      : item.tipo === "denuncia"
      ? "denuncias"
      : "coletaSimples";

  await updateDoc(
    doc(db, colecao, item.id),
    {
      status: "rejeitado",
      motivoRejeicao: motivo,
      validadoPor: gestorId,
      dataValidacao: Timestamp.now(),
    }
  );
}

export async function buscarEstatisticasValidacao(): Promise<{
  pendentes: number;
  criticas: number;
  atencao: number;
}> {
  const itens =
    await buscarValidacoesPendentes();

  return {
    pendentes: itens.length,

    criticas: itens.filter(
      (i) =>
        i.criticidade === "critica"
    ).length,

    atencao: itens.filter(
      (i) =>
        i.criticidade === "atencao"
    ).length,
  };
}

