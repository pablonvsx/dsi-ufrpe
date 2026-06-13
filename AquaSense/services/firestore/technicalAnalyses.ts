import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Query,
    DocumentData,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase'; // mesmo caminho usado em analysis.ts

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AnalysisStatus =
    | 'pendente'
    | 'pendente_validacao'
    | 'aguardando_analise'
    | 'em_analise'
    | 'concluido'
    | 'aprovado'
    | 'rejeitado'
    | 'analisado'
    | 'validado'   // usado em coletaSimples (analysis.ts)
    | 'revisado';  // usado em coletaSimples (analysis.ts)

export type AnalysisOrigin = 'medicao' | 'observacao' | 'denuncia' | 'completa';

export interface ParametroItem {
    label: string;
    value: string;
    icon: string;
    severity?: 'critico' | 'atencao' | 'normal';
    hint?: string;
}

export interface TechnicalAnalysisItem {
    id: string;
    origem: AnalysisOrigin;

    corpoHidricoNome: string;
    corpoHidricoId?: string;

    colaboradorNome: string;
    colaboradorId?: string;

    // ── status e classificação ──
    // status: controla Pendentes vs Histórico
    status: AnalysisStatus;
    // classificacao/nivelRisco: controla aba Críticas (independente do status)
    classificacao?: 'critica' | 'atencao' | 'normal';
    nivelRisco?: 'critico' | 'alto' | 'medio' | 'baixo';
    statusQualidade?: string;

    descricao?: string;
    parametros?: ParametroItem[];
    alertas?: string[];

    cidade?: string;
    estado?: string;
    municipio?: string;

    dataCriacao: Date;
    dataAtualizacao?: Date;

    _raw?: DocumentData;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Status que significam "aguardando avaliação técnica".
 * Aba Pendentes filtra por estes — SEM considerar criticidade.
 */
const PENDING_STATUSES: string[] = [
    'pendente',
    'pendente_validacao',
    'aguardando_analise',
    'em_analise',
];

/**
 * Status que significam "avaliação já concluída".
 * Aba Histórico.
 */
const DONE_STATUSES: string[] = [
    'concluido',
    'aprovado',
    'rejeitado',
    'analisado',
    'validado',
    'revisado',
];

/**
 * Coleções do projeto e a origem que representam.
 * Baseado em analysis.ts: coletaSimples, coletaCompleta + denuncias.
 */
interface ColConfig {
    name: string;
    origin: AnalysisOrigin;
    /**
     * Se verdadeiro, a coleção usa campo "tipo" para diferenciar
     * medição de observação (caso coletaSimples).
     */
    hasTipoField?: boolean;
}

const COLLECTIONS: ColConfig[] = [
    { name: 'coletaSimples',  origin: 'medicao',    hasTipoField: true  },
    { name: 'coletaCompleta', origin: 'completa',   hasTipoField: false },
    { name: 'denuncias',      origin: 'denuncia',   hasTipoField: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
    if (!val) return new Date(0);
    if (val instanceof Timestamp)  return val.toDate();
    if (val instanceof Date)       return val;
    if (typeof val === 'string')   return new Date(val);
    if (typeof val === 'number')   return new Date(val);
    if (typeof val === 'object' && 'seconds' in (val as object)) {
        return new Date((val as { seconds: number }).seconds * 1000);
    }
    return new Date(0);
}

function detectDate(data: DocumentData): Date {
    return toDate(
        data.dataCriacao  ??   // campo principal em coletaSimples e coletaCompleta
        data.createdAt    ??
        data.timestamp    ??
        data.dataRegistro ??
        data.dataEnvio    ??
        data.updatedAt    ??
        null
    );
}

function sortByDateDesc(items: TechnicalAnalysisItem[]): TechnicalAnalysisItem[] {
    return [...items].sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime());
}

/**
 * Mapeia um documento Firestore → TechnicalAnalysisItem.
 * Cobre os campos de coletaSimples, coletaCompleta e denuncias.
 */
function mapDoc(
    id: string,
    data: DocumentData,
    col: ColConfig,
): TechnicalAnalysisItem {
    // Origem: coletaSimples usa campo "tipo" para indicar medicao/observacao
    const origem: AnalysisOrigin =
        col.hasTipoField && data.tipo === 'observacao'
            ? 'observacao'
            : col.origin;

    return {
        id,
        origem,
        corpoHidricoNome:
            data.corpoHidricoNome ??
            data.nomeCorpoHidrico ??
            data.localNome        ??
            data.local            ??
            'Corpo hídrico não informado',
        corpoHidricoId: data.corpoHidricoId ?? data.localId,
        colaboradorNome:
            data.usuarioNome     ??   // campo em coletaSimples/coletaCompleta
            data.colaboradorNome ??
            data.nomeColaborador ??
            data.nomeUsuario     ??
            data.autor           ??
            'Colaborador não informado',
        colaboradorId:
            data.usuarioId       ??
            data.colaboradorId   ??
            data.autorId,
        status: (data.status ?? 'pendente') as AnalysisStatus,
        classificacao: data.classificacao,
        nivelRisco:    data.nivelRisco,
        statusQualidade: data.statusQualidade,
        descricao:
            data.descricao   ??
            data.observacao  ??
            data.texto       ??
            data.conteudo,
        // coletaSimples não tem "parametros" estruturado; monta a partir de pH/temperatura
        parametros: data.parametros ?? data.medicoes ?? buildParametros(data),
        alertas: data.alertas ?? [],
        cidade:    data.cidade    ?? data.municipio,
        estado:    data.estado    ?? data.uf,
        municipio: data.municipio,
        dataCriacao:    detectDate(data),
        dataAtualizacao: data.updatedAt ? toDate(data.updatedAt) : undefined,
        _raw: data,
    };
}

/**
 * Constrói array de parametros para docs de coletaSimples/coletaCompleta
 * que armazenam pH, temperatura etc. como campos soltos.
 */
function buildParametros(data: DocumentData): ParametroItem[] {
    const params: ParametroItem[] = [];

    if (data.pH !== undefined && data.pH !== null) {
        const ph = Number(data.pH);
        params.push({
            label: 'pH',
            value: ph.toFixed(1),
            icon: 'flask-outline',
            severity: ph < 6 || ph > 8.5 ? 'critico' : 'normal',
            hint: ph < 6 ? 'Ácido' : ph > 8.5 ? 'Alcalino' : undefined,
        });
    }

    if (data.temperatura !== undefined && data.temperatura !== null) {
        const t = Number(data.temperatura);
        params.push({
            label: 'Temperatura',
            value: `${t.toFixed(1)} °C`,
            icon: 'thermometer-outline',
            severity: t < 15 || t > 35 ? 'atencao' : 'normal',
        });
    }

    if (data.turbidez !== undefined && data.turbidez !== null) {
        params.push({
            label: 'Turbidez',
            value: `${Number(data.turbidez).toFixed(0)} NTU`,
            icon: 'water-outline',
        });
    }

    if (data.conductividade !== undefined && data.conductividade !== null) {
        params.push({
            label: 'Condutividade',
            value: `${Number(data.conductividade).toFixed(0)} µS/cm`,
            icon: 'pulse-outline',
        });
    }

    return params;
}

// ─── safeFetch ────────────────────────────────────────────────────────────────

/**
 * Executa a query com orderBy('dataCriacao').
 * Se falhar por índice ausente → refaz sem orderBy e ordena localmente.
 * permission-denied → silencioso.
 */
async function safeFetch(
    col: ColConfig,
    baseQuery: Query<DocumentData>,
): Promise<TechnicalAnalysisItem[]> {
    // Tentativa 1: com orderBy no campo correto do projeto
    try {
        const q = query(baseQuery, orderBy('dataCriacao', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => mapDoc(d.id, d.data(), col));
    } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? '';

        if (code === 'failed-precondition') {
            // Tentativa 2: sem orderBy → ordena localmente
            try {
                const snap = await getDocs(baseQuery);
                const items = snap.docs.map(d => mapDoc(d.id, d.data(), col));
                return sortByDateDesc(items);
            } catch (err2: unknown) {
                const code2 = (err2 as { code?: string })?.code ?? '';
                if (code2 !== 'permission-denied') {
                    console.warn(`[technicalAnalyses] ${col.name} fallback falhou:`, code2);
                }
                return [];
            }
        }

        if (code !== 'permission-denied') {
            console.warn(`[technicalAnalyses] ${col.name}:`, code);
        }
        return [];
    }
}

// ─── Função genérica interna ──────────────────────────────────────────────────

/**
 * Busca documentos em todas as coleções filtrando por uma lista de status.
 * NÃO filtra por criticidade — essa decisão fica na camada de apresentação.
 */
async function fetchByStatuses(
    statuses: string[],
    maxPerCollection: number,
): Promise<TechnicalAnalysisItem[]> {
    const results: TechnicalAnalysisItem[] = [];

    await Promise.allSettled(
        COLLECTIONS.map(async col => {
            const colRef = collection(db, col.name);

            // Uma query por status (evita "in" que exige índice composto)
            const subResults = await Promise.allSettled(
                statuses.map(status => {
                    const q = query(
                        colRef,
                        where('status', '==', status),
                        limit(maxPerCollection),
                    );
                    return safeFetch(col, q);
                })
            );

            for (const r of subResults) {
                if (r.status === 'fulfilled') {
                    results.push(...r.value);
                }
            }
        })
    );

    // Deduplica por id e ordena
    const unique = Array.from(new Map(results.map(i => [i.id, i])).values());
    return sortByDateDesc(unique);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Aba PENDENTES — filtra por STATUS pendente, sem filtro de criticidade.
 * Inclui: medições, observações, denúncias, completas — críticas e não críticas.
 */
export async function getPendingAnalyses(
    maxPerCollection = 50,
): Promise<TechnicalAnalysisItem[]> {
    return fetchByStatuses(PENDING_STATUSES, maxPerCollection);
}

/**
 * Aba HISTÓRICO — registros já avaliados/concluídos.
 */
export async function getDoneAnalyses(
    maxPerCollection = 50,
): Promise<TechnicalAnalysisItem[]> {
    return fetchByStatuses(DONE_STATUSES, maxPerCollection);
}

/**
 * Aba CRÍTICAS — filtra por classificação crítica, independente de status.
 * Busca em todas as coleções por campos de criticidade conhecidos.
 */
export async function getCriticalPendingAnalyses(
    maxPerCollection = 50,
): Promise<TechnicalAnalysisItem[]> {
    const results: TechnicalAnalysisItem[] = [];

    // Campos e valores que indicam criticidade nas coleções do projeto
    const criticalFilters: Array<{ field: string; value: string }> = [
        { field: 'classificacao', value: 'critica'  },
        { field: 'nivelRisco',    value: 'critico'  },
        { field: 'statusQualidade', value: 'critica' },
        { field: 'status',        value: 'critico'  }, // alguns docs usam status diretamente
    ];

    await Promise.allSettled(
        COLLECTIONS.map(async col => {
            const colRef = collection(db, col.name);

            const subResults = await Promise.allSettled(
                criticalFilters.map(({ field, value }) => {
                    const q = query(
                        colRef,
                        where(field, '==', value),
                        limit(maxPerCollection),
                    );
                    return safeFetch(col, q);
                })
            );

            for (const r of subResults) {
                if (r.status === 'fulfilled') {
                    results.push(...r.value);
                }
            }
        })
    );

    const unique = Array.from(new Map(results.map(i => [i.id, i])).values());
    return sortByDateDesc(unique);
}

/**
 * Home Técnico — última contribuição/análise de um técnico.
 * Tenta campos alternativos sem gerar warnings repetidos.
 */
export async function getLastAnalysisByTecnico(
    tecnicoId: string,
): Promise<TechnicalAnalysisItem | null> {
    const TECNICO_FIELDS = ['tecnicoId', 'analisadoPorId', 'responsavelId', 'usuarioId'];

    for (const col of COLLECTIONS) {
        for (const field of TECNICO_FIELDS) {
            try {
                const q = query(
                    collection(db, col.name),
                    where(field, '==', tecnicoId),
                    limit(1),
                );
                const items = await safeFetch(col, q);
                if (items.length > 0) return items[0];
            } catch {
                // silencioso
            }
        }
    }
    return null;
}