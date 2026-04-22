// constants/observationOptions.ts
// Opções padronizadas compartilhadas entre RegisterObservation e RegisterWaterBody

export const COR_OPTIONS = [
  'Transparente',
  'Esverdeada',
  'Amarelada',
  'Marrom',
  'Escura',
  'Outra',
] as const;

export const ODOR_OPTIONS = [
  'Sem odor',
  'Cheiro leve',
  'Cheiro forte',
  'Cheiro químico',
] as const;

export type CorOption = (typeof COR_OPTIONS)[number] | null;
export type OdorOption = (typeof ODOR_OPTIONS)[number] | null;
export type YesNo = 'sim' | 'nao' | null;