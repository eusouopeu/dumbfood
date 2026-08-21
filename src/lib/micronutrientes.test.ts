import { describe, expect, it } from 'vitest';
import {
  CAMPOS_MICRO,
  calcularMicroTotal,
  coberturaMicro,
  dividirMicro,
  micronutrientesDe,
  percentualVDMicro,
} from './micronutrientes';
import { parseIngredient } from './ingredientParser';

describe('micronutrientesDe', () => {
  it('cobre os ingredientes-âncora pedidos', () => {
    for (const item of ['carne bovina', 'frango', 'ovo', 'banana', 'aveia', 'leite', 'cebola', 'alho', 'leite de coco']) {
      expect(micronutrientesDe(item), item).toBeDefined();
    }
  });

  it('casa o específico antes do genérico', () => {
    // "leite de coco" não pode cair na linha do leite de vaca (que tem B12 e muito cálcio).
    expect(micronutrientesDe('leite de coco')?.vitaminaB12).toBe(0);
    expect(micronutrientesDe('leite')?.vitaminaB12).toBeGreaterThan(0);
  });

  it('devolve undefined para item fora da tabela', () => {
    expect(micronutrientesDe('glitter comestivel')).toBeUndefined();
  });

  it('ignora óleo de fritura, como a tabela nutricional', () => {
    expect(micronutrientesDe('oleo de soja')).toBeUndefined();
    expect(micronutrientesDe('azeite')).toBeDefined();
  });

  it('mantém todos os campos preenchidos em cada registro', () => {
    const banana = micronutrientesDe('banana')!;
    for (const { chave } of CAMPOS_MICRO) expect(typeof banana[chave]).toBe('number');
  });
});

describe('calcularMicroTotal', () => {
  it('escala pelo peso do ingrediente', () => {
    const total = calcularMicroTotal([parseIngredient('200 g de banana')]);
    // 100 g de banana têm 358 mg de potássio; 200 g têm o dobro.
    expect(total.potassio).toBeCloseTo(716, 0);
  });

  it('soma ingredientes diferentes e ignora o que não conhece', () => {
    const total = calcularMicroTotal([parseIngredient('100 g de banana'), parseIngredient('a gosto de glitter')]);
    expect(total.potassio).toBeCloseTo(358, 0);
  });

  it('converte unidades de contagem pelo peso médio', () => {
    // 2 ovos ≈ 100 g, ou seja, exatamente os valores de tabela por 100 g.
    const total = calcularMicroTotal([parseIngredient('2 ovos')]);
    expect(total.vitaminaB12).toBeCloseTo(1.1, 1);
    expect(total.calcio).toBeCloseTo(56, 0);
  });
});

describe('dividirMicro e percentualVDMicro', () => {
  it('divide por porção sem estourar em divisor zero', () => {
    const total = calcularMicroTotal([parseIngredient('200 g de banana')]);
    expect(dividirMicro(total, 2).potassio).toBeCloseTo(358, 0);
    expect(dividirMicro(total, 0).potassio).toBeCloseTo(716, 0);
  });

  it('calcula o percentual do valor diário', () => {
    expect(percentualVDMicro('vitaminaC', 45)).toBe(100);
    expect(percentualVDMicro('ferro', 7)).toBe(50);
  });
});

describe('coberturaMicro', () => {
  it('conta ingredientes distintos conhecidos', () => {
    const cobertura = coberturaMicro([
      parseIngredient('2 ovos'),
      parseIngredient('1 ovo'),
      parseIngredient('50 g de glitter'),
    ]);
    expect(cobertura).toEqual({ conhecidos: 1, total: 2 });
  });
});
