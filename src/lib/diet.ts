// Presets de composição de macronutrientes por tipo de dieta (usados pela tela de Perfil
// como ponto de partida para a meta de macros) e o cálculo de composição relativa do que
// foi de fato comprado.
//
// A meta de verdade do dia — a que o app compara contra o que foi comido/comprado — é
// sempre a de metas.ts, em percentual de energia (kcal), calculada a partir do Perfil.
// Aqui os percentuais são só da massa (proteína + carboidrato + gordura), que é a base
// que faz sentido para "quanto, em gramas, eu de fato comprei" — sem ligação com um "dia".

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
