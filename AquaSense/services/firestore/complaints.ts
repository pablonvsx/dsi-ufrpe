import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../../config/firebase';

export interface DenunciaInput {
  corpoHidricoId: string;
  criadoPor: string;
  titulo: string;
  grau: 'Baixa' | 'Média' | 'Alta';
  descricao: string;
}

export interface Denuncia extends DenunciaInput {
  id: string;
  status: string;
  dataCriacao: any;
}

/**
 * Salva uma denúncia vinculada a um corpo hídrico.
 * Retorna o ID do documento criado.
 */
export async function salvarDenuncia(
  input: DenunciaInput
): Promise<string> {
  const docRef = await addDoc(collection(db, 'denuncias'), {
    ...input,
    status: 'Pendente',
    dataCriacao: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Busca denúncias criadas por um usuário.
 */
export async function buscarDenunciasPorUsuario(
  uid: string
): Promise<Denuncia[]> {
  try {
    const q = query(
      collection(db, 'denuncias'),
      where('criadoPor', '==', uid),
      orderBy('dataCriacao', 'desc')
    );

    const snap = await getDocs(q);

    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Denuncia)
    );
  } catch (e) {
    console.error(
      '[buscarDenunciasPorUsuario] Erro ao buscar denúncias:',
      e
    );

    return [];
  }
}