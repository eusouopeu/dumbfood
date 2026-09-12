// Metas de composição de macronutrientes por tipo de dieta, e persistência da escolha.
//
// As metas são *relativas*: o percentual que cada macro representa da soma em gramas de
// proteína + carboidrato + gordura. Metas absolutas (g/dia, kcal/dia) valiam para uma
// pessoa por dia, mas a lista de mercado e o plano da semana cobrem várias refeições e
// mais de uma pessoa — daí saírem percentuais sem sentido, como "228% de gordura".
// Em proporção, o número se mantém legível independentemente do tamanho da compra.

import { useEffect, useState } from 'react';

export type Dieta = 'normal' | 'bulking' | 'cutting';

/** Percentuais da massa total de macros (proteína + carboidrato + gordura); somam 100. */
export interface MetaDieta {
  label: string;
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
}

export const DIETAS: Record<Dieta, MetaDieta> = {
  normal: { label: 'Normal', proteina: 27, carboidrato: 58, gorduraTotal: 15 },
  bulking: { label: 'Bulking', proteina: 25, carboidrato: 61, gorduraTotal: 14 },
  cutting: { label: 'Cutting', proteina: 40, carboidrato: 46, gorduraTotal: 14 },
};

export const DIETA_ORDEM: Dieta[] = ['normal', 'bulking', 'cutting'];

export interface GramasMacro {
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
}

/**
 * Converte gramas de macros em percentuais da soma dos três. Retorna zeros quando não
 * há nada medido, para o card não mostrar "NaN%".
 */
export function composicaoRelativa(g: GramasMacro): GramasMacro {
  const total = g.proteina + g.carboidrato + g.gorduraTotal;
  if (total <= 0) return { proteina: 0, carboidrato: 0, gorduraTotal: 0 };
  return {
    proteina: Math.round((g.proteina / total) * 100),
    carboidrato: Math.round((g.carboidrato / total) * 100),
    gorduraTotal: Math.round((g.gorduraTotal / total) * 100),
  };
}

const DIETA_KEY = 'dumbfood:dieta';

function loadDieta(): Dieta {
  const v = localStorage.getItem(DIETA_KEY);
  return v === 'bulking' || v === 'cutting' || v === 'normal' ? v : 'normal';
}

/** Preferência de dieta persistida localmente e compartilhada entre as abas Semana, Mercado e Histórico. */
export interface BarraComposicao {
  chave: keyof GramasMacro;
  rotulo: string;
  /** Percentual atual do macro na soma dos três (0 quando não há nada medido). */
  atual: number;
  /** Percentual-alvo da dieta escolhida. */
  meta: number;
}

/**
 * Linhas das barras de composição (plano da semana, lista de mercado): cada macro com o
 * percentual atual contra o da dieta, na mesma ordem das barras do painel do dia.
 */
export function barrasComposicao(real: GramasMacro, dieta: Dieta): BarraComposicao[] {
  const pct = composicaoRelativa(real);
  const meta = DIETAS[dieta];
  return [
    { chave: 'carboidrato', rotulo: 'Carboidratos', atual: pct.carboidrato, meta: meta.carboidrato },
    { chave: 'proteina', rotulo: 'Proteínas', atual: pct.proteina, meta: meta.proteina },
    { chave: 'gorduraTotal', rotulo: 'Gorduras', atual: pct.gorduraTotal, meta: meta.gorduraTotal },
  ];
}

export function useDieta(): [Dieta, (d: Dieta) => void] {
  const [dieta, setDieta] = useState<Dieta>(() => loadDieta());
  useEffect(() => {
    localStorage.setItem(DIETA_KEY, dieta);
  }, [dieta]);
  return [dieta, setDieta];
}
