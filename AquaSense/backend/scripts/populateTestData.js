#!/usr/bin/env node

/**
 * Script para Popular Dados de Teste nas Coleções Firestore
 * 
 * Uso:
 *   npm run populate-test-data
 * 
 * Ou direto:
 *   node scripts/populateTestData.js
 * 
 * Requer credenciais do Firebase, que podem ser fornecidas por:
 * 1. Variável de ambiente FIREBASE_SERVICE_ACCOUNT_JSON (para produção)
 * 2. Arquivo backend/src/serviceAccountKey.json (para desenvolvimento)
 */

const admin = require("firebase-admin");
const path = require("path");

// Inicializar Firebase Admin com suporte a variáveis de ambiente e arquivo
let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // Credenciais via variável de ambiente (produção)
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
    console.log("✅ Credenciais carregadas da variável de ambiente");
  } catch (error) {
    console.error("❌ Erro ao fazer parse do FIREBASE_SERVICE_ACCOUNT_JSON:", error.message);
    process.exit(1);
  }
} else {
  // Tentar carregar arquivo local
  try {
    const serviceAccount = require(path.join(__dirname, "../src/serviceAccountKey.json"));
    credential = admin.credential.cert(serviceAccount);
    console.log("✅ Credenciais carregadas do arquivo serviceAccountKey.json");
  } catch (error) {
    console.error("\n❌ Erro: Credenciais do Firebase não encontradas!");
    console.error("\n📋 Para executar este script, você precisa de uma das seguintes opções:\n");
    console.error("   Opção 1: Arquivo local");
    console.error("   ─────────────────────");
    console.error("   1. Baixe o arquivo de credenciais do Firebase Console");
    console.error("   2. Renomeie para 'serviceAccountKey.json'");
    console.error("   3. Coloque em: AquaSense/backend/src/serviceAccountKey.json\n");
    console.error("   Opção 2: Variável de ambiente");
    console.error("   ──────────────────────────────");
    console.error("   1. Copie o JSON das credenciais");
    console.error("   2. Execute: export FIREBASE_SERVICE_ACCOUNT_JSON='{json_aqui}'");
    console.error("   3. Depois execute: npm run populate-test-data\n");
    process.exit(1);
  }
}

admin.initializeApp({
  credential: credential,
});

const db = admin.firestore();

/**
 * Gera um nível de alerta aleatório com distribuição realista
 * 1: Boa (50%), 2: Normal (30%), 3: Atenção (15%), 4: Crítico (5%)
 */
function getRandomNivelAlerta() {
  const rand = Math.random();
  if (rand < 0.5) return 1; // Boa
  if (rand < 0.8) return 2; // Normal
  if (rand < 0.95) return 3; // Atenção
  return 4; // Crítico
}

/**
 * Gera quantidade aleatória de amostras por dia (1-5)
 */
function getRandomCount() {
  return Math.floor(Math.random() * 5) + 1;
}

/**
 * Retorna emoji baseado no nível de alerta
 */
function getNivelEmoji(nivel) {
  switch (nivel) {
    case 1:
      return "🟢";
    case 2:
      return "🟡";
    case 3:
      return "🟠";
    case 4:
      return "🔴";
    default:
      return "⚪";
  }
}

/**
 * Popula as coleções com dados de teste
 */
async function populateTestData() {
  try {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 Iniciando população de dados de teste...");
    console.log("=".repeat(50) + "\n");

    const today = new Date();
    const daysBack = 100;

    let simplesCount = 0;
    let completasCount = 0;
    const nivelDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 };

    console.log(`📅 Gerando dados para os últimos ${daysBack + 1} dias...\n`);

    // Iterar pelos últimos 100 dias
    for (let i = daysBack; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      // Gerar 1-5 amostras por dia
      const amostrasPerDay = getRandomCount();

      for (let j = 0; j < amostrasPerDay; j++) {
        // Adicionar minutos aleatórios
        const dateWithTime = new Date(date);
        dateWithTime.setMinutes(Math.floor(Math.random() * 1440));

        const nivel = getRandomNivelAlerta();
        nivelDistribution[nivel]++;

        const amostra = {
          data: admin.firestore.Timestamp.fromDate(dateWithTime),
          nivelAlerta: nivel,
        };

        // Salvar em coletaSimples
        await db.collection("coletaSimples").add(amostra);
        simplesCount++;

        // Salvar em coletaCompleta (com variação de níveis)
        const nivelCompleta = getRandomNivelAlerta();
        nivelDistribution[nivelCompleta]++;
        const amostraCompleta = {
          data: admin.firestore.Timestamp.fromDate(dateWithTime),
          nivelAlerta: nivelCompleta,
        };
        await db.collection("coletaCompleta").add(amostraCompleta);
        completasCount++;
      }

      // Log de progresso a cada 10 dias
      if (i % 10 === 0 || i === 0) {
        const progress = daysBack - i;
        const bar =
          "█".repeat(Math.floor(progress / 5)) +
          "░".repeat(20 - Math.floor(progress / 5));
        console.log(
          `  [${bar}] ${progress}/${daysBack + 1} dias - ${simplesCount + completasCount} amostras`
        );
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ Dados de teste criados com sucesso!");
    console.log("=".repeat(50) + "\n");

    console.log("📊 Resumo:");
    console.log(`   📈 Amostras Simples: ${simplesCount}`);
    console.log(`   📊 Amostras Completas: ${completasCount}`);
    console.log(`   📅 Período: últimos ${daysBack + 1} dias\n`);

    console.log("📋 Distribuição de Níveis de Alerta:");
    console.log(
      `   ${getNivelEmoji(1)} Boa (1):       ${nivelDistribution[1]} amostras`
    );
    console.log(
      `   ${getNivelEmoji(2)} Normal (2):    ${nivelDistribution[2]} amostras`
    );
    console.log(
      `   ${getNivelEmoji(3)} Atenção (3):   ${nivelDistribution[3]} amostras`
    );
    console.log(
      `   ${getNivelEmoji(4)} Crítico (4):   ${nivelDistribution[4]} amostras\n`
    );

    console.log("🎉 Os gráficos devem agora exibir dados de teste!");
    console.log("   Teste os filtros de 30, 60 e 90 dias no aplicativo!\n");

    process.exit(0);
  } catch (error) {
    console.error(
      "\n❌ Erro ao popular dados:",
      error.message || error
    );
    console.error("\n💡 Possíveis causas:");
    console.error("   - Verifique se está conectado à internet");
    console.error("   - Verifique se as credenciais do Firebase estão corretas");
    console.error("   - Verifique as permissões do Firestore (deve permitir escrita)\n");
    process.exit(1);
  }
}

// Executar
populateTestData();
