import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Usuario } from "@/types";

// Salva um usuario na colecao "usuarios" usando o uid como ID do documento.
export async function salvarUsuario(uid: string, dados: Usuario) {
    await setDoc(doc(db, "usuarios", uid), {
        ...dados,
        statusConta: "ativa",
        dataCriacao: serverTimestamp(),
    });
}

// Marca que o usuário já viu o tutorial.
// Chamada na Home quando o usuário toca em "Entendi, vamos começar!".
export async function markTutorialAsSeen(uid: string): Promise<void> {
    await updateDoc(doc(db, "usuarios", uid), {
        hasSeenTutorial: true,
    });
}