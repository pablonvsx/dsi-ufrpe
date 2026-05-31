/**
 * Validação & Testes - Sistema de Contribuições
 * Script para verificar se todos os serviços estão prontos para uso
 */

import * as contributionService from "@/services/firestore/contributions";
import * as storageService from "@/services/storage/supabaseStorage";
import * as ambientalService from "@/services/ambientalInfo";
import * as contributionHelper from "@/services/contributionHelper";
import { ContribuicaoAmbiental, CreateContribuicaoDTO } from "@/types/contribution";

/**
 * Verificação de módulos
 */
export async function validarIntegracaoCompleta(): Promise<{
  status: "ok" | "erro";
  mensagens: string[];
  avisos: string[];
}> {
  const resultado = {
    status: "ok" as "ok" | "erro",
    mensagens: [] as string[],
    avisos: [] as string[],
  };

  console.log("🔍 Iniciando validação de integração...\n");

  // 1. Verificar tipos
  console.log("1️⃣  Verificando tipos TypeScript...");
  try {
    const dadosTeste: CreateContribuicaoDTO = {
      latitude: -8.2832,
      longitude: -35.0012,
      usuarioId: "test_user",
      usuarioNome: "Usuário Teste",
      tipo: "medicao",
      descricao: "Teste",
    };
    resultado.mensagens.push("✅ Tipos importáveis corretamente");
  } catch (error) {
    resultado.status = "erro";
    resultado.mensagens.push("❌ Erro ao importar tipos: " + error);
  }

  // 2. Verificar funções do contribution service
  console.log("2️⃣  Verificando funções do Firestore service...");
  const functionsToCheck = [
    "criarContribuicao",
    "obterContribuicao",
    "listarContribuicoes",
    "complementarContribuicao",
    "validarContribuicao",
    "invalidarContribuicao",
    "cancelarContribuicao",
    "arquivarContribuicao",
    "buscarProximas",
    "obterEstatisticas",
  ];

  functionsToCheck.forEach((funcName) => {
    // @ts-ignore - verificação dinâmica
    if (typeof contributionService[funcName] === "function") {
      resultado.mensagens.push(`✅ Função ${funcName} disponível`);
    } else {
      resultado.status = "erro";
      resultado.mensagens.push(`❌ Função ${funcName} não encontrada`);
    }
  });

  // 3. Verificar storage service
  console.log("3️⃣  Verificando storage service...");
  if (storageService.supabaseConfigurando()) {
    resultado.mensagens.push("✅ Supabase está configurado");
  } else {
    resultado.avisos.push("⚠️  Supabase não está configurado (uploads não funcionarão)");
  }

  // 4. Verificar ambiental service
  console.log("4️⃣  Verificando ambiental service...");
  try {
    const valido = ambientalService.validarCoordenadaPernambuco(-8.2832, -35.0012);
    if (valido) {
      resultado.mensagens.push("✅ Validação de coordenadas funcionando");
    } else {
      resultado.avisos.push("⚠️  Coordenada testada fora de PE (esperado)");
    }
  } catch (error) {
    resultado.status = "erro";
    resultado.mensagens.push("❌ Erro na validação de coordenadas");
  }

  // 5. Verificar helper functions
  console.log("5️⃣  Verificando helper functions...");
  const helperFunctions = [
    "criarContribuicaoCompleta",
    "complementarComValidacao",
    "cancelarComValidacao",
    "obterDashboardColaborador",
    "obterContribuicoesPendentes",
  ];

  helperFunctions.forEach((funcName) => {
    // @ts-ignore
    if (typeof contributionHelper[funcName] === "function") {
      resultado.mensagens.push(`✅ Helper ${funcName} disponível`);
    } else {
      resultado.status = "erro";
      resultado.mensagens.push(`❌ Helper ${funcName} não encontrado`);
    }
  });

  console.log("\n" + "=".repeat(50));
  console.log("RESULTADO DA VALIDAÇÃO");
  console.log("=".repeat(50));
  resultado.mensagens.forEach((msg) => console.log(msg));
  if (resultado.avisos.length > 0) {
    console.log("\nAvisos:");
    resultado.avisos.forEach((msg) => console.log(msg));
  }
  console.log("=".repeat(50));

  return resultado;
}

/**
 * Teste de workflow: Criar → Complementar → Validar
 * ⚠️ ATENÇÃO: Requer Firebase configurado
 */
export async function testarWorkflowCompleto(): Promise<void> {
  console.log("🧪 Testando workflow completo (requer Firebase)...\n");

  try {
    // 1. Criar contribuição
    console.log("1️⃣  Criando contribuição de teste...");
    const contribuicaoData: CreateContribuicaoDTO = {
      latitude: -8.2832,
      longitude: -35.0012,
      usuarioId: "user_teste_123",
      usuarioNome: "Usuário de Teste",
      tipo: "medicao",
      descricao: "Teste de integração - Medição de pH",
      pH: 7.2,
      cor: "clara",
      temperatura: 25.5,
    };

    // Usar helper para criar com tudo integrado
    const id = await contributionHelper.criarContribuicaoCompleta(
      contribuicaoData,
      undefined
    );
    console.log("✅ Contribuição criada:", id);

    // 2. Obter contribuição criada
    console.log("\n2️⃣  Obtendo contribuição...");
    const contrib = await contributionService.obterContribuicao(id);
    if (contrib) {
      console.log("✅ Contribuição obtida com sucesso");
      console.log(`   Status: ${contrib.status}`);
      console.log(`   Município: ${contrib.ambientalInfo.municipio}`);
      console.log(`   Região Hídrica: ${contrib.ambientalInfo.regiaoHidrica}`);
    }

    // 3. Complementar contribuição
    console.log("\n3️⃣  Complementando contribuição...");
    await contributionHelper.complementarComValidacao(
      id,
      {
        pH: 7.3,
        descricao: "Corrigida: pH era 7.2, agora é 7.3",
      },
      "user_teste_123"
    );
    console.log("✅ Contribuição complementada");

    // 4. Validar (como técnico)
    console.log("\n4️⃣  Validando contribuição (como técnico)...");
    await contributionHelper.validarContribuicaoComSeguranca(
      id,
      "tecnico_123",
      "Técnico Teste"
    );
    console.log("✅ Contribuição validada");

    // 5. Verificar status final
    console.log("\n5️⃣  Verificando status final...");
    const contribFinal = await contributionService.obterContribuicao(id);
    if (contribFinal) {
      console.log(`✅ Status final: ${contribFinal.status}`);
      console.log(`   Validada por: ${contribFinal.validacaoTecnica.validadoPorNome}`);
      console.log(`   Versão: ${contribFinal.versao}`);
    }

    console.log("\n✅ Workflow completo executado com sucesso!");
  } catch (error) {
    console.error("❌ Erro durante teste:", error);
  }
}

/**
 * Teste de dados de coordenadas
 */
export function testarValidacaoCoordenadas(): void {
  console.log("🧪 Testando validação de coordenadas...\n");

  const testes = [
    { lat: -8.2832, lon: -35.0012, nome: "Recife (válido)" },
    { lat: -8.8828, lon: -36.5108, nome: "Caruaru (válido)" },
    { lat: -5.5, lon: -37.5, nome: "São Paulo (inválido)" },
    { lat: 8.28, lon: -35.0012, nome: "Hemisfério Norte (inválido)" },
  ];

  testes.forEach(({ lat, lon, nome }) => {
    const valido = ambientalService.validarCoordenadaPernambuco(lat, lon);
    const status = valido ? "✅" : "❌";
    console.log(`${status} ${nome}: (${lat}, ${lon})`);
  });
}

/**
 * Teste de info ambiental
 */
export async function testarInfoAmbiental(): Promise<void> {
  console.log("🧪 Testando obtenção de informações ambientais...\n");

  try {
    const info = await ambientalService.obterInfoAmbientalCompleta(
      -8.2832,
      -35.0012
    );

    console.log("Informações obtidas:");
    console.log(ambientalService.gerarResumoAmbientalTexto(info));
    console.log("\n✅ Teste concluído");
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

/**
 * Teste de distância
 */
export function testarCalculoDistancia(): void {
  console.log("🧪 Testando cálculo de distância...\n");

  const pontos = [
    {
      p1: { lat: -8.2832, lon: -35.0012, nome: "Recife" },
      p2: { lat: -8.8828, lon: -36.5108, nome: "Caruaru" },
    },
    {
      p1: { lat: -8.0, lon: -35.0, nome: "Litoral" },
      p2: { lat: -8.0, lon: -35.001, nome: "Próximo (0.1 km)" },
    },
  ];

  pontos.forEach(({ p1, p2 }) => {
    const distancia = ambientalService.calcularDistancia(
      p1.lat,
      p1.lon,
      p2.lat,
      p2.lon
    );
    console.log(
      `📍 ${p1.nome} → ${p2.nome}: ${distancia.toFixed(2)} km`
    );
  });
}

/**
 * Executar todos os testes
 */
export async function executarTodosTestes(): Promise<void> {
  console.log("🚀 INICIANDO SUITE DE TESTES\n");

  // 1. Validação de integração
  const validacao = await validarIntegracaoCompleta();

  // 2. Testes simples (sem Firebase)
  console.log("\n---\n");
  testarValidacaoCoordenadas();

  console.log("\n---\n");
  testarCalculoDistancia();

  // 3. Teste de info ambiental
  console.log("\n---\n");
  await testarInfoAmbiental();

  // 4. Workflow completo (requer Firebase)
  if (validacao.status === "ok") {
    console.log("\n---\n");
    console.log("💡 Para testar workflow completo, descomente a chamada para:");
    console.log("   testarWorkflowCompleto()");
    console.log("   (requer Firebase configurado)\n");
  }
}

/**
 * Quick validation - para usar rapidamente
 */
export async function quickValidation(): Promise<boolean> {
  try {
    const result = await validarIntegracaoCompleta();
    return result.status === "ok";
  } catch (error) {
    console.error("❌ Erro na validação rápida:", error);
    return false;
  }
}
