// services/firestore/waterBodies.ts
//
// Serviço de leitura de corpos hídricos no Firestore.
// Separado do serviço de usuários para manter responsabilidades claras.

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { CorpoHidrico } from "@/types/water_bodies";

/**
 * Busca um corpo hídrico pelo seu ID no Firestore.
 *
 * DECISÃO: Buscamos sempre os dados frescos do Firestore em vez de usar
 * um snapshot salvo no documento do usuário. Isso garante que o card da
 * Home sempre exiba informações atualizadas do corpo hídrico, sem risco
 * de inconsistência entre o que foi salvo e o estado atual.
 */
export async function getWaterBodyById(id: string): Promise<CorpoHidrico | null> {
    try {
        const snap = await getDoc(doc(db, "corposHidricos", id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as CorpoHidrico;
    } catch (err) {
        console.warn("[AquaSense] getWaterBodyById erro:", err);
        return null;
    }
}