// Estimativa de tabela nutricional a partir de ingredientes-chave.
// Valores aproximados (TACO/USDA) por 100 g. Ingredientes com perfis muito próximos
// (ex.: tipos de açúcar, óleos, cortes de carne bovina) usam um único proxy.

import type { Ingredient } from '../types';
import { deburr, normalizeItemKey } from './ingredientParser';
import { pesoEmGramas } from './weight';
import { round } from './scale';

export interface Nutrientes100g {
  kcal: number;
  gorduraTotal: number;
  gorduraSaturada: number;
  colesterolMg: number;
  carboidrato: number;
  acucares: number;
  proteina: number;
  fibra: number;
}

const ZERO: Nutrientes100g = {
  kcal: 0,
  gorduraTotal: 0,
  gorduraSaturada: 0,
  colesterolMg: 0,
  carboidrato: 0,
  acucares: 0,
  proteina: 0,
  fibra: 0,
};

// Ordem importa: entradas mais específicas antes das genéricas.
const TABELA: Array<[string[], Nutrientes100g]> = [
  [['manteiga'], { kcal: 726, gorduraTotal: 82, gorduraSaturada: 51, colesterolMg: 215, carboidrato: 0.1, acucares: 0.1, proteina: 0.4, fibra: 0 }],
  [['margarina'], { kcal: 596, gorduraTotal: 67, gorduraSaturada: 15, colesterolMg: 0, carboidrato: 0.4, acucares: 0.4, proteina: 0.6, fibra: 0 }],
  [['azeite'], { kcal: 884, gorduraTotal: 100, gorduraSaturada: 14, colesterolMg: 0, carboidrato: 0, acucares: 0, proteina: 0, fibra: 0 }],
  // proxy para óleos de soja/girassol/canola/milho.
  [['óleo'], { kcal: 884, gorduraTotal: 100, gorduraSaturada: 15, colesterolMg: 0, carboidrato: 0, acucares: 0, proteina: 0, fibra: 0 }],
  // proxy para açúcar refinado/cristal/demerara/mascavo/confeiteiro.
  [['açúcar'], { kcal: 387, gorduraTotal: 0, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 99.8, acucares: 99.8, proteina: 0, fibra: 0 }],
  [['leite condensado'], { kcal: 315, gorduraTotal: 7, gorduraSaturada: 4.5, colesterolMg: 34, carboidrato: 55, acucares: 55, proteina: 7.5, fibra: 0 }],
  [['leite de coco'], { kcal: 230, gorduraTotal: 24, gorduraSaturada: 21, colesterolMg: 0, carboidrato: 3, acucares: 3, proteina: 2.3, fibra: 0 }],
  [['creme de leite', 'nata'], { kcal: 165, gorduraTotal: 15, gorduraSaturada: 10, colesterolMg: 45, carboidrato: 4.4, acucares: 4, proteina: 2.4, fibra: 0 }],
  // proxy para leite integral/desnatado/semidesnatado.
  [['leite'], { kcal: 61, gorduraTotal: 3.3, gorduraSaturada: 2, colesterolMg: 10, carboidrato: 4.7, acucares: 4.7, proteina: 3.2, fibra: 0 }],
  [['farinha de trigo', 'farinha'], { kcal: 360, gorduraTotal: 1.4, gorduraSaturada: 0.2, colesterolMg: 0, carboidrato: 75, acucares: 0.3, proteina: 10, fibra: 2.3 }],
  [['fubá', 'farinha de milho'], { kcal: 360, gorduraTotal: 1.2, gorduraSaturada: 0.2, colesterolMg: 0, carboidrato: 78, acucares: 0.5, proteina: 7.7, fibra: 3 }],
  [['aveia'], { kcal: 389, gorduraTotal: 7, gorduraSaturada: 1.2, colesterolMg: 0, carboidrato: 66, acucares: 1, proteina: 17, fibra: 10 }],
  [['ovo'], { kcal: 146, gorduraTotal: 8.9, gorduraSaturada: 2.8, colesterolMg: 372, carboidrato: 0.6, acucares: 0.6, proteina: 13, fibra: 0 }],
  [['batata-doce', 'batata doce'], { kcal: 77, gorduraTotal: 0.1, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 18, acucares: 4, proteina: 1.3, fibra: 2.2 }],
  [['batata'], { kcal: 52, gorduraTotal: 0.1, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 12, acucares: 0.8, proteina: 1.9, fibra: 1.3 }],
  [['carne moída', 'carne moida'], { kcal: 212, gorduraTotal: 11, gorduraSaturada: 4.5, colesterolMg: 83, carboidrato: 0, acucares: 0, proteina: 26, fibra: 0 }],
  // proxy para maminha/patinho/coxão mole/duro/filé mignon/picanha/cortes bovinos em geral.
  [['alcatra', 'maminha', 'patinho', 'coxão', 'coxao', 'filé mignon', 'file mignon', 'picanha', 'carne bovina', 'carne'], { kcal: 163, gorduraTotal: 4.3, gorduraSaturada: 1.7, colesterolMg: 73, carboidrato: 0, acucares: 0, proteina: 30, fibra: 0 }],
  [['linguiça', 'bacon'], { kcal: 320, gorduraTotal: 28, gorduraSaturada: 10, colesterolMg: 65, carboidrato: 1.5, acucares: 0, proteina: 15, fibra: 0 }],
  [['peito de frango', 'frango'], { kcal: 159, gorduraTotal: 2.5, gorduraSaturada: 0.7, colesterolMg: 85, carboidrato: 0, acucares: 0, proteina: 32, fibra: 0 }],
  [['bacalhau', 'peixe', 'tilápia', 'salmão', 'merluza', 'pescada'], { kcal: 130, gorduraTotal: 3, gorduraSaturada: 0.7, colesterolMg: 55, carboidrato: 0, acucares: 0, proteina: 25, fibra: 0 }],
  [['mussarela', 'muçarela', 'queijo'], { kcal: 330, gorduraTotal: 25, gorduraSaturada: 15, colesterolMg: 79, carboidrato: 3, acucares: 1, proteina: 22, fibra: 0 }],
  [['arroz'], { kcal: 128, gorduraTotal: 0.2, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 28, acucares: 0, proteina: 2.5, fibra: 1.6 }],
  [['feijão'], { kcal: 76, gorduraTotal: 0.5, gorduraSaturada: 0.1, colesterolMg: 0, carboidrato: 13.6, acucares: 0.3, proteina: 4.8, fibra: 8.5 }],
  [['macarrão', 'espaguete', 'massa'], { kcal: 158, gorduraTotal: 0.9, gorduraSaturada: 0.1, colesterolMg: 0, carboidrato: 31, acucares: 1, proteina: 5.8, fibra: 1.8 }],
  [['pão'], { kcal: 300, gorduraTotal: 3, gorduraSaturada: 0.6, colesterolMg: 0, carboidrato: 58, acucares: 4, proteina: 8, fibra: 2.3 }],
  [['chocolate', 'cacau'], { kcal: 540, gorduraTotal: 30, gorduraSaturada: 18, colesterolMg: 20, carboidrato: 55, acucares: 51, proteina: 7, fibra: 3 }],
  [['mel'], { kcal: 304, gorduraTotal: 0, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 82, acucares: 82, proteina: 0.3, fibra: 0 }],
  [['cenoura'], { kcal: 34, gorduraTotal: 0.2, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 8, acucares: 4.7, proteina: 0.9, fibra: 3.2 }],
  [['cebola'], { kcal: 40, gorduraTotal: 0.1, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 9, acucares: 4.2, proteina: 1.1, fibra: 1.7 }],
  [['tomate'], { kcal: 18, gorduraTotal: 0.2, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 3.9, acucares: 2.6, proteina: 0.9, fibra: 1.2 }],
];

/** Encontra o registro nutricional de um item já normalizado (normalizeItemKey), usando proxies quando necessário. */
export function nutrientesDe(key: string): Nutrientes100g | undefined {
  for (const [chaves, n] of TABELA) {
    if (chaves.some((k) => key.includes(deburr(k).toLowerCase()))) return n;
  }
  return undefined;
}

function somar(a: Nutrientes100g, b: Nutrientes100g, fator: number): Nutrientes100g {
  return {
    kcal: a.kcal + b.kcal * fator,
    gorduraTotal: a.gorduraTotal + b.gorduraTotal * fator,
    gorduraSaturada: a.gorduraSaturada + b.gorduraSaturada * fator,
    colesterolMg: a.colesterolMg + b.colesterolMg * fator,
    carboidrato: a.carboidrato + b.carboidrato * fator,
    acucares: a.acucares + b.acucares * fator,
    proteina: a.proteina + b.proteina * fator,
    fibra: a.fibra + b.fibra * fator,
  };
}

/** Soma a contribuição nutricional de uma lista de ingredientes (com base no peso estimado de cada um). */
export function calcularNutricaoTotal(ingredientes: Ingredient[]): Nutrientes100g {
  let total = ZERO;
  for (const ing of ingredientes) {
    const info = nutrientesDe(normalizeItemKey(ing.item));
    if (!info) continue;
    const gramas = pesoEmGramas(ing.item, ing.quantidade, ing.unidade);
    if (gramas === null) continue;
    total = somar(total, info, gramas / 100);
  }
  return total;
}

/** Nutrientes de uma quantidade em gramas já conhecida de um item (usado no histórico de compras). */
export function nutrientesDeGramas(item: string, gramas: number): Nutrientes100g {
  const info = nutrientesDe(normalizeItemKey(item));
  if (!info) return ZERO;
  return somar(ZERO, info, gramas / 100);
}

export function dividirPorPorcoes(total: Nutrientes100g, porcoes: number): Nutrientes100g {
  const n = porcoes > 0 ? porcoes : 1;
  return {
    kcal: total.kcal / n,
    gorduraTotal: total.gorduraTotal / n,
    gorduraSaturada: total.gorduraSaturada / n,
    colesterolMg: total.colesterolMg / n,
    carboidrato: total.carboidrato / n,
    acucares: total.acucares / n,
    proteina: total.proteina / n,
    fibra: total.fibra / n,
  };
}

export function somarNutrientes(lista: Nutrientes100g[]): Nutrientes100g {
  return lista.reduce((acc, n) => somar(acc, n, 1), ZERO);
}

/** Valores diários de referência (RDC 429/2020, ANVISA), para dieta de 2.000 kcal. */
export const VD_REFERENCIA = {
  kcal: 2000,
  gorduraTotal: 55,
  gorduraSaturada: 22,
  colesterolMg: 300,
  carboidrato: 300,
  proteina: 75,
  fibra: 25,
} as const;

export function percentualVD(campo: keyof typeof VD_REFERENCIA, valor: number): number {
  return round((valor / VD_REFERENCIA[campo]) * 100);
}
