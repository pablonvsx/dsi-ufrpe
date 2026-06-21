import {
  doc, getDoc, getDocs, collection, query, where,
  updateDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface GestorProfileData {
  nome: string;
  email: string;
  cargo: string;
  orgao: string;
  unidade: string;
  matricula: string;
  regiaoGerenciada: string;
  uf: string;
  ultimoAcessoEm?: Timestamp;
}

export interface GestorStats {
  totalCorposHidricos: number;
  totalMunicipios: number;
  totalEquipes: number;
}

export interface GestorProfileResult {
  profile: GestorProfileData;
  stats: GestorStats;
}

export async function fetchGestorProfile(uid: string): Promise<GestorProfileResult> {
  const userSnap = await getDoc(doc(db, 'usuarios', uid));
  if (!userSnap.exists()) throw new Error('Perfil do gestor não encontrado.');

  const d = userSnap.data();

  const [corposSnap, equipesSnap] = await Promise.all([
    getDocs(query(collection(db, 'corposHidricos'), where('gestorId', '==', uid))),
    getDocs(query(collection(db, 'equipesTecnicas'), where('gestorId', '==', uid))),
  ]);

  const municipios = new Set(
    corposSnap.docs
      .map(doc => doc.data().municipio ?? doc.data().cidade)
      .filter(Boolean),
  );

  return {
    profile: {
      nome:             d.nome             ?? 'Gestor',
      email:            d.email            ?? '',
      cargo:            d.cargo            ?? 'Gestor Ambiental',
      orgao:            d.orgao            ?? d.organizacao ?? 'Não informado',
      unidade:          d.unidade          ?? d.organizacao ?? 'Não informado',
      matricula:        d.matricula        ?? '—',
      regiaoGerenciada: d.cidade           ?? 'Não informada',
      uf:               d.estado           ?? 'PE',
      ultimoAcessoEm:   d.ultimoAcessoEm,
    },
    stats: {
      totalCorposHidricos: corposSnap.size,
      totalMunicipios:     municipios.size,
      totalEquipes:        equipesSnap.size,
    },
  };
}

export async function updateGestorEmail(uid: string, newEmail: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { email: newEmail });
}

export async function deactivateGestorAccount(uid: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), {
    statusConta: 'inativa',
    desativadaEm: serverTimestamp(),
  });
}

export async function deleteGestorAccount(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'usuarios', uid));
  await batch.commit();
}

export async function recordGestorLastAccess(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'usuarios', uid), { ultimoAcessoEm: serverTimestamp() });
  } catch {
    // Falha silenciosa: não bloqueia o carregamento do perfil.
  }
}
