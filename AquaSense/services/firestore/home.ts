/**
 * services/firestore/home.ts
 *
 * Service que alimenta a Home do Colaborador no AquaSense.
 * Fontes de dados: usuarios, corposHidricos, medicoesColaborador, denuncias.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLECAO_USUARIOS = "usuarios";
const COLECAO_CORPOS_HIDRICOS = "corposHidricos";
const COLECAO_MEDICOES = "medicoesColaborador";
const COLECAO_DENUNCIAS = "denuncias";
// Reservadas para uso futuro — incluídas para facilitar expansão:
// const COLECAO_OBSERVACOES = "observacoes";
// const COLECAO_ACOES = "acoesComunitarias";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface CorpoHidricoHome {
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
    status?: string;
}

export type TipoAtividadeHome = "medicao" | "denuncia" | "observacao" | "contribuicao";
export type StatusAtividadeHome = "validada" | "pendente" | "analise";

export interface AtividadeHome {
    id: string;
    tipo: TipoAtividadeHome;
    titulo: string;
    detalhe: string;
    data: Date;
    status: StatusAtividadeHome;
}

export interface NumerosHome {
    contribuicoes: number;
    denuncias: number;
    corposHidricos: number;
    alertas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    return new Date();
}

/** Converte status do Firestore para o tipo esperado pela UI */
function resolverStatus(raw?: string): StatusAtividadeHome {
    const s = (raw ?? "").toLowerCase();
    if (s === "validada") return "validada";
    if (s === "em_analise" || s === "analise" || s === "em analise") return "analise";
    return "pendente";
}

/** Monta descrição resumida de uma medição */
function resumoMedicao(data: Record<string, unknown>): string {
    const partes: string[] = [];
    if (data.ph != null) partes.push(`pH: ${data.ph}`);
    if (data.turbidez) partes.push(`Turbidez: ${data.turbidez}`);
    if (data.temperatura != null) partes.push(`Temp.: ${data.temperatura}°C`);
    if (data.observacao) partes.push(String(data.observacao));
    return partes.join(" • ") || "Medição registrada";
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Retorna o último corpo hídrico acessado pelo colaborador.
 *
 * Fluxo:
 * 1. Lê `ultimoCorpoHidricoAcessadoId` do documento do usuário.
 * 2. Busca os metadados completos na coleção `corposHidricos`.
 * 3. Se não houver ID salvo ou o documento não existir, retorna null.
 */
export async function getLastAccessedWaterBody(
    uid: string
): Promise<CorpoHidricoHome | null> {
    try {
        // 1. Documento do usuário
        const usuarioSnap = await getDoc(doc(db, COLECAO_USUARIOS, uid));
        if (!usuarioSnap.exists()) return null;

        const ultimoId = usuarioSnap.data()?.ultimoCorpoHidricoAcessadoId as
            | string
            | undefined;
        if (!ultimoId) return null;

        // 2. Metadados do corpo hídrico
        const corpoSnap = await getDoc(doc(db, COLECAO_CORPOS_HIDRICOS, ultimoId));
        if (!corpoSnap.exists()) return null;

        const d = corpoSnap.data();
        return {
            id: corpoSnap.id,
            nome: (d.nome as string) ?? "Corpo hídrico",
            cidade: (d.cidade ?? d.municipio) as string | undefined,
            estado: (d.estado ?? d.uf) as string | undefined,
            status: (d.status ?? d.qualidade) as string | undefined,
        };
    } catch (err) {
        console.warn("[home] getLastAccessedWaterBody:", err);
        return null;
    }
}

/**
 * Retorna as atividades recentes do colaborador (máximo 5, mais recentes primeiro).
 *
 * Fontes atuais:
 * - medicoesColaborador  → tipo "medicao"
 * - denuncias            → tipo "denuncia"
 *
 * Fontes preparadas para uso futuro (descomente quando as coleções existirem):
 * - observacoes          → tipo "observacao"
 * - acoesComunitarias    → tipo "contribuicao"
 */
export async function getUserRecentActivities(
    uid: string
): Promise<AtividadeHome[]> {
    const resultados: AtividadeHome[] = [];

    // ── Medições do colaborador ─────────────────────────────────────────────
    try {
        const q = query(
            collection(db, COLECAO_MEDICOES),
            where("usuarioId", "==", uid),
            orderBy("dataCriacao", "desc"),
            limit(5)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            resultados.push({
                id: d.id,
                tipo: "medicao",
                titulo: `Medição – ${(data.corpoHidricoNome as string) ?? "Corpo hídrico"}`,
                detalhe: resumoMedicao(data),
                data: toDate(data.dataCriacao),
                status: resolverStatus(data.status as string),
            });
        });
    } catch (err) {
        console.warn("[home] getUserRecentActivities (medicoes):", err);
    }

    // ── Denúncias ───────────────────────────────────────────────────────────
    try {
        const q = query(
            collection(db, COLECAO_DENUNCIAS),
            where("usuarioId", "==", uid),
            orderBy("dataCriacao", "desc"),
            limit(5)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            resultados.push({
                id: d.id,
                tipo: "denuncia",
                titulo: `Denúncia – ${(data.tipoProblema as string) ?? "Problema ambiental"}`,
                detalhe:
                    (data.descricao as string) ||
                    (data.corpoHidricoNome as string) ||
                    "",
                data: toDate(data.dataCriacao),
                status: resolverStatus(data.status as string),
            });
        });
    } catch (err) {
        // A coleção ainda pode não existir — não quebrar
        console.warn("[home] getUserRecentActivities (denuncias):", err);
    }

    // ── Observações (futura) ────────────────────────────────────────────────
    // Descomente quando a coleção `observacoes` for criada:
    //
    // try {
    //   const q = query(
    //     collection(db, "observacoes"),
    //     where("usuarioId", "==", uid),
    //     orderBy("dataCriacao", "desc"),
    //     limit(5)
    //   );
    //   const snap = await getDocs(q);
    //   snap.forEach((d) => {
    //     const data = d.data() as Record<string, unknown>;
    //     resultados.push({
    //       id: d.id,
    //       tipo: "observacao",
    //       titulo: `Observação – ${(data.tipo as string) ?? "Ambiental"}`,
    //       detalhe: `${data.corpoHidricoNome ?? ""} • ${data.descricao ?? ""}`,
    //       data: toDate(data.dataCriacao),
    //       status: resolverStatus(data.status as string),
    //     });
    //   });
    // } catch (err) {
    //   console.warn("[home] getUserRecentActivities (observacoes):", err);
    // }

    // Ordena globalmente por data decrescente e limita a 5
    return resultados
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, 5);
}

/**
 * Retorna os contadores exibidos na seção "Sua comunidade em números".
 *
 * Regras:
 * - Conta apenas registros reais do Firestore.
 * - Se a coleção não existir ou estiver vazia, retorna 0.
 * - Nunca usa valores fictícios.
 */
export async function getHomeCommunityNumbers(uid: string): Promise<NumerosHome> {
    const numeros: NumerosHome = {
        contribuicoes: 0,
        denuncias: 0,
        corposHidricos: 0,
        alertas: 0,
    };

    // ── Contribuições do usuário (medicoesColaborador) ──────────────────────
    try {
        const snap = await getDocs(
            query(collection(db, COLECAO_MEDICOES), where("usuarioId", "==", uid))
        );
        numeros.contribuicoes = snap.size;
    } catch (err) {
        console.warn("[home] getHomeCommunityNumbers (medicoes):", err);
    }

    // ── Denúncias do usuário ────────────────────────────────────────────────
    try {
        const snap = await getDocs(
            query(collection(db, COLECAO_DENUNCIAS), where("usuarioId", "==", uid))
        );
        numeros.denuncias = snap.size;
    } catch (err) {
        // A coleção pode ainda não existir
        console.warn("[home] getHomeCommunityNumbers (denuncias):", err);
    }

    // ── Corpos hídricos acompanhados pelo usuário ───────────────────────────
    try {
        const snap = await getDocs(
            query(
                collection(db, COLECAO_CORPOS_HIDRICOS),
                where("colaboradoresIds", "array-contains", uid)
            )
        );
        numeros.corposHidricos = snap.size;
    } catch (err) {
        console.warn("[home] getHomeCommunityNumbers (corposHidricos):", err);
    }

    // ── Alertas na região ───────────────────────────────────────────────────
    // Tenta buscar cidade do usuário para filtrar; se não houver, conta global.
    try {
        let cidadeUsuario: string | undefined;
        try {
            const usuarioSnap = await getDoc(doc(db, COLECAO_USUARIOS, uid));
            cidadeUsuario = usuarioSnap.data()?.cidade as string | undefined;
        } catch {}

        const alertasQuery =
            cidadeUsuario
                ? query(
                      collection(db, "alertas"),
                      where("cidade", "==", cidadeUsuario)
                  )
                : query(collection(db, "alertas"));

        const snap = await getDocs(alertasQuery);
        numeros.alertas = snap.size;
    } catch (err) {
        // A coleção pode ainda não existir
        console.warn("[home] getHomeCommunityNumbers (alertas):", err);
    }

    return numeros;
}