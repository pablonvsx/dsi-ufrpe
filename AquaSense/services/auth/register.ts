import { createUserWithEmailAndPassword, reload } from "firebase/auth";
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

// ==========================================
// COLABORADOR
// ==========================================
export interface RegisterCollaboratorPayload {
  nome: string;
  email: string;
  organizacao: string;
  cidade: string;
  senha: string;
}

export async function registerCollaboratorUser(
  payload: RegisterCollaboratorPayload
): Promise<void> {
  const { nome, email, organizacao, cidade, senha } = payload;

  const credential = await createUserWithEmailAndPassword(auth, email, senha);
  const { uid } = credential.user;

  await setDoc(doc(db, "usuarios", uid), {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    organizacao: organizacao.trim(),
    cidade,
    tipoUsuario: "colaborador",
    statusConta: "pendente_verificacao",
    hasSeenTutorial: false,
    dataCriacao: serverTimestamp(),
  });
}

// ==========================================
// TÉCNICO
// ==========================================
export interface RegisterTechnicianPayload {
  nome: string;
  email: string;
  codigoEquipe: string;
  senha: string;
}

export async function registerTechnician(
  payload: RegisterTechnicianPayload
): Promise<void> {
  const { nome, email, codigoEquipe, senha } = payload;

  const credential = await createUserWithEmailAndPassword(auth, email, senha);
  const { uid } = credential.user;

  await setDoc(doc(db, "usuarios", uid), {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    codigoEquipe: codigoEquipe.trim().toUpperCase(),
    tipoUsuario: "tecnico",
    statusConta: "pendente_verificacao",
    hasSeenTutorial: false,
    dataCriacao: serverTimestamp(),
  });
}

// ==========================================
// GESTOR
// ==========================================
export interface RegisterGestorPayload {
  nome: string;
  email: string;
  orgao: string;
  cargo: string;
  matricula: string;
  senha: string;
}

export async function registerGestor(
  payload: RegisterGestorPayload
): Promise<void> {
  const { nome, email, orgao, cargo, matricula, senha } = payload;

  const credential = await createUserWithEmailAndPassword(auth, email, senha);
  const { uid } = credential.user;

  await setDoc(doc(db, "usuarios", uid), {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    orgao: orgao.trim(),
    cargo: cargo.trim(),
    matricula: matricula.trim(),
    tipoUsuario: "gestor",
    statusConta: "pendente_verificacao",
    hasSeenTutorial: false,
    dataCriacao: serverTimestamp(),
  });
}

// ==========================================
// UTILITÁRIOS
// ==========================================
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