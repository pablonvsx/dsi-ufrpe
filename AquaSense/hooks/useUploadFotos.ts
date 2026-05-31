/**
 * Hook customizado para upload de imagens
 * Integração entre câmera/galeria e Supabase
 */

import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { uploadImagem, uploadMultiplosImagens } from "@/services/storage/supabaseStorage";
import { supabaseEstaConfigurado } from "@/config/supabase";

export interface FotoUpload {
  uri: string;
  url?: string; // URL Supabase após upload
  nome: string;
  size: number;
  type: string;
  uploading?: boolean;
  error?: string;
}

interface UseUploadFotosOptions {
  maxFotos?: number;
  maxTamanhoMB?: number;
  contribuicaoId: string;
}

/**
 * Hook para gerenciar upload de fotos
 * 
 * Exemplo:
 * ```
 * const { fotos, loading, error, capturarFoto, selecionarDaGaleria, remover, limpar } = 
 *   useUploadFotos({ contribuicaoId: "contrib_123" });
 * ```
 */
export function useUploadFotos(options: UseUploadFotosOptions) {
  const {
    maxFotos = 5,
    maxTamanhoMB = 5,
    contribuicaoId,
  } = options;

  const [fotos, setFotos] = useState<FotoUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validar se Supabase está disponível
  if (!supabaseEstaConfigurado()) {
    console.warn("⚠️  Supabase não está configurado. Uploads não funcionarão.");
  }

  /**
   * Processar imagem selecionada
   */
  const processarImagem = useCallback(
    async (imageUri: string, nome: string) => {
      try {
        setError(null);

        // 1. Validar limite de fotos
        if (fotos.length >= maxFotos) {
          setError(`Máximo de ${maxFotos} fotos atingido`);
          return false;
        }

        // 2. Obter info do arquivo
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // 3. Validar tamanho
        const tamanhoMB = blob.size / (1024 * 1024);
        if (tamanhoMB > maxTamanhoMB) {
          setError(`Imagem muito grande. Máximo: ${maxTamanhoMB}MB`);
          return false;
        }

        // 4. Validar tipo MIME
        if (!blob.type.startsWith("image/")) {
          setError("Arquivo não é uma imagem válida");
          return false;
        }

        // 5. Adicionar à lista (ainda não uploadado)
        const novaFoto: FotoUpload = {
          uri: imageUri,
          nome: nome || `foto_${Date.now()}.jpg`,
          size: blob.size,
          type: blob.type,
          uploading: true,
        };

        setFotos((prev) => [...prev, novaFoto]);

        // 6. Fazer upload (se Supabase configurado)
        if (supabaseEstaConfigurado()) {
          try {
            const resultado = await uploadImagem(blob, novaFoto.nome, contribuicaoId);

            // Atualizar com URL
            setFotos((prev) =>
              prev.map((f) =>
                f.uri === imageUri
                  ? { ...f, url: resultado.url, uploading: false }
                  : f
              )
            );
          } catch (uploadError) {
            // Upload falhou, manter local
            console.error("Erro ao fazer upload:", uploadError);
            setFotos((prev) =>
              prev.map((f) =>
                f.uri === imageUri
                  ? {
                      ...f,
                      uploading: false,
                      error: "Falha no upload",
                    }
                  : f
              )
            );
          }
        }

        return true;
      } catch (err) {
        setError("Erro ao processar imagem");
        console.error(err);
        return false;
      }
    },
    [fotos.length, maxFotos, maxTamanhoMB, contribuicaoId]
  );

  /**
   * Capturar foto com câmera
   */
  const capturarFoto = useCallback(async () => {
    try {
      // Pedir permissão
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        setError("Permissão de câmera negada");
        return;
      }

      // Abrir câmera
      const resultado = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!resultado.canceled) {
        const foto = resultado.assets[0];
        await processarImagem(foto.uri, `foto_${Date.now()}.jpg`);
      }
    } catch (err) {
      setError("Erro ao capturar foto");
      console.error(err);
    }
  }, [processarImagem]);

  /**
   * Selecionar foto da galeria
   */
  const selecionarDaGaleria = useCallback(async () => {
    try {
      // Pedir permissão
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        setError("Permissão de galeria negada");
        return;
      }

      // Abrir galeria
      const resultado = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!resultado.canceled) {
        const foto = resultado.assets[0];
        await processarImagem(foto.uri, foto.fileName || `galeria_${Date.now()}.jpg`);
      }
    } catch (err) {
      setError("Erro ao selecionar foto");
      console.error(err);
    }
  }, [processarImagem]);

  /**
   * Remover uma foto da lista
   */
  const remover = useCallback((uri: string) => {
    setFotos((prev) => prev.filter((f) => f.uri !== uri));
    setError(null);
  }, []);

  /**
   * Limpar todas as fotos
   */
  const limpar = useCallback(() => {
    setFotos([]);
    setError(null);
  }, []);

  /**
   * Obter apenas URLs (para salvar no BD)
   */
  const obterUrls = useCallback(() => {
    return fotos.filter((f) => f.url).map((f) => f.url!);
  }, [fotos]);

  /**
   * Obter apenas blobs locais (não uploadados)
   */
  const obterBlobsLocais = useCallback(async () => {
    const blobs: Blob[] = [];

    for (const foto of fotos) {
      if (!foto.url) {
        // Ainda não foi uploadado
        const response = await fetch(foto.uri);
        const blob = await response.blob();
        blobs.push(blob);
      }
    }

    return blobs;
  }, [fotos]);

  return {
    // Estado
    fotos,
    loading,
    error,
    totalFotos: fotos.length,
    podeAdicionarMais: fotos.length < maxFotos,

    // Ações
    capturarFoto,
    selecionarDaGaleria,
    remover,
    limpar,

    // Getters
    obterUrls,
    obterBlobsLocais,
  };
}
