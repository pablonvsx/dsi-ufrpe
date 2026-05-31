/**
 * Configuração do Supabase
 * Cliente para operações de storage e autenticação
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️  Variáveis de ambiente Supabase não configuradas:\n" +
    "   EXPO_PUBLIC_SUPABASE_URL\n" +
    "   EXPO_PUBLIC_SUPABASE_ANON_KEY\n" +
    "   Adicione no arquivo .env.local"
  );
}

/**
 * Cliente Supabase único para toda a app
 * Singleton pattern - reutilizar em todo o projeto
 */
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder_key"
);

/**
 * Verificar se Supabase está configurado
 * Use antes de fazer operações de storage
 */
export function supabaseEstaConfigurado(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Nomes de buckets (criar manualmente no Supabase)
 */
export const BUCKETS = {
  CONTRIBUICOES: "aquasense-contribuicoes",
  PERFIL: "aquasense-perfil",
  DOCUMENTOS: "aquasense-documentos",
};

/**
 * Tipos de MIME aceitos
 */
export const MIME_TYPES = {
  imagem: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
};

/**
 * Limites de tamanho (em bytes)
 */
export const LIMITES = {
  imagemMB: 5, // 5 MB
  imagemBytes: 5 * 1024 * 1024,
  pdfMB: 10, // 10 MB
  pdfBytes: 10 * 1024 * 1024,
};

export default supabase;
