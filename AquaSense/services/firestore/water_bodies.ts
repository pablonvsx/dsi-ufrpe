import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { CorpoHidrico, PontoDeUso } from "@/types/water_bodies";

/**
 * Salva um novo corpo hídrico na coleção "corposHidricos" do Firestore.
 * @param dados - Dados do corpo hídrico
 * @returns Promise com o ID do documento criado
 */
export async function salvarCorpoHidrico(
  dados: Omit<CorpoHidrico, "id" | "dataCriacao">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "corposHidricos"), {
      ...dados,
      dataCriacao: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Erro ao salvar corpo hídrico:", error);
    throw error;
  }
}

/**
 * Salva um novo ponto de uso na coleção "pontosDeUso" do Firestore.
 * @param dados - Dados do ponto de uso
 * @returns Promise com o ID do documento criado
 */
export async function salvarPontoDeUso(
  dados: Omit<PontoDeUso, "id" | "dataCriacao">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "pontosDeUso"), {
      ...dados,
      dataCriacao: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Erro ao salvar ponto de uso:", error);
    throw error;
  }
}

/**
 * Busca um corpo hídrico pelo ID.
 * @param id - ID do documento no Firestore
 * @returns CorpoHidrico ou null
 */
export async function getWaterBodyById(id: string): Promise<CorpoHidrico | null> {
  try {
    const snap = await getDoc(doc(db, "corposHidricos", id));

    if (!snap.exists()) {
      return null;
    }

    return {
      id: snap.id,
      ...snap.data(),
    } as CorpoHidrico;
  } catch (error) {
    console.error("Erro ao buscar corpo hídrico:", error);
    return null;
  }
}

/**
 * Busca todos os corpos hídricos validados (cadastroValido === true).
 * @returns Array de CorpoHidrico validados
 */
export async function getValidatedWaterBodies(): Promise<CorpoHidrico[]> {
  try {
    const q = query(
      collection(db, "corposHidricos"),
      where("cadastroValido", "==", true)
    );
    const querySnapshot = await getDocs(q);
    
    const waterBodies = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CorpoHidrico));

    return waterBodies;
  } catch (error) {
    console.error("Erro ao buscar corpos hídricos validados:", error);
    return [];
  }
}

/**
 * Busca todos os corpos hídricos não validados (cadastroValido === false).
 * @returns Array de CorpoHidrico não validados
 */
export async function getUnvalidatedWaterBodies(): Promise<CorpoHidrico[]> {
  try {
    const q = query(
      collection(db, "corposHidricos"),
      where("cadastroValido", "==", false)
    );
    const querySnapshot = await getDocs(q);
    
    const waterBodies = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CorpoHidrico));

    return waterBodies;
  } catch (error) {
    console.error("Erro ao buscar corpos hídricos não validados:", error);
    return [];
  }
}

/**
 * Valida um corpo hídrico (marca como válido e registra o validador).
 * @param id - ID do corpo hídrico
 * @param validatorId - ID do usuário gestor que está validando
 * @returns Promise<void>
 */
export async function validateWaterBody(id: string, validatorId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "corposHidricos", id), {
      cadastroValido: true,
      validadoPor: validatorId,
    });
  } catch (error) {
    console.error("Erro ao validar corpo hídrico:", error);
    throw error;
  }
}

/**
 * Descarta um corpo hídrico (marca como inválido e registra o motivo).
 * @param id - ID do corpo hídrico
 * @param rejectorId - ID do usuário gestor que está rejeitando
 * @param reason - Motivo da rejeição
 * @returns Promise<void>
 */
export async function rejectWaterBody(id: string, rejectorId: string, reason: string): Promise<void> {
  try {
    await updateDoc(doc(db, "corposHidricos", id), {
      validadoPor: rejectorId,
      comentario: reason,
    });
  } catch (error) {
    console.error("Erro ao rejeitar corpo hídrico:", error);
    throw error;
  }
}