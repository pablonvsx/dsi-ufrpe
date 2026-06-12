/**
 * Servico de Storage (Supabase)
 * Gerencia upload de imagens das contribuicoes e denuncias.
 *
 * IMPORTANTE — por que nao usamos fetch(uri).blob():
 *   O React Native / Expo nao suporta o metodo .blob() sobre um fetch de
 *   file:// ou content:// URIs. A chamada silencia o erro ou retorna um Blob
 *   vazio, resultando em 0 bytes enviados ao Supabase (e "Storage requests: 0"
 *   no dashboard). A abordagem correta no Expo e ler o arquivo como base64 via
 *   expo-file-system e repassar o ArrayBuffer para o SDK do Supabase.
 */

import * as FileSystem from "expo-file-system/legacy";
import { supabase, supabaseEstaConfigurado, BUCKETS } from "@/config/supabase";

// --------------------------------------------------------------------------
// Tipos
// --------------------------------------------------------------------------

export interface ResultadoUpload {
  /** URL publica permanente da imagem no Supabase Storage. */
  url: string;
  /** Caminho relativo dentro do bucket, ex: contribuicoes/abc123/1700000000_foto.jpg */
  path: string;
  /** Tamanho em bytes do arquivo enviado. */
  size: number;
  /** MIME type detectado ou informado. */
  mimeType: string;
}

// --------------------------------------------------------------------------
// Funcao principal
// --------------------------------------------------------------------------

/**
 * Faz upload de uma imagem local (URI do Expo) para o Supabase Storage.
 *
 * @param uri         URI local retornada pelo ImagePicker ou Camera do Expo
 *                    (ex: "file:///data/user/0/...")
 * @param nomeArquivo Nome sugerido para o arquivo (sera sanitizado)
 * @param entityId    ID da contribuicao ou denuncia — usado como pasta no bucket
 * @returns           Dados do arquivo apos upload bem-sucedido
 */
export async function uploadImagem(
  uri: string,
  nomeArquivo: string,
  entityId: string
): Promise<ResultadoUpload> {
  console.log("[Storage] uploadImagem chamado");
  console.log("[Storage] Supabase configurado?", supabaseEstaConfigurado());
  console.log("[Storage] Bucket:", BUCKETS.CONTRIBUICOES);
  console.log("[Storage] URI recebida:", uri);
  console.log("[Storage] Entity ID:", entityId);

  if (!supabaseEstaConfigurado()) {
    throw new Error(
      "[Storage] Supabase nao esta configurado. " +
        "Verifique EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env."
    );
  }

  // 1. Sanitizar nome do arquivo
  const nomeSanitizado = nomeArquivo
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
  const timestamp = Date.now();
  const caminhoNoStorage = `contribuicoes/${entityId}/${timestamp}_${nomeSanitizado}`;

  // 2. Detectar MIME type a partir da extensao
  const mimeType = detectarMimeType(nomeSanitizado);
  console.log("[Storage] MIME type detectado:", mimeType);
  console.log("[Storage] Caminho no storage:", caminhoNoStorage);

  // 3. Ler o arquivo como base64 via expo-file-system
  //    Usamos a string 'base64' diretamente em vez de FileSystem.EncodingType.Base64
  //    porque o enum pode nao estar disponivel em todos os ambientes Expo/iOS.
  console.log("[Storage] Lendo arquivo como base64...");
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as any,
    });
  } catch (erroLeitura) {
    console.error("[Storage] Erro ao ler arquivo local:", erroLeitura);
    throw new Error(
      `[Storage] Nao foi possivel ler o arquivo: ${uri}. Detalhes: ${erroLeitura}`
    );
  }

  // 4. Converter base64 para ArrayBuffer
  //    O SDK do Supabase para React Native aceita ArrayBuffer diretamente.
  const arrayBuffer = base64ParaArrayBuffer(base64);
  console.log("[Storage] ArrayBuffer gerado, tamanho (bytes):", arrayBuffer.byteLength);

  if (arrayBuffer.byteLength === 0) {
    throw new Error("[Storage] Arquivo vazio — ArrayBuffer com 0 bytes. Verifique a URI.");
  }

  // 5. Enviar para o Supabase Storage
  console.log("[Storage] Iniciando upload para o Supabase...");
  const { data, error } = await supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .upload(caminhoNoStorage, arrayBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[Storage] Erro no upload:", error.message);
    throw new Error(`[Storage] Erro no upload: ${error.message}`);
  }

  // 6. Obter URL publica
  const { data: urlData } = supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .getPublicUrl(data.path);

  const resultado: ResultadoUpload = {
    url: urlData.publicUrl,
    path: data.path,
    size: arrayBuffer.byteLength,
    mimeType,
  };

  console.log("[Storage] Upload concluido com sucesso");
  console.log("[Storage] URL publica:", resultado.url);

  return resultado;
}

// --------------------------------------------------------------------------
// Upload multiplo
// --------------------------------------------------------------------------

/**
 * Faz upload de varios arquivos para a mesma pasta de entity.
 * Processa em paralelo. Se um falhar, o erro e propagado.
 */
export async function uploadMultiplasImagens(
  uris: string[],
  entityId: string
): Promise<ResultadoUpload[]> {
  console.log("[Storage] uploadMultiplasImagens — total:", uris.length);

  const promessas = uris.map((uri, index) => {
    const extensao = uri.split(".").pop() ?? "jpg";
    const nomeArquivo = `imagem_${index + 1}.${extensao}`;
    return uploadImagem(uri, nomeArquivo, entityId);
  });

  return Promise.all(promessas);
}

// --------------------------------------------------------------------------
// Deletar
// --------------------------------------------------------------------------

/** Remove um arquivo do Supabase Storage pelo caminho relativo no bucket. */
export async function deletarImagem(caminhoArquivo: string): Promise<void> {
  console.log("[Storage] Deletando arquivo:", caminhoArquivo);

  const { error } = await supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .remove([caminhoArquivo]);

  if (error) {
    console.error("[Storage] Erro ao deletar:", error.message);
    throw new Error(`[Storage] Erro ao deletar ${caminhoArquivo}: ${error.message}`);
  }

  console.log("[Storage] Arquivo deletado com sucesso:", caminhoArquivo);
}

/** Remove varios arquivos de uma vez. */
export async function deletarMultiplasImagens(caminhos: string[]): Promise<void> {
  console.log("[Storage] Deletando", caminhos.length, "arquivos...");

  const { error } = await supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .remove(caminhos);

  if (error) {
    console.error("[Storage] Erro ao deletar multiplos:", error.message);
    throw new Error(`[Storage] Erro ao deletar multiplos arquivos: ${error.message}`);
  }

  console.log("[Storage] Arquivos deletados com sucesso");
}

// --------------------------------------------------------------------------
// Utilitarios
// --------------------------------------------------------------------------

/**
 * Lista os arquivos de uma contribuicao/denuncia no bucket.
 * Util para verificar o que foi salvo.
 */
export async function listarArquivosEntidade(entityId: string): Promise<string[]> {
  const pasta = `contribuicoes/${entityId}`;
  console.log("[Storage] Listando arquivos em:", pasta);

  const { data, error } = await supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .list(pasta);

  if (error) {
    console.error("[Storage] Erro ao listar:", error.message);
    throw new Error(`[Storage] Erro ao listar arquivos: ${error.message}`);
  }

  return (data ?? []).map((file) => `${pasta}/${file.name}`);
}

/**
 * Gera uma URL assinada (acesso temporario para buckets privados).
 * Para buckets publicos, use getPublicUrl em vez desta funcao.
 */
export async function gerarUrlAssinada(
  caminhoArquivo: string,
  expiracaoSegundos = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.CONTRIBUICOES)
    .createSignedUrl(caminhoArquivo, expiracaoSegundos);

  if (error) {
    console.error("[Storage] Erro ao gerar URL assinada:", error.message);
    throw new Error(`[Storage] Erro ao gerar URL assinada: ${error.message}`);
  }

  return data.signedUrl;
}

// --------------------------------------------------------------------------
// Helpers internos
// --------------------------------------------------------------------------

/**
 * Converte uma string base64 em ArrayBuffer.
 * Necessario porque o SDK do Supabase no React Native nao aceita Blob
 * criado via fetch() — mas aceita ArrayBuffer diretamente.
 */
function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  // Remove prefixo data URI se presente (ex: "data:image/jpeg;base64,")
  const base64Limpo = base64.includes(",") ? base64.split(",")[1] : base64;

  const binaryString = atob(base64Limpo);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Detecta o MIME type a partir da extensao do nome do arquivo. */
function detectarMimeType(nomeArquivo: string): string {
  const extensao = nomeArquivo.split(".").pop()?.toLowerCase();
  switch (extensao) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    default:
      return "image/jpeg"; // fallback seguro para fotos de camera
  }
}