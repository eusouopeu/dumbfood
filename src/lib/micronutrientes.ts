// Vitaminas e minerais dos ingredientes mais usados nas receitas.
// Mesma lógica da tabela nutricional (nutrition.ts): valores médios por 100 g do
// alimento como costuma entrar na receita, vindos de TACO/USDA, com proxies para
// famílias próximas (cortes bovinos, tipos de óleo, tipos de açúcar). São estimativas
// — servem para comparar receitas e enxergar carências grosseiras, não para
// prescrição nutricional.
//
// Unidades: µg para vitaminas A, D, B12 e folato; mg para o resto.

import type { Ingredient } from '../types';
import { deburr, normalizeItemKey } from './ingredientParser';
import { pesoEmGramas } from './weight';
import { round } from './scale';

export interface Micronutrientes100g {
  /** Vitamina A, em equivalentes de retinol (µg RE). */
  vitaminaA: number;
  vitaminaC: number;
  vitaminaD: number;
  vitaminaE: number;
  vitaminaB6: number;
  vitaminaB12: number;
  folato: number;
  calcio: number;
  ferro: number;
  magnesio: number;
  potassio: number;
  sodio: number;
  zinco: number;
}

export const CAMPOS_MICRO: { chave: keyof Micronutrientes100g; label: string; unidade: 'mg' | 'µg' }[] = [
  { chave: 'vitaminaA', label: 'Vitamina A', unidade: 'µg' },
  { chave: 'vitaminaC', label: 'Vitamina C', unidade: 'mg' },
  { chave: 'vitaminaD', label: 'Vitamina D', unidade: 'µg' },
  { chave: 'vitaminaE', label: 'Vitamina E', unidade: 'mg' },
  { chave: 'vitaminaB6', label: 'Vitamina B6', unidade: 'mg' },
  { chave: 'vitaminaB12', label: 'Vitamina B12', unidade: 'µg' },
  { chave: 'folato', label: 'Folato (B9)', unidade: 'µg' },
  { chave: 'calcio', label: 'Cálcio', unidade: 'mg' },
  { chave: 'ferro', label: 'Ferro', unidade: 'mg' },
  { chave: 'magnesio', label: 'Magnésio', unidade: 'mg' },
  { chave: 'potassio', label: 'Potássio', unidade: 'mg' },
  { chave: 'sodio', label: 'Sódio', unidade: 'mg' },
  { chave: 'zinco', label: 'Zinco', unidade: 'mg' },
];

export const ZERO_MICRO: Micronutrientes100g = {
  vitaminaA: 0, vitaminaC: 0, vitaminaD: 0, vitaminaE: 0, vitaminaB6: 0,
  vitaminaB12: 0, folato: 0, calcio: 0, ferro: 0, magnesio: 0,
  potassio: 0, sodio: 0, zinco: 0,
};

/** Atalho para escrever a tabela sem repetir os treze campos em cada linha. */
function m(v: Partial<Micronutrientes100g>): Micronutrientes100g {
  return { ...ZERO_MICRO, ...v };
}

// 40 ingredientes, ordem do mais específico para o mais genérico (mesma regra de nutrition.ts:
// "leite condensado" precisa casar antes de "leite").
const TABELA: Array<[string[], Micronutrientes100g]> = [
  // --- Carnes, ovos e pescados ---
  // proxy para cortes bovinos magros em geral (patinho, alcatra, coxão, maminha...).
  [['alcatra', 'maminha', 'patinho', 'coxão', 'coxao', 'filé mignon', 'file mignon', 'picanha', 'carne bovina', 'carne vermelha'],
    m({ vitaminaB6: 0.5, vitaminaB12: 2.6, folato: 8, ferro: 2.6, magnesio: 22, potassio: 330, sodio: 55, zinco: 4.8, vitaminaE: 0.4 })],
  [['carne moída', 'carne moida'],
    m({ vitaminaB6: 0.35, vitaminaB12: 2.4, folato: 7, ferro: 2.4, magnesio: 19, potassio: 290, sodio: 66, zinco: 4.5, vitaminaE: 0.4 })],
  [['linguiça', 'linguica', 'bacon', 'salsicha'],
    m({ vitaminaB6: 0.3, vitaminaB12: 1.1, folato: 4, ferro: 1.1, magnesio: 15, potassio: 250, sodio: 1200, zinco: 1.9, vitaminaD: 0.6 })],
  [['peito de frango', 'frango', 'peru'],
    m({ vitaminaB6: 0.6, vitaminaB12: 0.3, folato: 4, ferro: 0.7, magnesio: 29, potassio: 340, sodio: 65, zinco: 1, vitaminaE: 0.3, vitaminaA: 9 })],
  [['bacalhau', 'peixe', 'tilápia', 'tilapia', 'salmão', 'salmao', 'merluza', 'pescada', 'sardinha'],
    m({ vitaminaA: 20, vitaminaD: 5, vitaminaE: 0.7, vitaminaB6: 0.3, vitaminaB12: 2.5, folato: 8, calcio: 20, ferro: 0.5, magnesio: 30, potassio: 380, sodio: 60, zinco: 0.6 })],
  [['ovo'],
    m({ vitaminaA: 160, vitaminaD: 2, vitaminaE: 1.1, vitaminaB6: 0.17, vitaminaB12: 1.1, folato: 47, calcio: 56, ferro: 1.8, magnesio: 12, potassio: 138, sodio: 142, zinco: 1.3 })],

  // --- Laticínios e derivados ---
  [['leite condensado'],
    m({ vitaminaA: 74, vitaminaC: 2.7, vitaminaD: 0.3, vitaminaB6: 0.05, vitaminaB12: 0.4, folato: 11, calcio: 284, ferro: 0.2, magnesio: 26, potassio: 371, sodio: 127, zinco: 0.9 })],
  [['leite de coco'],
    m({ vitaminaC: 2.8, vitaminaE: 0.15, vitaminaB6: 0.03, folato: 16, calcio: 16, ferro: 1.6, magnesio: 37, potassio: 263, sodio: 15, zinco: 0.7 })],
  [['leite em pó', 'leite em po'],
    m({ vitaminaA: 260, vitaminaC: 8, vitaminaD: 0.5, vitaminaB6: 0.3, vitaminaB12: 3.3, folato: 37, calcio: 912, ferro: 0.5, magnesio: 85, potassio: 1330, sodio: 371, zinco: 3.3 })],
  [['creme de leite', 'nata'],
    m({ vitaminaA: 150, vitaminaC: 0.8, vitaminaD: 0.4, vitaminaE: 0.5, vitaminaB6: 0.03, vitaminaB12: 0.3, folato: 5, calcio: 90, magnesio: 9, potassio: 120, sodio: 40, zinco: 0.3 })],
  [['iogurte'],
    m({ vitaminaA: 27, vitaminaC: 0.5, vitaminaD: 0.1, vitaminaB6: 0.05, vitaminaB12: 0.4, folato: 7, calcio: 121, ferro: 0.1, magnesio: 12, potassio: 155, sodio: 46, zinco: 0.6 })],
  [['mussarela', 'muçarela', 'queijo', 'requeijão', 'requeijao'],
    m({ vitaminaA: 220, vitaminaD: 0.4, vitaminaE: 0.3, vitaminaB6: 0.06, vitaminaB12: 1.3, folato: 9, calcio: 700, ferro: 0.4, magnesio: 25, potassio: 90, sodio: 620, zinco: 3 })],
  [['manteiga'],
    m({ vitaminaA: 684, vitaminaD: 1.5, vitaminaE: 2.3, vitaminaB12: 0.2, calcio: 24, magnesio: 2, potassio: 24, sodio: 11, zinco: 0.1 })],
  [['margarina'],
    m({ vitaminaA: 800, vitaminaD: 7.5, vitaminaE: 9, calcio: 3, magnesio: 1, potassio: 18, sodio: 750 })],
  [['leite'],
    m({ vitaminaA: 46, vitaminaC: 1, vitaminaD: 0.1, vitaminaE: 0.1, vitaminaB6: 0.04, vitaminaB12: 0.5, folato: 5, calcio: 113, ferro: 0.03, magnesio: 10, potassio: 143, sodio: 43, zinco: 0.4 })],

  // --- Gorduras e açúcares ---
  [['azeite'],
    m({ vitaminaE: 14.4, sodio: 2 })],
  // proxy para óleos de soja/girassol/canola/milho.
  [['óleo', 'oleo'],
    m({ vitaminaE: 12, sodio: 0 })],
  [['coco ralado'],
    m({ vitaminaC: 1.5, vitaminaE: 0.4, vitaminaB6: 0.3, folato: 9, calcio: 26, ferro: 3.3, magnesio: 90, potassio: 543, sodio: 37, zinco: 2 })],
  // proxy para açúcar refinado/cristal/demerara/mascavo/confeiteiro.
  [['açúcar', 'acucar'],
    m({ calcio: 1, ferro: 0.05, potassio: 2, sodio: 1 })],
  [['mel'],
    m({ vitaminaC: 0.5, calcio: 6, ferro: 0.4, magnesio: 2, potassio: 52, sodio: 4, zinco: 0.2 })],
  [['chocolate', 'cacau'],
    m({ vitaminaE: 0.6, vitaminaB6: 0.04, folato: 12, calcio: 73, ferro: 8, magnesio: 146, potassio: 559, sodio: 24, zinco: 2.3 })],

  // --- Grãos, farinhas e massas ---
  [['aveia'],
    m({ vitaminaE: 0.7, vitaminaB6: 0.12, folato: 56, calcio: 54, ferro: 4.7, magnesio: 177, potassio: 429, sodio: 2, zinco: 4 })],
  [['farinha de trigo', 'farinha'],
    m({ vitaminaE: 0.06, vitaminaB6: 0.04, folato: 26, calcio: 15, ferro: 1.2, magnesio: 22, potassio: 107, sodio: 2, zinco: 0.7 })],
  [['fubá', 'fuba', 'farinha de milho'],
    m({ vitaminaA: 11, vitaminaE: 0.25, vitaminaB6: 0.18, folato: 25, calcio: 3, ferro: 1.1, magnesio: 32, potassio: 142, sodio: 5, zinco: 0.7 })],
  [['arroz'],
    m({ vitaminaB6: 0.05, folato: 3, calcio: 4, ferro: 0.3, magnesio: 13, potassio: 35, sodio: 1, zinco: 0.5 })],
  [['feijão', 'feijao'],
    m({ vitaminaC: 0.6, vitaminaE: 0.1, vitaminaB6: 0.1, folato: 65, calcio: 27, ferro: 1.5, magnesio: 42, potassio: 355, sodio: 2, zinco: 0.7 })],
  [['lentilha', 'grão-de-bico', 'grao-de-bico', 'grao de bico'],
    m({ vitaminaC: 1.5, vitaminaE: 0.2, vitaminaB6: 0.18, folato: 181, calcio: 19, ferro: 3.3, magnesio: 36, potassio: 369, sodio: 6, zinco: 1.3 })],
  [['macarrão', 'macarrao', 'espaguete', 'massa'],
    m({ vitaminaB6: 0.05, folato: 18, calcio: 7, ferro: 0.5, magnesio: 18, potassio: 44, sodio: 1, zinco: 0.5 })],
  [['pão', 'pao'],
    m({ vitaminaE: 0.2, vitaminaB6: 0.09, folato: 43, calcio: 40, ferro: 2.4, magnesio: 25, potassio: 120, sodio: 500, zinco: 0.8 })],
  [['amendoim', 'castanha', 'noz', 'nozes'],
    m({ vitaminaE: 8, vitaminaB6: 0.35, folato: 145, calcio: 55, ferro: 2.3, magnesio: 176, potassio: 660, sodio: 6, zinco: 3.3 })],

  // --- Hortifruti ---
  [['batata-doce', 'batata doce'],
    m({ vitaminaA: 709, vitaminaC: 2.4, vitaminaE: 0.26, vitaminaB6: 0.2, folato: 11, calcio: 30, ferro: 0.6, magnesio: 25, potassio: 337, sodio: 55, zinco: 0.3 })],
  [['batata'],
    m({ vitaminaC: 19.7, vitaminaE: 0.01, vitaminaB6: 0.3, folato: 15, calcio: 12, ferro: 0.8, magnesio: 23, potassio: 421, sodio: 6, zinco: 0.3 })],
  [['mandioca', 'aipim', 'macaxeira'],
    m({ vitaminaA: 1, vitaminaC: 20.6, vitaminaE: 0.19, vitaminaB6: 0.09, folato: 27, calcio: 16, ferro: 0.27, magnesio: 21, potassio: 271, sodio: 14, zinco: 0.34 })],
  [['cebola'],
    m({ vitaminaC: 7.4, vitaminaE: 0.02, vitaminaB6: 0.12, folato: 19, calcio: 23, ferro: 0.21, magnesio: 10, potassio: 146, sodio: 4, zinco: 0.17 })],
  [['alho'],
    m({ vitaminaC: 31.2, vitaminaE: 0.08, vitaminaB6: 1.24, folato: 3, calcio: 181, ferro: 1.7, magnesio: 25, potassio: 401, sodio: 17, zinco: 1.16 })],
  [['tomate'],
    m({ vitaminaA: 42, vitaminaC: 13.7, vitaminaE: 0.54, vitaminaB6: 0.08, folato: 15, calcio: 10, ferro: 0.27, magnesio: 11, potassio: 237, sodio: 5, zinco: 0.17 })],
  [['cenoura'],
    m({ vitaminaA: 835, vitaminaC: 5.9, vitaminaE: 0.66, vitaminaB6: 0.14, folato: 19, calcio: 33, ferro: 0.3, magnesio: 12, potassio: 320, sodio: 69, zinco: 0.24 })],
  [['pimentão', 'pimentao'],
    m({ vitaminaA: 157, vitaminaC: 128, vitaminaE: 1.58, vitaminaB6: 0.29, folato: 46, calcio: 7, ferro: 0.43, magnesio: 12, potassio: 211, sodio: 4, zinco: 0.25 })],
  [['brócolis', 'brocolis'],
    m({ vitaminaA: 31, vitaminaC: 89.2, vitaminaE: 0.78, vitaminaB6: 0.18, folato: 63, calcio: 47, ferro: 0.73, magnesio: 21, potassio: 316, sodio: 33, zinco: 0.41 })],
  [['espinafre', 'couve'],
    m({ vitaminaA: 469, vitaminaC: 28, vitaminaE: 2, vitaminaB6: 0.2, folato: 194, calcio: 99, ferro: 2.7, magnesio: 79, potassio: 558, sodio: 79, zinco: 0.53 })],
  [['abobrinha', 'abóbora', 'abobora'],
    m({ vitaminaA: 200, vitaminaC: 17.9, vitaminaE: 0.12, vitaminaB6: 0.16, folato: 24, calcio: 16, ferro: 0.37, magnesio: 18, potassio: 261, sodio: 8, zinco: 0.32 })],
  [['banana'],
    m({ vitaminaA: 3, vitaminaC: 8.7, vitaminaE: 0.1, vitaminaB6: 0.37, folato: 20, calcio: 5, ferro: 0.26, magnesio: 27, potassio: 358, sodio: 1, zinco: 0.15 })],
  [['laranja'],
    m({ vitaminaA: 11, vitaminaC: 53.2, vitaminaE: 0.18, vitaminaB6: 0.06, folato: 30, calcio: 40, ferro: 0.1, magnesio: 10, potassio: 181, sodio: 0, zinco: 0.07 })],
  [['limão', 'limao'],
    m({ vitaminaA: 1, vitaminaC: 53, vitaminaE: 0.15, vitaminaB6: 0.08, folato: 11, calcio: 26, ferro: 0.6, magnesio: 8, potassio: 138, sodio: 2, zinco: 0.06 })],
  [['maçã', 'maca'],
    m({ vitaminaA: 3, vitaminaC: 4.6, vitaminaE: 0.18, vitaminaB6: 0.04, folato: 3, calcio: 6, ferro: 0.12, magnesio: 5, potassio: 107, sodio: 1, zinco: 0.04 })],
];

/**
 * Registro de micronutrientes de um item já normalizado (normalizeItemKey).
 * Óleo de fritura fica de fora pelo mesmo motivo que em nutrition.ts (boa parte não vai
 * para o prato) — as duas tabelas precisam contar a mesma história sobre a receita.
 */
export function micronutrientesDe(key: string): Micronutrientes100g | undefined {
  if (key.includes('oleo')) return undefined;
  for (const [chaves, valores] of TABELA) {
    if (chaves.some((k) => key.includes(deburr(k).toLowerCase()))) return valores;
  }
  return undefined;
}

function somar(a: Micronutrientes100g, b: Micronutrientes100g, fator: number): Micronutrientes100g {
  const saida = {} as Micronutrientes100g;
  for (const { chave } of CAMPOS_MICRO) saida[chave] = a[chave] + b[chave] * fator;
  return saida;
}

/** Soma a contribuição de uma lista de ingredientes, pelo peso estimado de cada um. */
export function calcularMicroTotal(ingredientes: Ingredient[]): Micronutrientes100g {
  let total = ZERO_MICRO;
  for (const ing of ingredientes) {
    const info = micronutrientesDe(normalizeItemKey(ing.item));
    if (!info) continue;
    const gramas = pesoEmGramas(ing.item, ing.quantidade, ing.unidade);
    if (gramas === null) continue;
    total = somar(total, info, gramas / 100);
  }
  return total;
}

export function dividirMicro(total: Micronutrientes100g, divisor: number): Micronutrientes100g {
  const n = divisor > 0 ? divisor : 1;
  const saida = {} as Micronutrientes100g;
  for (const { chave } of CAMPOS_MICRO) saida[chave] = total[chave] / n;
  return saida;
}

/** Valores diários de referência para adultos (RDC 429/2020, ANVISA). */
export const VD_MICRO: Record<keyof Micronutrientes100g, number> = {
  vitaminaA: 600,
  vitaminaC: 45,
  vitaminaD: 15,
  vitaminaE: 10,
  vitaminaB6: 1.3,
  vitaminaB12: 2.4,
  folato: 400,
  calcio: 1000,
  ferro: 14,
  magnesio: 260,
  potassio: 3510,
  sodio: 2000,
  zinco: 7,
};

export function percentualVDMicro(campo: keyof Micronutrientes100g, valor: number): number {
  return round((valor / VD_MICRO[campo]) * 100);
}

/** Quantos ingredientes da receita a tabela conhece — a estimativa vale o que essa cobertura vale. */
export function coberturaMicro(ingredientes: Ingredient[]): { conhecidos: number; total: number } {
  const distintos = new Map<string, boolean>();
  for (const ing of ingredientes) {
    const key = normalizeItemKey(ing.item);
    if (!key || distintos.has(key)) continue;
    distintos.set(key, micronutrientesDe(key) !== undefined);
  }
  return {
    conhecidos: Array.from(distintos.values()).filter(Boolean).length,
    total: distintos.size,
  };
}
