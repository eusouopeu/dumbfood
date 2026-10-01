// Baixa automática da despensa quando uma refeição é registrada.
//
// A despensa só crescia (nota fiscal, item à mão) e o "dar baixa" da receita era manual —
// na prática ninguém lembrava, e a despensa mentia. Registrar o consumo de uma receita já
// diz o que saiu da despensa: os ingredientes, na proporção das porções comidas.
//
// Só mexe no que tem quantidade conhecida. Item sem quantidade ("tem, não sei quanto")
// fica como está: não dá para saber se a receita acabou com ele.

import type { GeladeiraItem, Ingredient } from '../types';
import { ingredienteAtendido } from './geladeira';
import { normalizeItemKey } from './ingredientParser';
import { unitDefByCanonical } from './units';
import { pesoEmGramas } from './weight';

export interface BaixaDespensa {
  /** Itens com a quantidade já descontada. */
  atualizar: GeladeiraItem[];
  /** Chaves dos itens que acabaram. */
  remover: string[];
}

/** Abaixo disso (na unidade do item) sobra só resto de embalagem: o item sai da despensa. */
const RESTO_DESPREZIVEL = 0.001;

/**
 * Quanto do item da despensa a quantidade do ingrediente consome, na unidade do item.
 * null quando as unidades não conversam (xícara contra unidade, por exemplo).
 */
function consumoNaUnidade(item: GeladeiraItem, ing: Ingredient, quantidade: number): number | null {
  const defItem = item.unidade ? unitDefByCanonical(item.unidade) : undefined;
  const defIng = ing.unidade ? unitDefByCanonical(ing.unidade) : undefined;

  if (defItem?.dimension === 'massa') {
    const g = pesoEmGramas(ing.item, quantidade, ing.unidade);
    return g === null ? null : g / defItem.toBase;
  }
  if (defItem?.dimension === 'volume') {
    return defIng?.dimension === 'volume' ? (quantidade * defIng.toBase) / defItem.toBase : null;
  }
  // Contagem: "6 ovos" na despensa contra "2 ovos" (sem unidade) ou "2 unidades" na receita.
  const contagemItem = !item.unidade || item.unidade === 'unidade';
  const contagemIng = !ing.unidade || ing.unidade === 'unidade';
  if (contagemItem && contagemIng) return quantidade;
  if (item.unidade && item.unidade === ing.unidade) return quantidade;
  return null;
}

/**
 * Desconta da despensa os ingredientes da receita multiplicados por `fator`
 * (porções comidas ÷ rendimento da receita).
 */
export function baixaPorConsumo(ingredientes: Ingredient[], fator: number, despensa: GeladeiraItem[]): BaixaDespensa {
  const restante = new Map<string, number>();
  for (const ing of ingredientes) {
    if (ing.quantidade == null || ing.quantidade <= 0) continue;
    const key = normalizeItemKey(ing.item);
    const item = despensa.find((g) => g.quantidade != null && ingredienteAtendido(g.itemKey, key));
    if (!item) continue;
    const consumo = consumoNaUnidade(item, ing, ing.quantidade * fator);
    if (consumo === null || consumo <= 0) continue;
    const atual = restante.get(item.itemKey) ?? item.quantidade!;
    restante.set(item.itemKey, atual - consumo);
  }

  const atualizar: GeladeiraItem[] = [];
  const remover: string[] = [];
  for (const [itemKey, sobra] of restante) {
    if (sobra <= RESTO_DESPREZIVEL) {
      remover.push(itemKey);
      continue;
    }
    const item = despensa.find((g) => g.itemKey === itemKey)!;
    atualizar.push({ ...item, quantidade: Math.round(sobra * 100) / 100 });
  }
  return { atualizar, remover };
}
