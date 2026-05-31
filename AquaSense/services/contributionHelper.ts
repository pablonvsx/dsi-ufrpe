/**
 * Serviço Helper - Orquestrador de Contribuições
 * Combina todos os serviços para facilitar operações completas
 */

import * as contributionService from "@/services/firestore/contributions";
import * as storageService from "@/services/storage/supabaseStorage";
import * as ambientalService from "@/services/ambientalInfo";
import {
  ContribuicaoAmbiental,
  CreateContribuicaoDTO,
} from "@/types/contribution";

/**
 * Fluxo completo: Criar uma nova contribuição com fotos
 */
export async function criarContribuicaoCompleta(
  dados: CreateContribuicaoDTO,
  arquivos?: (Blob | File)[]
): Promise<string> {
  try {
    console.log("🔄 Iniciando criação de contribuição completa...");

    // Validar coordenadas
    if (
      !ambientalService.validarCoordenadaPernambuco(dados.latitude, dados.longitude)
    ) {
      throw new Error("Contribuição fora do estado de Pernambuco");
    }

    // 1. Obter informações ambientais
    console.log("1️⃣  Obtendo informações ambientais...");
    const infoAmbiental = await ambientalService.obterInfoAmbientalCompleta(
      dados.latitude,
      dados.longitude
    );

    // 2. Fazer upload das fotos (se houver)
    let fotosUrls: string[] = [];
    let contribuicaoId = `contrib_${Date.now()}`; // ID temporário para pasta

    if (arquivos && arquivos.length > 0 && storageService.supabaseConfigurando()) {
      console.log("2️⃣  Fazendo upload de fotos...");
      
      try {
        const uploadResults = await storageService.uploadMultiplosImagens(
          arquivos,
          contribuicaoId
        );
        fotosUrls = uploadResults.map((r) => r.url);
      } catch (error) {
        console.warn("⚠️  Erro ao fazer upload de fotos, continuando sem elas:", error);
      }
    }

    // 3. Criar contribuição no Firestore
    console.log("3️⃣  Criando contribuição no banco de dados...");
    const novaContribuicao: CreateContribuicaoDTO = {
      ...dados,
      fotos: fotosUrls,
    };

    const idCriado = await contributionService.criarContribuicao(
      novaContribuicao,
      infoAmbiental
    );

    // Se usamos ID temporário e temos fotos, podemos reorganizar os arquivos
    if (fotosUrls.length > 0) {
      console.log("4️⃣  Reorganizando arquivos com ID final...");
      // Opcionalmente, reorganizar arquivos do Supabase com o ID real
      // Por simplicidade, mantemos com ID temporário
    }

    console.log("✅ Contribuição criada com sucesso:", idCriado);
    return idCriado;
  } catch (error) {
    console.error("❌ Erro ao criar contribuição completa:", error);
    throw error;
  }
}

/**
 * Obter histórico de contribuições do usuário com detalhes completos
 */
export async function obterHistoricoUsuario(
  usuarioId: string
): Promise<ContribuicaoAmbiental[]> {
  try {
    return await contributionService.obterMinhasContribuicoes(usuarioId);
  } catch (error) {
    console.error("❌ Erro ao obter histórico:", error);
    throw error;
  }
}

/**
 * Complementar uma contribuição com validações
 */
export async function complementarComValidacao(
  id: string,
  updateData: any,
  usuarioId: string,
  novasfotos?: (Blob | File)[]
): Promise<void> {
  try {
    console.log("🔄 Iniciando complementação de contribuição...");

    // Validar que a contribuição pertence ao usuário
    const contribuicao = await contributionService.obterContribuicao(id);
    if (!contribuicao) {
      throw new Error("Contribuição não encontrada");
    }

    if (contribuicao.usuarioId !== usuarioId) {
      throw new Error("Você não tem permissão para editar esta contribuição");
    }

    // Se contribuição já foi validada, não permitir edição
    if (contribuicao.validacaoTecnica.validada) {
      throw new Error("Não é possível editar uma contribuição já validada");
    }

    // Fazer upload de novas fotos
    let novasFotosUrls: string[] = [];
    if (novasfotos && novasfotos.length > 0 && storageService.supabaseConfigurando()) {
      console.log("📤 Fazendo upload de fotos adicionais...");
      const uploadResults = await storageService.uploadMultiplosImagens(
        novasfotos,
        id
      );
      novasFotosUrls = uploadResults.map((r) => r.url);
    }

    // Complementar no banco
    console.log("💾 Salvando complementações...");
    await contributionService.complementarContribuicao(
      id,
      {
        ...updateData,
        novasFotos: novasFotosUrls,
      },
      usuarioId
    );

    console.log("✅ Complementação concluída");
  } catch (error) {
    console.error("❌ Erro ao complementar contribuição:", error);
    throw error;
  }
}

/**
 * Cancelar uma contribuição com validações
 */
export async function cancelarComValidacao(
  id: string,
  usuarioId: string,
  motivo?: string
): Promise<void> {
  try {
    // Validar que pertence ao usuário
    const contribuicao = await contributionService.obterContribuicao(id);
    if (!contribuicao) {
      throw new Error("Contribuição não encontrada");
    }

    if (contribuicao.usuarioId !== usuarioId) {
      throw new Error("Você não tem permissão para cancelar esta contribuição");
    }

    // Só pode cancelar enquanto estiver pendente
    if (contribuicao.status !== "pendente") {
      throw new Error("Só é possível cancelar contribuições pendentes");
    }

    // Deletar fotos do Supabase
    if (
      contribuicao.fotos &&
      contribuicao.fotos.length > 0 &&
      storageService.supabaseConfigurando()
    ) {
      console.log("🗑️  Deletando fotos associadas...");
      // Extrair caminhos das URLs
      const caminhos = contribuicao.fotos
        .map((url) => {
          // Extrair caminho da URL pública do Supabase
          const match = url.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      if (caminhos.length > 0) {
        await storageService.deletarMultiplosImagens(caminhos);
      }
    }

    // Cancelar no banco
    await contributionService.cancelarContribuicao(id, motivo);
    console.log("✅ Contribuição cancelada");
  } catch (error) {
    console.error("❌ Erro ao cancelar contribuição:", error);
    throw error;
  }
}

/**
 * Dashboard para colaborador - Resumo de contribuições
 */
export async function obterDashboardColaborador(usuarioId: string): Promise<{
  totalContribuicoes: number;
  contribuicoesPendentes: number;
  contribuicoesValidadas: number;
  ultimasContribuicoes: ContribuicaoAmbiental[];
}> {
  try {
    const stats = await contributionService.obterEstatisticas(usuarioId);
    const ultimas = await contributionService.obterMinhasContribuicoes(usuarioId);

    return {
      totalContribuicoes: stats.total,
      contribuicoesPendentes: stats.pendentes,
      contribuicoesValidadas: stats.validadas,
      ultimasContribuicoes: ultimas.slice(0, 5), // Últimas 5
    };
  } catch (error) {
    console.error("❌ Erro ao obter dashboard:", error);
    throw error;
  }
}

/**
 * Painel gestor - Contribuições pendentes de validação
 */
export async function obterContribuicoesPendentes(): Promise<ContribuicaoAmbiental[]> {
  try {
    return await contributionService.listarContribuicoes({
      status: "pendente",
      ativa: true,
    });
  } catch (error) {
    console.error("❌ Erro ao obter contribuições pendentes:", error);
    throw error;
  }
}

/**
 * Validar uma contribuição (ação de técnico)
 */
export async function validarContribuicaoComSeguranca(
  id: string,
  tecnicoId: string,
  tecnicoNome: string
): Promise<void> {
  try {
    // Verificar que a contribuição existe
    const contribuicao = await contributionService.obterContribuicao(id);
    if (!contribuicao) {
      throw new Error("Contribuição não encontrada");
    }

    // Verificar status
    if (contribuicao.status !== "pendente") {
      throw new Error("Apenas contribuições pendentes podem ser validadas");
    }

    // Validar
    await contributionService.validarContribuicao(id, tecnicoId, tecnicoNome);
    console.log("✅ Contribuição validada por técnico");
  } catch (error) {
    console.error("❌ Erro ao validar contribuição:", error);
    throw error;
  }
}

/**
 * Invalidar uma contribuição com motivo
 */
export async function invalidarComSeguranca(
  id: string,
  usuarioId: string,
  usuarioNome: string,
  motivo: string
): Promise<void> {
  try {
    const contribuicao = await contributionService.obterContribuicao(id);
    if (!contribuicao) {
      throw new Error("Contribuição não encontrada");
    }

    await contributionService.invalidarContribuicao(
      id,
      motivo,
      usuarioId,
      usuarioNome
    );
    console.log("✅ Contribuição invalidada");
  } catch (error) {
    console.error("❌ Erro ao invalidar contribuição:", error);
    throw error;
  }
}
