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

/**
 * Salva no Firestore apenas o ID do último corpo hídrico acessado.
 *
 * POR QUE APENAS O ID?
 * Salvar somente a referência evita três problemas:
 *   1. Redundância: os dados já existem em /corposHidricos/{id}.
 *   2. Inconsistência: se o corpo for editado, um snapshot salvo ficaria
 *      desatualizado. Com o ID, sempre buscamos a versão mais recente.
 *   3. Acoplamento desnecessário entre o documento do usuário e os dados do corpo.
 *
 * Chamada pelo Mapa (via AuthContext.setLastWaterBody) toda vez que o usuário
 * abre o modal de detalhes de um corpo hídrico.
 */
export async function updateLastWaterBody(uid: string, corpoHidricoId: string): Promise<void> {
    try {
        await updateDoc(doc(db, "usuarios", uid), {
            ultimoCorpoHidricoAcessadoId: corpoHidricoId,
            ultimoCorpoHidricoAcessadoEm: serverTimestamp(),
        });
    } catch (err) {
        // Falha silenciosa: não bloqueia o fluxo principal do usuário.
        console.warn("[AquaSense] updateLastWaterBody erro:", err);
    }
}