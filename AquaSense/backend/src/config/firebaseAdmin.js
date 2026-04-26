const admin = require("firebase-admin");

// Suporte a duas formas de autenticação:
// 1. Produção (Render): variável de ambiente com JSON
// 2. Desenvolvimento: arquivo local serviceAccountKey.json

let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // Produção (Render)
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
    console.log("Firebase Admin inicializado via ENV (produção)");
  } catch (error) {
    console.error("Erro ao fazer parse do FIREBASE_SERVICE_ACCOUNT_JSON:", error);
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON inválido.");
  }
} else if (process.env.NODE_ENV !== "production") {
  // Desenvolvimento local
  try {
    const serviceAccount = require("../serviceAccountKey.json");
    credential = admin.credential.cert(serviceAccount);
    console.log("Firebase Admin inicializado via arquivo local");
  } catch (error) {
    console.error("Erro ao carregar serviceAccountKey.json:", error);
    throw new Error("Arquivo serviceAccountKey.json não encontrado ou inválido.");
  }
} else {
  // Produção sem variável (erro crítico)
  throw new Error(
    "Firebase Admin não configurado: FIREBASE_SERVICE_ACCOUNT_JSON não definido em produção."
  );
}

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

module.exports = admin;