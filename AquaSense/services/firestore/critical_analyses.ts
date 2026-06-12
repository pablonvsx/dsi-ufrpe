import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";

export type CriticalOrigin = "medicao" | "observacao" | "denuncia";

export interface CriticalAnalysis {
  id: string;
  origem: CriticalOrigin;
  corpoHidricoId?: string;
  corpoHidricoNome: string;
  colaboradorNome: string;
  cidade?: string;
  estado?: string;
  dataCriacao: Date;
  status: "critico" | "atencao_alta";
  parametros: {
    label: string;
    value: string;
    hint?: string;
    icon: string;
    severity: "critico" | "atencao";
  }[];
  alertas: string[];
  descricao?: string;
}

function toDate(value: any): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date();
}

function normalizarTexto(value?: string | null): string {
  return String(value ?? "").toLowerCase();
}

function isMeasurementCritical(data: any) {
  const ph = Number(data.ph);
  const temperatura = Number(data.temperatura);
  const turbidez = normalizarTexto(data.turbidez);

  return (
    (!Number.isNaN(ph) && (ph < 6 || ph > 9)) ||
    (!Number.isNaN(temperatura) && temperatura >= 30) ||
    turbidez.includes("alta") ||
    turbidez.includes("elevada")
  );
}

function measurementToCritical(id: string, data: any): CriticalAnalysis {
  const parametros: CriticalAnalysis["parametros"] = [];

  const ph = Number(data.ph);
  if (!Number.isNaN(ph) && (ph < 6 || ph > 9)) {
    parametros.push({
      label: "pH",
      value: String(ph).replace(".", ","),
      hint: ph < 6 ? "Muito abaixo do ideal" : "Muito acima do ideal",
      icon: "water-outline",
      severity: "critico",
    });
  }

  const temperatura = Number(data.temperatura);
  if (!Number.isNaN(temperatura) && temperatura >= 30) {
    parametros.push({
      label: "Temp.",
      value: `${String(temperatura).replace(".", ",")}°C`,
      hint: "Acima do ideal",
      icon: "thermometer-outline",
      severity: "atencao",
    });
  }

  if (data.turbidez) {
    const turbidez = normalizarTexto(data.turbidez);
    if (turbidez.includes("alta") || turbidez.includes("elevada")) {
      parametros.push({
        label: "Turbidez",
        value: data.turbidez,
        hint: "Alteração visível",
        icon: "eye-outline",
        severity: "critico",
      });
    }
  }

  return {
    id,
    origem: "medicao",
    corpoHidricoId: data.corpoHidricoId,
    corpoHidricoNome: data.corpoHidricoNome ?? "Corpo hídrico",
    colaboradorNome: data.usuarioNome ?? "Colaborador",
    cidade: data.cidade,
    estado: data.estado ?? "PE",
    dataCriacao: toDate(data.dataCriacao),
    status: "critico",
    parametros,
    alertas: ["Risco ambiental elevado"],
    descricao: data.observacao,
  };
}

function isObservationCritical(data: any) {
  const odor = normalizarTexto(data.odor);
  const cor = normalizarTexto(data.cor);

  return (
    odor.includes("forte") ||
    odor.includes("químico") ||
    odor.includes("quimico") ||
    cor.includes("escura") ||
    cor.includes("marrom") ||
    data.lixo === "sim"
  );
}

function observationToCritical(id: string, data: any): CriticalAnalysis {
  const parametros: CriticalAnalysis["parametros"] = [];

  const odor = normalizarTexto(data.odor);
  if (odor.includes("forte") || odor.includes("químico") || odor.includes("quimico")) {
    parametros.push({
      label: "Odor",
      value: data.odor ?? "Forte",
      hint: "Percepção crítica",
      icon: "reorder-three-outline",
      severity: "critico",
    });
  }

  const cor = normalizarTexto(data.cor);
  if (cor.includes("escura") || cor.includes("marrom")) {
    parametros.push({
      label: "Cor",
      value: data.cor ?? "Escura",
      hint: "Alteração visual",
      icon: "eye-outline",
      severity: "critico",
    });
  }

  if (data.lixo === "sim") {
    parametros.push({
      label: "Lixo",
      value: "Presente",
      hint: "Resíduos acumulados",
      icon: "trash-outline",
      severity: "critico",
    });
  }

  return {
    id,
    origem: "observacao",
    corpoHidricoId: data.corpoHidricoId,
    corpoHidricoNome: data.corpoHidricoNome ?? "Corpo hídrico",
    colaboradorNome: data.usuarioNome ?? "Usuário",
    cidade: data.cidade,
    estado: data.estado ?? "PE",
    dataCriacao: toDate(data.dataCriacao),
    status: parametros.length >= 2 ? "critico" : "atencao_alta",
    parametros,
    alertas: ["Potencial contaminação"],
    descricao:
      data.odorDesc ||
      data.corDesc ||
      data.lixoDesc ||
      data.animaisDesc ||
      "Observação ambiental crítica registrada.",
  };
}

function isComplaintCritical(data: any) {
  const tipo = normalizarTexto(data.tipoProblema);
  const titulo = normalizarTexto(data.titulo);
  const descricao = normalizarTexto(data.descricao);

  return (
    tipo.includes("esgoto") ||
    tipo.includes("poluição") ||
    tipo.includes("poluicao") ||
    tipo.includes("lixo") ||
    tipo.includes("resíduo") ||
    tipo.includes("residuo") ||
    titulo.includes("esgoto") ||
    titulo.includes("poluição") ||
    descricao.includes("esgoto") ||
    descricao.includes("contaminação") ||
    descricao.includes("contaminacao")
  );
}

function complaintToCritical(id: string, data: any): CriticalAnalysis {
  return {
    id,
    origem: "denuncia",
    corpoHidricoId: data.corpoHidricoId,
    corpoHidricoNome: data.corpoHidricoNome ?? "Corpo hídrico",
    colaboradorNome: data.usuarioNome ?? "Usuário",
    cidade: data.cidade,
    estado: data.estado ?? "PE",
    dataCriacao: toDate(data.dataCriacao),
    status: "critico",
    parametros: [
      {
        label: "Denúncia",
        value: data.tipoProblema ?? data.titulo ?? "Problema ambiental",
        hint: "Ocorrência crítica",
        icon: "megaphone-outline",
        severity: "critico",
      },
    ],
    alertas: ["Denúncia ambiental crítica"],
    descricao: data.descricao,
  };
}

export async function getCriticalAnalyses(maxItems = 30): Promise<CriticalAnalysis[]> {
  try {
    const [medicoesSnap, observacoesSnap, denunciasSnap] = await Promise.all([
      getDocs(query(collection(db, "medicoesColaborador"), orderBy("dataCriacao", "desc"), limit(maxItems))),
      getDocs(query(collection(db, "observacoes"), orderBy("dataCriacao", "desc"), limit(maxItems))),
      getDocs(query(collection(db, "denuncias"), orderBy("dataCriacao", "desc"), limit(maxItems))),
    ]);

    const medicoes = medicoesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => isMeasurementCritical(data))
      .map(({ id, data }) => measurementToCritical(id, data));

    const observacoes = observacoesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => isObservationCritical(data))
      .map(({ id, data }) => observationToCritical(id, data));

    const denuncias = denunciasSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => isComplaintCritical(data))
      .map(({ id, data }) => complaintToCritical(id, data));

    return [...medicoes, ...observacoes, ...denuncias].sort(
      (a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime()
    );
  } catch (error) {
    console.error("[getCriticalAnalyses] Erro:", error);
    return [];
  }
}