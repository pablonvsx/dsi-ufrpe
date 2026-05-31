/**
 * Serviço de Contribuições Ambientais (CRUD)
 * Gerencia dados armazenados na coleção 'coletaSimples'
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  DocumentReference,
  Query,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  ContribuicaoAmbiental,
  CreateContribuicaoDTO,
  UpdateContribuicaoDTO,
  FiltroContribuicoes,
  InfoAmbientalGeo,
} from "@/types/contribution";

const COLECAO = "coletaSimples";

/**
 * CREATE: Registra uma nova contribuição
 * @param dados DTO com informações da contribuição
 * @param infoAmbiental Informações geográficas/ambientais
 * @returns ID da contribuição criada
 */
export async function criarContribuicao(
  dados: CreateContribuicaoDTO,
  infoAmbiental: InfoAmbientalGeo
): Promise<string> {
  try {
    const agora = new Date();

    const novaContribuicao: any = {
      // Localização
      latitude: dados.latitude,
      longitude: dados.longitude,

      // Usuário
      usuarioId: dados.usuarioId,
      usuarioNome: dados.usuarioNome,

      // Tipo e descrição
      tipo: dados.tipo,
      descricao: dados.descricao,

      // Medições (apenas se definidas)
      ...(dados.pH !== undefined && { pH: dados.pH }),
      ...(dados.cor && { cor: dados.cor }),
      ...(dados.odor && { odor: dados.odor }),
      ...(dados.temperatura !== undefined && { temperatura: dados.temperatura }),

      // Observação visual (apenas se definida)
      ...(dados.observacaoVisual && { observacaoVisual: dados.observacaoVisual }),

      // Fotos
      fotos: dados.fotos || [],

      // Info ambiental
      ambientalInfo: infoAmbiental,

      // Validação (inicia como falso)
      validacaoTecnica: {
        validada: false,
      },

      // Status e auditoria
      status: "pendente",
      ativa: true,
      dataCriacao: agora,
      dataAtualizacao: agora,
      versao: 1,
    };

    const docRef = await addDoc(collection(db, COLECAO), novaContribuicao);
    console.log("✅ Contribuição criada:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Erro ao criar contribuição:", error);
    throw error;
  }
}

/**
 * READ: Busca uma contribuição por ID
 */
export async function obterContribuicao(id: string): Promise<ContribuicaoAmbiental | null> {
  try {
    const docRef = doc(db, COLECAO, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as ContribuicaoAmbiental;
    }
    return null;
  } catch (error) {
    console.error("❌ Erro ao obter contribuição:", error);
    throw error;
  }
}

/**
 * READ: Lista contribuições com filtros
 */
export async function listarContribuicoes(
  filtros?: FiltroContribuicoes
): Promise<ContribuicaoAmbiental[]> {
  try {
    let q: Query = collection(db, COLECAO);
    const conditions: any[] = [];

    // Aplicar filtros
    if (filtros?.usuarioId) {
      conditions.push(where("usuarioId", "==", filtros.usuarioId));
    }
    if (filtros?.status) {
      conditions.push(where("status", "==", filtros.status));
    }
    if (filtros?.tipo) {
      conditions.push(where("tipo", "==", filtros.tipo));
    }
    if (filtros?.municipio) {
      conditions.push(where("ambientalInfo.municipio", "==", filtros.municipio));
    }
    if (filtros?.regiaoHidrica) {
      conditions.push(where("ambientalInfo.regiaoHidrica", "==", filtros.regiaoHidrica));
    }
    if (filtros?.ativa !== undefined) {
      conditions.push(where("ativa", "==", filtros.ativa));
    }
    if (filtros?.validada !== undefined) {
      conditions.push(where("validacaoTecnica.validada", "==", filtros.validada));
    }

    // Filtro de datas
    if (filtros?.dataDe) {
      conditions.push(where("dataCriacao", ">=", Timestamp.fromDate(filtros.dataDe)));
    }
    if (filtros?.dataAte) {
      conditions.push(where("dataCriacao", "<=", Timestamp.fromDate(filtros.dataAte)));
    }

    if (conditions.length > 0) {
      q = query(collection(db, COLECAO), ...conditions, orderBy("dataCriacao", "desc"));
    } else {
      q = query(collection(db, COLECAO), orderBy("dataCriacao", "desc"));
    }

    const querySnapshot = await getDocs(q);
    const contribuicoes: ContribuicaoAmbiental[] = [];

    querySnapshot.forEach((doc) => {
      contribuicoes.push({
        id: doc.id,
        ...doc.data(),
      } as ContribuicaoAmbiental);
    });

    return contribuicoes;
  } catch (error) {
    console.error("❌ Erro ao listar contribuições:", error);
    throw error;
  }
}

/**
 * READ: Lista apenas contribuições do usuário logado
 */
export async function obterMinhasContribuicoes(usuarioId: string): Promise<ContribuicaoAmbiental[]> {
  return listarContribuicoes({ usuarioId, ativa: true });
}

/**
 * UPDATE: Complementa uma contribuição existente
 * Adiciona fotos, descrição melhorada, observações, etc.
 */
export async function complementarContribuicao(
  id: string,
  atualizacoes: UpdateContribuicaoDTO,
  usuarioId: string
): Promise<void> {
  try {
    const docRef = doc(db, COLECAO, id);
    const agora = new Date();

    // Preparar dados de atualização
    const updateData: any = {
      dataAtualizacao: agora,
    };

    // Atualizar campos diretos
    if (atualizacoes.descricao) updateData.descricao = atualizacoes.descricao;
    if (atualizacoes.pH !== undefined) updateData.pH = atualizacoes.pH;
    if (atualizacoes.cor) updateData.cor = atualizacoes.cor;
    if (atualizacoes.odor) updateData.odor = atualizacoes.odor;
    if (atualizacoes.temperatura !== undefined)
      updateData.temperatura = atualizacoes.temperatura;
    if (atualizacoes.observacaoVisual)
      updateData.observacaoVisual = atualizacoes.observacaoVisual;

    // Adicionar novas fotos
    if (atualizacoes.novasFotos && atualizacoes.novasFotos.length > 0) {
      const docSnap = await getDoc(docRef);
      const contribuicao = docSnap.data() as ContribuicaoAmbiental;
      updateData.fotos = [...(contribuicao.fotos || []), ...atualizacoes.novasFotos];
    }

    // Registrar complementação
    if (atualizacoes.complementacao) {
      const complementacoes = [
        ...(await getDoc(docRef)).data()?.complementacoes || [],
        {
          ...atualizacoes.complementacao,
          dataAdicao: agora,
          usuarioId,
        },
      ];
      updateData.complementacoes = complementacoes;
    }

    updateData.versao = (await getDoc(docRef)).data()?.versao + 1 || 1;

    await updateDoc(docRef, updateData);
    console.log("✅ Contribuição complementada:", id);
  } catch (error) {
    console.error("❌ Erro ao complementar contribuição:", error);
    throw error;
  }
}

/**
 * DELETE (SOFT): Cancelar/desativar contribuição
 * Não deleta definitivamente, apenas marca como inativa
 */
export async function cancelarContribuicao(
  id: string,
  motivo?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLECAO, id);
    const agora = new Date();

    await updateDoc(docRef, {
      ativa: false,
      status: "arquivada",
      motivo_invalidade: motivo || "Cancelada pelo usuário",
      dataAtualizacao: agora,
    });

    console.log("✅ Contribuição cancelada:", id);
  } catch (error) {
    console.error("❌ Erro ao cancelar contribuição:", error);
    throw error;
  }
}

/**
 * VALIDAÇÃO: Técnico valida uma contribuição
 */
export async function validarContribuicao(
  id: string,
  tecnicoId: string,
  tecnicoNome: string
): Promise<void> {
  try {
    const docRef = doc(db, COLECAO, id);
    const agora = new Date();

    await updateDoc(docRef, {
      validacaoTecnica: {
        validada: true,
        validadoPorId: tecnicoId,
        validadoPorNome: tecnicoNome,
        dataValidacao: agora,
      },
      status: "validada",
      dataAtualizacao: agora,
    });

    console.log("✅ Contribuição validada:", id);
  } catch (error) {
    console.error("❌ Erro ao validar contribuição:", error);
    throw error;
  }
}

/**
 * INVALIDAÇÃO: Gestor/Técnico invalida uma contribuição
 */
export async function invalidarContribuicao(
  id: string,
  motivo: string,
  usuarioId: string,
  usuarioNome: string
): Promise<void> {
  try {
    const docRef = doc(db, COLECAO, id);
    const agora = new Date();

    await updateDoc(docRef, {
      status: "invalida",
      motivo_invalidade: motivo,
      validacaoTecnica: {
        validada: false,
        validadoPorId: usuarioId,
        validadoPorNome: usuarioNome,
        dataValidacao: agora,
        motivo: motivo,
      },
      dataAtualizacao: agora,
    });

    console.log("✅ Contribuição invalidada:", id);
  } catch (error) {
    console.error("❌ Erro ao invalidar contribuição:", error);
    throw error;
  }
}

/**
 * ARQUIVAMENTO: Gestor arquiva uma contribuição
 */
export async function arquivarContribuicao(
  id: string,
  motivo: "duplicada" | "inconsistente" | "resolvida" | "outro",
  notaInterna?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLECAO, id);
    const agora = new Date();

    await updateDoc(docRef, {
      status: "arquivada",
      motivo_invalidade: motivo,
      notasInternas: notaInterna,
      dataAtualizacao: agora,
    });

    console.log("✅ Contribuição arquivada:", id);
  } catch (error) {
    console.error("❌ Erro ao arquivar contribuição:", error);
    throw error;
  }
}

/**
 * Estatísticas das contribuições
 */
export async function obterEstatisticas(usuarioId?: string): Promise<{
  total: number;
  pendentes: number;
  validadas: number;
  invalidas: number;
  arquivadas: number;
  medicoes: number;
  observacoes: number;
}> {
  try {
    let conditions: any[] = [where("ativa", "==", true)];

    if (usuarioId) {
      conditions.push(where("usuarioId", "==", usuarioId));
    }

    const q = query(collection(db, COLECAO), ...conditions);
    const querySnapshot = await getDocs(q);

    const stats = {
      total: querySnapshot.size,
      pendentes: 0,
      validadas: 0,
      invalidas: 0,
      arquivadas: 0,
      medicoes: 0,
      observacoes: 0,
    };

    querySnapshot.forEach((doc) => {
      const data = doc.data() as ContribuicaoAmbiental;
      stats[data.status as keyof typeof stats]++;
      stats[data.tipo === "medicao" ? "medicoes" : "observacoes"]++;
    });

    return stats;
  } catch (error) {
    console.error("❌ Erro ao obter estatísticas:", error);
    throw error;
  }
}

/**
 * Busca contribuições próximas (por coordenadas)
 */
export async function buscarProximas(
  latitude: number,
  longitude: number,
  raioKm: number = 5
): Promise<ContribuicaoAmbiental[]> {
  try {
    // Nota: Firestore não tem busca geoespacial nativa
    // Alternativa: usar GeoHash ou calcular distância no client
    // Por enquanto, retornamos todas e filtramos no app

    const contribuicoes = await listarContribuicoes({ ativa: true, validada: true });

    // Filtro simples por proximidade (aproximadamente)
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const proximas = contribuicoes.filter((c) => {
      const dLat = toRad(c.latitude - latitude);
      const dLon = toRad(c.longitude - longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(latitude)) *
          Math.cos(toRad(c.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c_val = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distancia = earthRadiusKm * c_val;

      return distancia <= raioKm;
    });

    return proximas;
  } catch (error) {
    console.error("❌ Erro ao buscar contribuições próximas:", error);
    throw error;
  }
}
