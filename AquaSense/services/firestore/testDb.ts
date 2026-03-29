// import {doc, setDoc, serverTimestamp} from "firebase/firestore";
// import {db} from "@/config/firebase";
// import { dismissBrowser } from "expo-web-browser";

// export async function testFirestoreConnection() {
//    await setDoc(doc(db, "teste_conexao", "teste_01"), {
//        mensagem: "Conexão com Firestore funcionando", 
//        createAt: serverTimestamp(),
//    });
//}

import { salvarUsuario} from "@/services/firestore/users";

export async function testSalvarUsuario() {
    await salvarUsuario("uid_teste_001", {
        uid: "uid_teste_001",
        nome: "Ana Clara",
        email: "ana@gmail.com",
        tipoUsuario: "comum",
        cidade: "Olinda",
        statusConta: "ativa",


    });
}
