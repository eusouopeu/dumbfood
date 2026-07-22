import { describe, it, expect } from 'vitest';
import { calcularNutricaoTotal, dividirPorPorcoes, percentualVD } from './nutrition';
import { parseIngredientLines } from './ingredientParser';

describe('calcularNutricaoTotal', () => {
  it('soma nutrientes de ingredientes-chave reconhecidos', () => {
    // 100 g de açúcar -> tabela: kcal 387, carboidrato 99.8 g.
    const total = calcularNutricaoTotal(parseIngredientLines(['100 g de açúcar']));
    expect(total.kcal).toBeCloseTo(387, 0);
    expect(total.carboidrato).toBeCloseTo(99.8, 1);
  });

  it('ignora ingredientes sem correspondência conhecida (temperos)', () => {
    const total = calcularNutricaoTotal(parseIngredientLines(['1 pitada de sal']));
    expect(total.kcal).toBe(0);
  });

  it('usa proxy para óleos e cortes de carne semelhantes', () => {
    const soja = calcularNutricaoTotal(parseIngredientLines(['100 ml de óleo de soja']));
    const girassol = calcularNutricaoTotal(parseIngredientLines(['100 ml de óleo de girassol']));
    expect(soja.kcal).toBeCloseTo(girassol.kcal, 5);

    const maminha = calcularNutricaoTotal(parseIngredientLines(['100 g de maminha']));
    const alcatra = calcularNutricaoTotal(parseIngredientLines(['100 g de alcatra']));
    expect(maminha.proteina).toBeCloseTo(alcatra.proteina, 5);
  });

  it('divide o total por porções', () => {
    const total = calcularNutricaoTotal(parseIngredientLines(['200 g de açúcar']));
    const porPorcao = dividirPorPorcoes(total, 4);
    expect(porPorcao.kcal).toBeCloseTo(total.kcal / 4, 5);
  });
});

describe('percentualVD', () => {
  it('calcula o percentual do valor diário de referência', () => {
    expect(percentualVD('kcal', 1000)).toBe(50);
    expect(percentualVD('fibra', 25)).toBe(100);
  });
});
