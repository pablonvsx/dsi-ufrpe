import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Query,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { uploadMultiplasImagens } from '@/services/storage/supabaseStorage';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Status / origem ──────────────────────────────────────────────────────────

export type AnalysisStatus =
  | 'pendente'
  | 'pendente_validacao'
  | 'aguardando_analise'
  | 'em_analise'
  | 'concluido'
  | 'aprovado'
  | 'rejeitado'
  | 'analisado'
  | 'validado'
  | 'revisado';

export type AnalysisOrigin = 'medicao' | 'observacao' | 'denuncia' | 'completa';

export type RiscoAmbiental = 'normal' | 'atencao' | 'critico' | 'sem_dados';

// ─── Parâmetros da análise técnica (escrita) ──────────────────────────────────

export interface LocalColeta {
  latitude: number;
  longitude: number;
  precisao?: number;
  origem: 'atual' | 'mapa';
}

export interface ParametrosAgua {
  ph: number | null;
  oxigenioDissolvido: number | null;
  dbo: number | null;
  nitrato: number | null;
  amonio: number | null;
  nitrogenioTotal: number | null;
  ortofosfato: number | null;
  temperatura: number | null;
}

export interface TechnicalAnalysisPayload {
  coletaId: string;
  corpoHidricoId: string;
  nomeCorpoHidrico: string;
  tipoCorpoHidrico: string;
  localizacaoCorpoHidrico: string;
  tecnicoId: string;
  tecnicoNome: string;
  dataColeta: string;
  horarioColeta: string;
  localColeta: LocalColeta;
  parametros: ParametrosAgua;
  observacoes: string;
  fotos: string[];
  status: AnalysisStatus;
  riscoAmbiental?: RiscoAmbiental;
}

export interface TechnicalAnalysis extends TechnicalAnalysisPayload {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Item de listagem (leitura — painel técnico) ──────────────────────────────

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

  status: AnalysisStatus;
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════════

/** Status que representam "aguardando avaliação técnica". */
const PENDING_STATUSES: string[] = [
  'pendente',
  'pendente_validacao',
  'aguardando_analise',
  'em_analise',
];

/** Status que representam "avaliação já concluída". */
const DONE_STATUSES: string[] = [
  'concluido',
  'aprovado',
  'rejeitado',
  'analisado',
  'validado',
  'revisado',
];

interface ColConfig {
  name: string;
  origin: AnalysisOrigin;
  hasTipoField?: boolean;
}

/**
 * Coleções do projeto.
 * analisesTecnicas = nova coleção criada pela tela de análise técnica.
 * As demais já existiam (coletaSimples, coletaCompleta, denuncias).
 */
const COLLECTIONS: ColConfig[] = [
  { name: 'analisesTecnicas', origin: 'completa',  hasTipoField: false },
  { name: 'coletaSimples',    origin: 'medicao',   hasTipoField: true  },
  { name: 'coletaCompleta',   origin: 'completa',  hasTipoField: false },
  { name: 'denuncias',        origin: 'denuncia',  hasTipoField: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════════

function toDate(val: unknown): Date {
  if (!val) return new Date(0);
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date)      return val;
  if (typeof val === 'string')  return new Date(val);
  if (typeof val === 'number')  return new Date(val);
  if (typeof val === 'object' && 'seconds' in (val as object)) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date(0);
}

function detectDate(data: DocumentData): Date {
  return toDate(
    data.dataCriacao  ??
    data.createdAt    ??
    data.timestamp    ??
    data.dataRegistro ??
    data.dataEnvio    ??
    data.updatedAt    ??
    null,
  );
}

function sortByDateDesc(items: TechnicalAnalysisItem[]): TechnicalAnalysisItem[] {
  return [...items].sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime());
}

/**
 * Constrói array de ParametroItem para docs que armazenam pH/temperatura
 * como campos soltos (coletaSimples, coletaCompleta).
 * Para analisesTecnicas, os parâmetros ficam em data.parametros (objeto),
 * então esta função converte esse objeto também.
 */
function buildParametros(data: DocumentData): ParametroItem[] {
  const params: ParametroItem[] = [];

  // analisesTecnicas salva parametros como objeto { ph, oxigenioDissolvido, ... }
  const p = data.parametros as ParametrosAgua | undefined;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    if (p.ph !== null && p.ph !== undefined) {
      const ph = Number(p.ph);
      params.push({
        label: 'pH', value: ph.toFixed(1), icon: 'flask-outline',
        severity: ph < 6 || ph > 8.5 ? 'critico' : 'normal',
        hint: ph < 6 ? 'Ácido' : ph > 8.5 ? 'Alcalino' : undefined,
      });
    }
    if (p.oxigenioDissolvido !== null && p.oxigenioDissolvido !== undefined)
      params.push({ label: 'OD', value: `${Number(p.oxigenioDissolvido).toFixed(1)} mg/L`, icon: 'water-outline' });
    if (p.dbo !== null && p.dbo !== undefined)
      params.push({ label: 'DBO', value: `${Number(p.dbo).toFixed(1)} mg/L`, icon: 'pulse-outline' });
    if (p.temperatura !== null && p.temperatura !== undefined) {
      const t = Number(p.temperatura);
      params.push({
        label: 'Temperatura', value: `${t.toFixed(1)} °C`, icon: 'thermometer-outline',
        severity: t < 15 || t > 35 ? 'atencao' : 'normal',
      });
    }
    return params;
  }

  // coletaSimples / coletaCompleta — campos soltos
  if (data.pH !== undefined && data.pH !== null) {
    const ph = Number(data.pH);
    params.push({
      label: 'pH', value: ph.toFixed(1), icon: 'flask-outline',
      severity: ph < 6 || ph > 8.5 ? 'critico' : 'normal',
      hint: ph < 6 ? 'Ácido' : ph > 8.5 ? 'Alcalino' : undefined,
    });
  }
  if (data.temperatura !== undefined && data.temperatura !== null) {
    const t = Number(data.temperatura);
    params.push({
      label: 'Temperatura', value: `${t.toFixed(1)} °C`, icon: 'thermometer-outline',
      severity: t < 15 || t > 35 ? 'atencao' : 'normal',
    });
  }
  if (data.turbidez !== undefined && data.turbidez !== null)
    params.push({ label: 'Turbidez', value: `${Number(data.turbidez).toFixed(0)} NTU`, icon: 'water-outline' });
  if (data.conductividade !== undefined && data.conductividade !== null)
    params.push({ label: 'Condutividade', value: `${Number(data.conductividade).toFixed(0)} µS/cm`, icon: 'pulse-outline' });

  return params;
}

/**
 * Mapeia um documento Firestore → TechnicalAnalysisItem (usado na listagem).
 * Cobre analisesTecnicas, coletaSimples, coletaCompleta e denuncias.
 */
function mapDoc(
  id: string,
  data: DocumentData,
  col: ColConfig,
): TechnicalAnalysisItem {
  const origem: AnalysisOrigin =
    col.hasTipoField && data.tipo === 'observacao' ? 'observacao' : col.origin;

  return {
    id,
    origem,
    corpoHidricoNome:
      data.nomeCorpoHidrico  ??   // analisesTecnicas
      data.corpoHidricoNome  ??
      data.localNome         ??
      data.local             ??
      'Corpo hídrico não informado',
    corpoHidricoId: data.corpoHidricoId ?? data.localId,
    colaboradorNome:
      data.tecnicoNome       ??   // analisesTecnicas
      data.usuarioNome       ??
      data.colaboradorNome   ??
      data.nomeColaborador   ??
      data.nomeUsuario       ??
      data.autor             ??
      'Colaborador não informado',
    colaboradorId:
      data.tecnicoId         ??   // analisesTecnicas
      data.usuarioId         ??
      data.colaboradorId     ??
      data.autorId,
    status:          (data.status ?? 'pendente') as AnalysisStatus,
    classificacao:   data.classificacao,
    nivelRisco:      data.nivelRisco ?? data.riscoAmbiental,  // riscoAmbiental de analisesTecnicas
    statusQualidade: data.statusQualidade,
    descricao:
      data.observacoes ??   // analisesTecnicas
      data.descricao   ??
      data.observacao  ??
      data.texto       ??
      data.conteudo,
    // Se o doc já tiver parametros como array (coletaSimples formatado), usa direto.
    // Caso contrário, buildParametros converte campos soltos ou objeto estruturado.
    parametros: Array.isArray(data.parametros)
      ? data.parametros
      : buildParametros(data),
    alertas:  data.alertas ?? [],
    cidade:   data.cidade   ?? data.municipio,
    estado:   data.estado   ?? data.uf,
    municipio: data.municipio,
    dataCriacao:     detectDate(data),
    dataAtualizacao: data.updatedAt ? toDate(data.updatedAt) : undefined,
    _raw: data,
  };
}

// ─── safeFetch ────────────────────────────────────────────────────────────────

/**
 * Executa a query com orderBy('dataCriacao' / 'createdAt').
 * Se falhar por índice ausente → refaz sem orderBy e ordena localmente.
 * permission-denied → silencioso.
 */
async function safeFetch(
  col: ColConfig,
  baseQuery: Query<DocumentData>,
): Promise<TechnicalAnalysisItem[]> {
  // O campo de data varia: analisesTecnicas usa createdAt; as demais usam dataCriacao.
  const dateField = col.name === 'analisesTecnicas' ? 'createdAt' : 'dataCriacao';

  try {
    const q = query(baseQuery, orderBy(dateField, 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapDoc(d.id, d.data(), col));
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';

    if (code === 'failed-precondition') {
      try {
        const snap = await getDocs(baseQuery);
        const items = snap.docs.map(d => mapDoc(d.id, d.data(), col));
        return sortByDateDesc(items);
      } catch (err2: unknown) {
        const code2 = (err2 as { code?: string })?.code ?? '';
        if (code2 !== 'permission-denied')
          console.warn(`[technicalAnalyses] ${col.name} fallback falhou:`, code2);
        return [];
      }
    }

    if (code !== 'permission-denied')
      console.warn(`[technicalAnalyses] ${col.name}:`, code);
    return [];
  }
}

// ─── fetchByStatuses ──────────────────────────────────────────────────────────

async function fetchByStatuses(
  statuses: string[],
  maxPerCollection: number,
): Promise<TechnicalAnalysisItem[]> {
  const results: TechnicalAnalysisItem[] = [];

  await Promise.allSettled(
    COLLECTIONS.map(async col => {
      const colRef = collection(db, col.name);
      const subResults = await Promise.allSettled(
        statuses.map(status => {
          const q = query(colRef, where('status', '==', status), limit(maxPerCollection));
          return safeFetch(col, q);
        }),
      );
      for (const r of subResults) {
        if (r.status === 'fulfilled') results.push(...r.value);
      }
    }),
  );

  const unique = Array.from(new Map(results.map(i => [i.id, i])).values());
  return sortByDateDesc(unique);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE ESCRITA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula o risco ambiental a partir dos parâmetros da análise técnica.
 */
function calcularRisco(p: ParametrosAgua): RiscoAmbiental {
  if (p.ph === null && p.oxigenioDissolvido === null && p.temperatura === null)
    return 'sem_dados';

  const critico =
    (p.ph !== null && (p.ph < 5 || p.ph > 9)) ||
    (p.oxigenioDissolvido !== null && p.oxigenioDissolvido < 2) ||
    (p.dbo !== null && p.dbo > 10) ||
    (p.temperatura !== null && p.temperatura > 40);
  if (critico) return 'critico';

  const atencao =
    (p.ph !== null && (p.ph < 6 || p.ph > 8.5)) ||
    (p.oxigenioDissolvido !== null && p.oxigenioDissolvido < 5) ||
    (p.temperatura !== null && p.temperatura > 35);
  if (atencao) return 'atencao';

  return 'normal';
}

// ═══════════════════════════════════════════════════════════════════════════════
// API PÚBLICA — ESCRITA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Faz upload das fotos para o storage e retorna as URLs públicas.
 */
export async function uploadTechnicalAnalysisPhotos(
  uris: string[],
  analysisId: string,
): Promise<string[]> {
  if (uris.length === 0) return [];
  const resultados = await uploadMultiplasImagens(uris, analysisId);
  return resultados
    .map((r: any) => r.url ?? r.publicUrl ?? r.uri ?? '')
    .filter(Boolean);
}

/**
 * Cria uma análise técnica na coleção `analisesTecnicas`.
 * Faz upload das fotos, salva o documento e atualiza o corpo hídrico.
 * Retorna o ID do documento criado.
 */
export async function createTechnicalAnalysis(
  payload: Omit<TechnicalAnalysisPayload, 'fotos'>,
  fotoUris: string[],
): Promise<string> {
  const riscoAmbiental = calcularRisco(payload.parametros);

  // 1. Criar documento (sem fotos ainda, para obter o ID)
  const docRef = await addDoc(collection(db, 'analisesTecnicas'), {
    ...payload,
    fotos: [],
    riscoAmbiental,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Upload das fotos e atualização do documento
  if (fotoUris.length > 0) {
    const fotosUrls = await uploadTechnicalAnalysisPhotos(fotoUris, docRef.id);
    await updateDoc(docRef, { fotos: fotosUrls, updatedAt: serverTimestamp() });
  }

  // 3. Atualizar corpo hídrico com dados da última análise
  if (payload.corpoHidricoId) {
    await updateDoc(doc(db, 'corposHidricos', payload.corpoHidricoId), {
      ultimaAnaliseTecnicaId: docRef.id,
      ultimaAnaliseTecnicaEm: serverTimestamp(),
      ultimoStatusTecnico:    payload.status,
      ultimoRiscoAmbiental:   riscoAmbiental,
    });
  }

  return docRef.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API PÚBLICA — LEITURA (painel técnico)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Aba PENDENTES — todas as coleções, status pendente, sem filtro de criticidade.
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
 * Aba CRÍTICAS — filtra por campos de criticidade, independente de status.
 */
export async function getCriticalPendingAnalyses(
  maxPerCollection = 50,
): Promise<TechnicalAnalysisItem[]> {
  const results: TechnicalAnalysisItem[] = [];

  const criticalFilters: Array<{ field: string; value: string }> = [
    { field: 'classificacao',    value: 'critica'  },
    { field: 'nivelRisco',       value: 'critico'  },
    { field: 'riscoAmbiental',   value: 'critico'  },  // campo de analisesTecnicas
    { field: 'statusQualidade',  value: 'critica'  },
    { field: 'status',           value: 'critico'  },
  ];

  await Promise.allSettled(
    COLLECTIONS.map(async col => {
      const colRef = collection(db, col.name);
      const subResults = await Promise.allSettled(
        criticalFilters.map(({ field, value }) => {
          const q = query(colRef, where(field, '==', value), limit(maxPerCollection));
          return safeFetch(col, q);
        }),
      );
      for (const r of subResults) {
        if (r.status === 'fulfilled') results.push(...r.value);
      }
    }),
  );

  const unique = Array.from(new Map(results.map(i => [i.id, i])).values());
  return sortByDateDesc(unique);
}

/**
 * Busca todas as análises técnicas de um corpo hídrico (coleção analisesTecnicas).
 */
export async function getTechnicalAnalysesByWaterBody(
  corpoHidricoId: string,
): Promise<TechnicalAnalysis[]> {
  const snap = await getDocs(
    query(
      collection(db, 'analisesTecnicas'),
      where('corpoHidricoId', '==', corpoHidricoId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalAnalysis));
}

/**
 * Busca a análise técnica mais recente de um corpo hídrico.
 */
export async function getLatestTechnicalAnalysisByWaterBody(
  corpoHidricoId: string,
): Promise<TechnicalAnalysis | null> {
  const snap = await getDocs(
    query(
      collection(db, 'analisesTecnicas'),
      where('corpoHidricoId', '==', corpoHidricoId),
      orderBy('createdAt', 'desc'),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as TechnicalAnalysis;
}

/**
 * Busca todas as análises registradas por um técnico (coleção analisesTecnicas).
 */
export async function getTechnicalAnalysesByTechnician(
  tecnicoId: string,
): Promise<TechnicalAnalysis[]> {
  const snap = await getDocs(
    query(
      collection(db, 'analisesTecnicas'),
      where('tecnicoId', '==', tecnicoId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalAnalysis));
}

/**
 * Home Técnico — última contribuição/análise de um técnico em qualquer coleção.
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