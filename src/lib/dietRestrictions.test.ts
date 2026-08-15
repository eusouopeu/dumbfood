import { describe, it, expect } from 'vitest';
import { encontrarTrocas, aplicarTrocas } from './dietRestrictions';
import { parseIngredient } from './ingredientParser';

function ing(raw: string) {
  return parseIngredient(raw);
}

describe('encontrarTrocas', () => {
  it('bate um item genérico dentro de um corte específico ("peito de frango" ~ "frango")', () => {
    const trocas = encontrarTrocas([ing('600 g de peito de frango')], 'vegano');
    expect(trocas).toHaveLength(1);
    expect(trocas[0].substituto).toMatch(/soja|grão-de-bico/);
  });

  it('prioriza a entrada mais específica sobre a genérica ("leite condensado" vs "leite")', () => {
    const trocas = encontrarTrocas([ing('1 lata de leite condensado')], 'vegano');
    expect(trocas).toHaveLength(1);
    expect(trocas[0].substituto).toContain('coco');
  });

  it('não sugere troca quando não há conflito com a restrição', () => {
    expect(encontrarTrocas([ing('2 xícaras de farinha de trigo')], 'vegano')).toHaveLength(0);
  });

  it('não sugere troca para "leite de coco" no modo vegano (já é vegetal)', () => {
    expect(encontrarTrocas([ing('400 ml de leite de coco')], 'vegano')).toHaveLength(0);
  });

  it('não sugere troca para "leite de coco" no modo sem lactose', () => {
    expect(encontrarTrocas([ing('400 ml de leite de coco')], 'sem_lactose')).toHaveLength(0);
  });

  it('detecta glúten em farinha de trigo', () => {
    const trocas = encontrarTrocas([ing('2 xícaras de farinha de trigo')], 'sem_gluten');
    expect(trocas).toHaveLength(1);
  });
});

describe('aplicarTrocas', () => {
  it('substitui o item mantendo quantidade e recalcula a gôndola', () => {
    const ingredientes = [ing('600 g de peito de frango'), ing('1 unidade de cebola')];
    const trocas = encontrarTrocas(ingredientes, 'vegano');
    const ajustados = aplicarTrocas(ingredientes, trocas);
    expect(ajustados[0].item).toMatch(/soja|grão-de-bico/);
    expect(ajustados[0].quantidade).toBe(ingredientes[0].quantidade);
    expect(ajustados[1].item).toBe(ingredientes[1].item);
  });
});
