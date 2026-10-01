import { describe, expect, it } from 'vitest';
import { baixaPorConsumo } from './baixaDespensa';
import { normalizeItemKey } from './ingredientParser';
import type { GeladeiraItem, Ingredient } from '../types';

function ing(item: string, quantidade: number | null, unidade: string | null): Ingredient {
  return { raw: item, item, quantidade, unidade, gondola: 'outros' };
}

function despensa(nome: string, quantidade?: number, unidade?: string | null): GeladeiraItem {
  return {
    itemKey: normalizeItemKey(nome),
    nome,
    adicionadoEm: 1,
    ...(quantidade != null ? { quantidade, unidade: unidade ?? null } : {}),
  };
}

describe('baixaPorConsumo', () => {
  it('desconta na unidade da despensa, na proporção das porções comidas', () => {
    const receita = [ing('farinha de trigo', 500, 'g'), ing('ovo', 4, null)];
    const itens = [despensa('farinha de trigo', 1, 'kg'), despensa('ovo', 6, null)];
    // fator 0,5: metade da receita comida
    const r = baixaPorConsumo(receita, 0.5, itens);
    const farinha = r.atualizar.find((g) => g.itemKey === normalizeItemKey('farinha de trigo'));
    const ovo = r.atualizar.find((g) => g.itemKey === normalizeItemKey('ovo'));
    expect(farinha?.quantidade).toBe(0.75);
    expect(farinha?.unidade).toBe('kg');
    expect(ovo?.quantidade).toBe(4);
    expect(r.remover).toEqual([]);
  });

  it('remove o que acabou e não mexe no que não tem quantidade conhecida', () => {
    const receita = [ing('tomate', 2, null), ing('leite', 200, 'ml'), ing('sal', null, null)];
    const itens = [despensa('tomate', 2, null), despensa('leite'), despensa('sal', 1, 'kg')];
    const r = baixaPorConsumo(receita, 1, itens);
    expect(r.remover).toEqual([normalizeItemKey('tomate')]);
    expect(r.atualizar).toEqual([]);
  });
});
