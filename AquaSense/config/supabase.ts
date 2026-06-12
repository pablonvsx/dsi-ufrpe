/**
 * Configuracao do Supabase
 * Cliente unico (singleton) para toda a aplicacao.
 * Importe "supabase" a partir deste arquivo — nunca crie outro createClient em outro lugar.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Checagem em tempo de inicializacao — aparece no Metro/terminal ao startar o app
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[Supabase] ERRO CRITICO: variaveis de ambiente nao encontradas.\n" +
      "  Verifique se o arquivo .env (ou .env.local) contem:\n" +
      "    EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n" +
      "    EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...\n" +
      "  E que o Expo foi reiniciado com: npx expo start --clear"
  );
}

export const supabase = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY ?? ""
);

/** Retorna true somente se as duas variaveis de ambiente estao preenchidas. */
export function supabaseEstaConfigurado(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Nomes dos buckets — devem existir no dashboard do Supabase. */
export const BUCKETS = {
  CONTRIBUICOES: "aquasense-contribuicoes",
  PERFIL: "aquasense-perfil",
  DOCUMENTOS: "aquasense-documentos",
} as const;

/** MIME types aceitos para upload. */
export const MIME_TYPES = {
  imagem: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
};

/** Limites de tamanho de arquivo. */
export const LIMITES = {
  imagemMB: 5,
  imagemBytes: 5 * 1024 * 1024,
  pdfMB: 10,
  pdfBytes: 10 * 1024 * 1024,
};

export default supabase;