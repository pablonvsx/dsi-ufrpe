import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { CorpoHidrico } from "@/types/water_bodies";

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
