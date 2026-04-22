import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { CorpoHidrico, PontoDeUso } from "@/types/water_bodies";

/**
 * Salva um novo corpo hídrico na coleção "corposHidricos" do Firestore.
 * @param dados - Dados do corpo hídrico
 * @returns Promise com o ID do documento criado
 */
export async function salvarCorpoHidrico(dados: Omit<CorpoHidrico, "id" | "dataCriacao">) {
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
export async function salvarPontoDeUso(dados: Omit<PontoDeUso, "id" | "dataCriacao">) {
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