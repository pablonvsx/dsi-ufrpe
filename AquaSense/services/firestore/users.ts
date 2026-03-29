import {doc, setDoc, serverTimestamp} from "firebase/firestore";
import {db} from "@/config/firebase";
import {Usuario} from "@/types";

// Salva um usuario na colecao "usuarios" usando o uid como ID do documento. 
export async function salvarUsuario(uid: string, dados: Usuario) {
    await setDoc(doc(db, "usuarios", uid), {
        ...dados, // copia todos os campos do usuario recebido
        statusConta: "ativa",
        dataCriacao: serverTimestamp(), // registra a data de criacao pelo servidor. 
    });
}

