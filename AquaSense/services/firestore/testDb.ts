import {doc, setDoc, serverTimestamp} from "firebase/firestore";
import {db} from "@/config/firebase";
import { dismissBrowser } from "expo-web-browser";

export async function testFirestoreConnection() {
    await setDoc(doc(db, "teste_conexao", "teste_01"), {
        mensagem: "Conexão com Firestore funcionando", 
        createAt: serverTimestamp(),
    });
}