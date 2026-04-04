const admin = require("firebase-admin");

// Suporte a duas formas de autenticação:
// 1. Em desenvolvimento: arquivo serviceAccountKey.json
// 2. Em produção (Railway, Render etc): variável de ambiente com JSON como string

let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // Produção: variável de ambiente
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  credential = admin.credential.cert(serviceAccount);
} else {
  // Desenvolvimento: arquivo local
  const serviceAccount = require("../serviceAccountKey.json");
  credential = admin.credential.cert(serviceAccount);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

module.exports = admin;

