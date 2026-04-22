import { createUserWithEmailAndPassword, reload } from "firebase/auth";
// ↑ removido: sendEmailVerification
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/config/firebase";

// ==========================================
// USUÁRIO COMUM
// ==========================================
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


  const credential = await createUserWithEmailAndPassword(auth, email, senha);
  const { uid } = credential.user;

  // Não chama sendEmailVerification aqui — o backend cuida do e-mail customizado

  await setDoc(doc(db, "usuarios", uid), {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    cidade,
    tipoUsuario: "comum",
    statusConta: "pendente_verificacao",
    hasSeenTutorial: false,
    dataCriacao: serverTimestamp(),
  });
}

export async function syncUserVerificationStatus(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error("Nenhum usuário autenticado.");

  await reload(user);
  const updatedUser = auth.currentUser;
  if (!updatedUser) throw new Error("Usuário não encontrado após recarregar.");

  const isVerified = updatedUser.emailVerified;

  await updateDoc(doc(db, "usuarios", updatedUser.uid), {
    statusConta: isVerified ? "ativo" : "pendente_verificacao",
  });

  return isVerified;
}

export function parseFirebaseAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado.";
    case "auth/invalid-email":
      return "O endereço de e-mail é inválido.";
    case "auth/weak-password":
      return "A senha é muito fraca. Use pelo menos 8 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um momento e tente novamente.";
    default:
      return "Ocorreu um erro inesperado. Tente novamente.";
  }

}