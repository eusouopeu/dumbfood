// Metas de referência de macros/calorias por tipo de dieta, e persistência da escolha do usuário.
// Valores médios para um homem de 30 anos, 1,84 m (~79 kg, peso ideal por Devine),
// TDEE estimado via Mifflin-St Jeor + atividade moderada.

import { useEffect, useState } from 'react';

export type Dieta = 'normal' | 'bulking' | 'cutting';

export interface MetaDieta {
  label: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
}

export const DIETAS: Record<Dieta, MetaDieta> = {
  normal: { label: 'Normal', kcal: 2850, proteina: 160, carboidrato: 350, gorduraTotal: 90 },
  bulking: { label: 'Bulking', kcal: 3420, proteina: 180, carboidrato: 450, gorduraTotal: 100 },
  cutting: { label: 'Cutting', kcal: 2270, proteina: 190, carboidrato: 220, gorduraTotal: 70 },
};

export const DIETA_ORDEM: Dieta[] = ['normal', 'bulking', 'cutting'];

const DIETA_KEY = 'dumbfood:dieta';

function loadDieta(): Dieta {
  const v = localStorage.getItem(DIETA_KEY);
  return v === 'bulking' || v === 'cutting' || v === 'normal' ? v : 'normal';
}

/** Preferência de dieta persistida localmente e compartilhada entre as abas Semana, Mercado e Histórico. */
export function useDieta(): [Dieta, (d: Dieta) => void] {
  const [dieta, setDieta] = useState<Dieta>(() => loadDieta());
  useEffect(() => {
    localStorage.setItem(DIETA_KEY, dieta);
  }, [dieta]);
  return [dieta, setDieta];
}
