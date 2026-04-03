import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/config/firebase";

export interface RegisterCommonPayload {
    nome: string;
    email: string;
    cidade: string;
    senha: string;
}

export async function registerCommonUser(
    payload: RegisterCommonPayload
): Promise<void> {
    const { nome, email, cidade, senha } = payload;

// O email e senha são usados para criar a conta no Firebase Authentication
    const credential = await createUserWithEmailAndPassword(auth, email, senha);
    const { uid } = credential.user;

// Verificação de email
    await sendEmailVerification(credential.user);

// Persistir dados de perfil no Firestore usando o uid como ID do documento
    await setDoc(doc(db, "usuarios", uid), {
        uid,
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        cidade,
        tipoUsuario: "comum",
        statusConta: "pendente_verificacao",
        dataCriacao: serverTimestamp(),
    });
}

// Mapeia códigos de erro do Firebase Auth para mensagens legíveis.
export function parseFirebaseAuthError(code: string): string {
    switch (code) {
        case "auth/email-already-in-use":
            return "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.";
        case "auth/invalid-email":
            return "O endereço de e-mail é invalido. Verifique e tente novamente.";
        case "auth/weak=password":
            return "A senha escolhida é muito fraca. Use pelo menos 8 caracteres.";
        case "auth/too-many-requests":
            return "Muitas tentativas de cadastro. Aguarde um momento e tente novamente.";
        default:
            return "Ocorreu um erro inesperado. Por favor, tente novamente.";
        
    }
}
