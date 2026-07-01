import { doc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Usuario, UsuarioColaborador, UsuarioTecnico } from "@/types";

export async function salvarUsuario(uid: string, dados: Usuario) {
    await setDoc(doc(db, "usuarios", uid), {
        ...dados,
        statusConta: "ativa",
        dataCriacao: serverTimestamp(),
    });
}

export async function markTutorialAsSeen(uid: string): Promise<void> {
    await updateDoc(doc(db, "usuarios", uid), {
        hasSeenTutorial: true,
    });
}

export async function updateLastWaterBody(uid: string, corpoHidricoId: string): Promise<void> {
    try {
        await updateDoc(doc(db, "usuarios", uid), {
            ultimoCorpoHidricoAcessadoId: corpoHidricoId,
            ultimoCorpoHidricoAcessadoEm: serverTimestamp(),
        });
    } catch (err) {
        console.warn("[AquaSense] updateLastWaterBody erro:", err);
    }
}

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