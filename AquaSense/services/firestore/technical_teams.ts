import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";

export interface EquipeTecnica {
  id: string;
  nome: string;
  status: "ativa" | "inativa";
}

export async function listarEquipesTecnicas(): Promise<EquipeTecnica[]> {
  try {
    const snap = await getDocs(collection(db, "equipesTecnicas"));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as EquipeTecnica[];
  } catch (err) {
    console.warn("[technical_teams] listarEquipesTecnicas:", err);
    return [];
  }
}

export async function listarEquipesTecnicasAtivas(): Promise<EquipeTecnica[]> {
  try {
    const q = query(
      collection(db, "equipesTecnicas"),
      where("status", "==", "ativa")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as EquipeTecnica[];
  } catch (err) {
    console.warn("[technical_teams] listarEquipesTecnicasAtivas:", err);
    return [];
  }
}