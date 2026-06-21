import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { CorpoHidrico } from "@/types/water_bodies";

export interface RegiaoOcorrencia {
  nome: string;
  total: number;
  corDominante: string;
}

export interface OcorrenciaDashboard {
  id: string;
  nomeCorpo: string;
  tipo: string;
  nivel: "Crítico" | "Atenção" | "Informativo";
  descricaoRisco: string;
  criadoEm: any;
}

export interface CorpoHidricoComNivel extends CorpoHidrico {
  nivelAtual: number; // 1=boa 2=normal 3=atenção 4=crítico 5=sem dados
}

export async function buscarOcorrenciasPrioritarias(
  n: number = 3
): Promise<OcorrenciaDashboard[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "alertas"),
        orderBy("criadoEm", "desc"),
        limit(20)
      )
    );

    return snap.docs
      .map((d) => {
        const data = d.data();
        const nivel: "Crítico" | "Atenção" | "Informativo" =
          data.nivel === "Crítico"
            ? "Crítico"
            : data.nivel === "Atenção"
            ? "Atenção"
            : "Informativo";

        let descricaoRisco = "Monitoramento ativo";
        if (nivel === "Crítico") descricaoRisco = "Risco muito alto";
        else if (nivel === "Atenção")
          descricaoRisco = data.recorrente ? "Risco alto" : "Risco moderado";

        let tipo = "Análise técnica";
        if (data.tipoOrigem === "operacional") tipo = "Ação operacional";
        else if (nivel === "Crítico") tipo = "Denúncia ambiental";
        else if (nivel === "Informativo") tipo = "Medição simples";

        return {
          id: d.id,
          nomeCorpo: data.corpoHidricoNome || data.titulo || "Corpo hídrico",
          tipo,
          nivel,
          descricaoRisco,
          criadoEm: data.criadoEm,
          _ativo: data.ativo !== false,
        };
      })
      .filter((i) => i._ativo && i.nivel !== "Informativo")
      .map(({ _ativo, ...rest }) => rest)
      .slice(0, n);
  } catch (err) {
    console.error("[dashboard] buscarOcorrenciasPrioritarias:", err);
    return [];
  }
}

export async function buscarRankingRegioes(
  daysBack: number = 7
): Promise<RegiaoOcorrencia[]> {
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - daysBack);

    const snap = await getDocs(
      query(
        collection(db, "alertas"),
        where("criadoEm", ">=", Timestamp.fromDate(dataInicio)),
        orderBy("criadoEm", "desc")
      )
    );

    const mapa: Record<string, { total: number; critico: number; atencao: number }> = {};

    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.ativo === false) return;
      const chave =
        (data.cidade?.trim()) ||
        (data.corpoHidricoNome?.trim()) ||
        "Desconhecido";
      if (!mapa[chave]) mapa[chave] = { total: 0, critico: 0, atencao: 0 };
      mapa[chave].total++;
      if (data.nivel === "Crítico") mapa[chave].critico++;
      else if (data.nivel === "Atenção") mapa[chave].atencao++;
    });

    return Object.entries(mapa)
      .map(([nome, stats]) => ({
        nome,
        total: stats.total,
        corDominante:
          stats.critico > 0 ? "#EF4444" : stats.atencao > 0 ? "#F97316" : "#22C55E",
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  } catch (err) {
    console.error("[dashboard] buscarRankingRegioes:", err);
    return [];
  }
}

export async function buscarCorposHidricosParaMapa(): Promise<CorpoHidricoComNivel[]> {
  try {
    const dataLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [corposSnap, coletasSnap] = await Promise.all([
      getDocs(
        query(collection(db, "corposHidricos"), where("cadastroValido", "==", true))
      ),
      getDocs(
        query(
          collection(db, "coletaSimples"),
          where("data", ">=", Timestamp.fromDate(dataLimite)),
          orderBy("data", "desc")
        )
      ),
    ]);

    const nivelPorCorpo: Record<string, number> = {};
    coletasSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.corpoHidricoId && !nivelPorCorpo[data.corpoHidricoId]) {
        nivelPorCorpo[data.corpoHidricoId] = data.nivelAlerta ?? 2;
      }
    });

    return corposSnap.docs
      .map((d) => ({
        ...(d.data() as CorpoHidrico),
        id: d.id,
        nivelAtual: nivelPorCorpo[d.id] ?? 5,
      }))
      .filter((c) => c.latitude && c.longitude);
  } catch (err) {
    console.error("[dashboard] buscarCorposHidricosParaMapa:", err);
    return [];
  }
}