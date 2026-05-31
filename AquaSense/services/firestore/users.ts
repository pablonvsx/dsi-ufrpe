import { doc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Usuario, UsuarioColaborador, UsuarioTecnico } from "@/types";

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

/**
 * Busca todos os usuários colaboradores da coleção "usuarios" do Firestore.
 * @returns Promise com array de UsuarioColaborador
 */
export async function getCollaborators(): Promise<UsuarioColaborador[]> {
    try {
        const q = query(collection(db, "usuarios"), where("tipoUsuario", "==", "colaborador"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            ...doc.data(),
            uid: doc.id,
        } as UsuarioColaborador));
    } catch (error) {
        console.error("Erro ao buscar colaboradores:", error);
        throw error;
    }
}

/**
 * Busca todos os usuários técnicos da coleção "usuarios" do Firestore.
 * @returns Promise com array de UsuarioTecnico
 */
export async function getTechnicians(): Promise<UsuarioTecnico[]> {
    try {
        const q = query(collection(db, "usuarios"), where("tipoUsuario", "==", "tecnico"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            ...doc.data(),
            uid: doc.id,
        } as UsuarioTecnico));
    } catch (error) {
        console.error("Erro ao buscar técnicos:", error);
        throw error;
    }
}

/**
 * Atualiza o status de um usuário (ativa/inativa).
 * @param uid - ID do usuário
 * @param newStatus - Novo status da conta
 */
export async function updateUserStatus(uid: string, newStatus: "ativa" | "inativa"): Promise<void> {
    try {
        await updateDoc(doc(db, "usuarios", uid), {
            statusConta: newStatus,
        });
    } catch (error) {
        console.error("Erro ao atualizar status do usuário:", error);
        throw error;
    }
}

export async function markTutorialColaboradorAsSeen(uid: string) {
    const ref = doc(db, "usuarios", uid);
    await updateDoc(ref, { hasSeenTutorialColaborador: true });
}

