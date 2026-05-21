/**
 * Serviço de Storage (Supabase)
 * Gerencia upload de imagens e arquivos para contribuições ambientais
 */

import { createClient } from "@supabase/supabase-js";

// Supabase credentials (será configurado via env vars)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Variáveis de ambiente Supabase não configuradas. Upload de imagens não funcionará."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET_NAME = "aquasense-contribuicoes";

/**
 * Interface para resposta de upload
 */
export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * Upload de imagem para Supabase
 * @param file Arquivo/Blob da imagem
 * @param nomeArquivo Nome do arquivo (será sanitizado)
 * @param contribuicaoId ID da contribuição (para organizar pasta)
 * @returns URL pública da imagem
 */
export async function uploadImagem(
  file: Blob | File,
  nomeArquivo: string,
  contribuicaoId: string
): Promise<UploadResult> {
  try {
    // Sanitizar nome do arquivo
    const nomeSeguro = nomeArquivo
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

    // Criar path único com timestamp
    const timestamp = Date.now();
    const caminho = `contribuicoes/${contribuicaoId}/${timestamp}_${nomeSeguro}`;

    console.log("📤 Iniciando upload:", caminho);

    // Upload para Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(caminho, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Erro ao fazer upload: ${error.message}`);
    }

    // Gerar URL pública
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    const resultado: UploadResult = {
      url: publicData.publicUrl,
      path: data.path,
      size: file.size,
      mimeType: file.type,
    };

    console.log("✅ Upload concluído:", resultado.url);
    return resultado;
  } catch (error) {
    console.error("❌ Erro ao fazer upload de imagem:", error);
    throw error;
  }
}

/**
 * Upload múltiplo de imagens
 */
export async function uploadMultiplosImagens(
  arquivos: (Blob | File)[],
  contribuicaoId: string
): Promise<UploadResult[]> {
  try {
    const uploads = arquivos.map((arquivo, index) => {
      const nomeArquivo = 
        arquivo instanceof File 
          ? arquivo.name 
          : `imagem_${index + 1}.jpg`;
      
      return uploadImagem(arquivo, nomeArquivo, contribuicaoId);
    });

    return await Promise.all(uploads);
  } catch (error) {
    console.error("❌ Erro ao fazer upload múltiplo:", error);
    throw error;
  }
}

/**
 * Deletar imagem do Supabase
 */
export async function deletarImagem(caminhoArquivo: string): Promise<void> {
  try {
    console.log("🗑️  Deletando arquivo:", caminhoArquivo);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([caminhoArquivo]);

    if (error) {
      throw new Error(`Erro ao deletar: ${error.message}`);
    }

    console.log("✅ Arquivo deletado:", caminhoArquivo);
  } catch (error) {
    console.error("❌ Erro ao deletar imagem:", error);
    throw error;
  }
}

/**
 * Deletar múltiplas imagens
 */
export async function deletarMultiplosImagens(
  caminhos: string[]
): Promise<void> {
  try {
    console.log("🗑️  Deletando", caminhos.length, "arquivos");

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(caminhos);

    if (error) {
      throw new Error(`Erro ao deletar múltiplos: ${error.message}`);
    }

    console.log("✅ Arquivos deletados com sucesso");
  } catch (error) {
    console.error("❌ Erro ao deletar múltiplos arquivos:", error);
    throw error;
  }
}

/**
 * Gerar URL assinada (para acesso privado com expiração)
 */
export async function gerarURLAssinada(
  caminhoArquivo: string,
  expiracaoSegundos: number = 3600
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(caminhoArquivo, expiracaoSegundos);

    if (error) {
      throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error("❌ Erro ao gerar URL assinada:", error);
    throw error;
  }
}

/**
 * Listar arquivos de uma contribuição
 */
export async function listarArquivosContribuicao(
  contribuicaoId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`contribuicoes/${contribuicaoId}`);

    if (error) {
      throw new Error(`Erro ao listar arquivos: ${error.message}`);
    }

    const caminhos = (data || []).map(
      (file) => `contribuicoes/${contribuicaoId}/${file.name}`
    );

    return caminhos;
  } catch (error) {
    console.error("❌ Erro ao listar arquivos:", error);
    throw error;
  }
}

/**
 * Obter informações sobre arquivo
 */
export async function obterInfoArquivo(caminhoArquivo: string): Promise<any> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .info(caminhoArquivo);

    if (error) {
      throw new Error(`Erro ao obter info: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("❌ Erro ao obter informações do arquivo:", error);
    throw error;
  }
}

/**
 * Verificar se Supabase está configurado
 */
export function supabaseConfigurando(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Converter URL local/blob para arquivo pronto para upload
 */
export async function converterParaBlob(
  uri: string
): Promise<Blob> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("❌ Erro ao converter para Blob:", error);
    throw error;
  }
}
