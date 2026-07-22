// Padronização de medidas de ingredientes:
//  - 'metrico'   : converte recipientes (xícara, colher...) para gramas/litros
//  - 'recipiente': converte gramas/ml para recipientes (xícara, colher de sopa/chá)
// Usa densidades médias por ingrediente. Itens "por inteiro" (ovos, cenouras: contagem)
// e medidas sem volume definido (pitada, fio) são deixados intactos.

import { normalizeItemKey } from './ingredientParser';
import { unitDefByCanonical } from './units';
import { round } from './scale';

export type MedidaModo = 'original' | 'metrico' | 'recipiente';

/** Volume médio de cada recipiente, em ml. */
const VOLUME_ML: Record<string, number> = {
  xicara: 240,
  copo: 240,
  colher_sopa: 15,
  colher_cha: 5,
  colher_sobremesa: 10,
};

// Densidade média (g/ml) por ingrediente. Ordem importa: chaves mais específicas antes.
const DENSIDADE: Array<[string, number]> = [
  ['acucar de confeiteiro', 0.56],
  ['acucar mascavo', 0.72],
  ['acucar', 0.8],
  ['farinha', 0.5],
  ['chocolate em po', 0.42],
  ['cacau', 0.42],
  ['amido', 0.48],
  ['maisena', 0.48],
  ['fuba', 0.6],
  ['polvilho', 0.6],
  ['aveia', 0.35],
  ['coco ralado', 0.35],
  ['queijo', 0.4],
  ['manteiga', 0.9],
  ['margarina', 0.9],
  ['sal', 1.2],
  ['fermento', 0.9],
  ['leite condensado', 1.28],
  ['leite de coco', 0.98],
  ['creme de leite', 1.0],
  ['leite', 1.03],
  ['oleo', 0.92],
  ['azeite', 0.92],
  ['mel', 1.4],
  ['vinagre', 1.01],
  ['agua', 1.0],
];

const LIQUIDOS = [
  'leite', 'oleo', 'azeite', 'agua', 'vinagre', 'suco',
  'creme de leite', 'mel', 'leite de coco', 'caldo', 'agua de coco',
];

function densidadeDe(key: string): number | undefined {
  for (const [k, d] of DENSIDADE) if (key.includes(k)) return d;
  return undefined;
}
function ehLiquido(key: string): boolean {
  return LIQUIDOS.some((l) => key.includes(l));
}
function roundStep(n: number, step: number): number {
  return round(Math.round(n / step) * step);
}

interface Medida {
  quantidade: number | null;
  unidade: string | null;
}

/** Converte ml para o recipiente mais adequado (xícara / colher de sopa / colher de chá). */
function paraRecipiente(ml: number): Medida {
  if (ml >= 180) return { quantidade: Math.max(0.25, roundStep(ml / 240, 0.25)), unidade: 'xicara' };
  if (ml >= 12) return { quantidade: Math.max(0.5, roundStep(ml / 15, 0.5)), unidade: 'colher_sopa' };
  return { quantidade: Math.max(0.5, roundStep(ml / 5, 0.5)), unidade: 'colher_cha' };
}

/** Aplica a padronização de medida a um ingrediente (só quantidade/unidade). */
export function padronizarMedida(
  item: string,
  quantidade: number | null,
  unidade: string | null,
  modo: MedidaModo,
): Medida {
  if (modo === 'original' || quantidade === null || !unidade) {
    return { quantidade, unidade };
  }
  const def = unitDefByCanonical(unidade);
  if (!def || def.dimension === 'contagem') {
    return { quantidade, unidade }; // itens inteiros (ovos, latas...) ficam intactos
  }
  const key = normalizeItemKey(item);
  const dens = densidadeDe(key);
  const liquido = ehLiquido(key);

  if (modo === 'metrico') {
    if (def.dimension !== 'cozinha') return { quantidade, unidade }; // já é métrico (g/ml)
    const ml = VOLUME_ML[unidade];
    if (ml === undefined) return { quantidade, unidade }; // pitada/fio/gota: sem volume
    const totalMl = ml * quantidade;
    if (liquido) {
      return totalMl >= 1000
        ? { quantidade: round(totalMl / 1000), unidade: 'l' }
        : { quantidade: round(totalMl), unidade: 'ml' };
    }
    if (dens !== undefined) {
      const g = totalMl * dens;
      return g >= 1000 ? { quantidade: round(g / 1000), unidade: 'kg' } : { quantidade: round(g), unidade: 'g' };
    }
    return { quantidade, unidade };
  }

  // modo === 'recipiente'
  let ml: number;
  if (def.dimension === 'massa') {
    if (dens === undefined) return { quantidade, unidade };
    ml = (quantidade * def.toBase) / dens;
  } else if (def.dimension === 'volume') {
    ml = quantidade * def.toBase;
  } else {
    return { quantidade, unidade }; // já é recipiente
  }
  return paraRecipiente(ml);
}
