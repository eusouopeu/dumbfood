import { describe, it, expect } from 'vitest';
import { barrasComposicao, composicaoRelativa, DIETAS, DIETA_ORDEM } from './diet';

describe('composicaoRelativa', () => {
  it('divide cada macro pela soma dos três', () => {
    // 25 + 50 + 25 = 100 g de macros
    expect(composicaoRelativa({ proteina: 25, carboidrato: 50, gorduraTotal: 25 })).toEqual({
      proteina: 25,
      carboidrato: 50,
      gorduraTotal: 25,
    });
  });

  // O bug relatado: com meta absoluta, uma lista de mercado para a semana toda
  // estourava "228% de gordura". Em proporção, nenhum macro passa de 100%.
  it('nunca passa de 100%, por maior que seja a lista', () => {
    const enorme = composicaoRelativa({ proteina: 1200, carboidrato: 3400, gorduraTotal: 900 });
    for (const v of Object.values(enorme)) expect(v).toBeLessThanOrEqual(100);
    expect(enorme.proteina + enorme.carboidrato + enorme.gorduraTotal).toBeGreaterThanOrEqual(99);
  });

  it('devolve zeros quando não há nada estimável', () => {
    expect(composicaoRelativa({ proteina: 0, carboidrato: 0, gorduraTotal: 0 })).toEqual({
      proteina: 0,
      carboidrato: 0,
      gorduraTotal: 0,
    });
  });
});

describe('DIETAS', () => {
  it('todas as dietas trazem só percentuais relativos, somando 100', () => {
    for (const d of DIETA_ORDEM) {
      const { proteina, carboidrato, gorduraTotal } = DIETAS[d];
      expect(proteina + carboidrato + gorduraTotal).toBe(100);
    }
  });
});

describe('barrasComposicao', () => {
  it('põe o percentual atual de cada macro ao lado da meta da dieta, na ordem carb/prot/gord', () => {
    const real = { proteina: 30, carboidrato: 50, gorduraTotal: 20 };
    const barras = barrasComposicao(real, 'normal');
    const pct = composicaoRelativa(real);
    expect(barras.map((b) => b.chave)).toEqual(['carboidrato', 'proteina', 'gorduraTotal']);
    expect(barras[0]).toMatchObject({ atual: pct.carboidrato, meta: DIETAS.normal.carboidrato });
    expect(barras[1]).toMatchObject({ atual: pct.proteina, meta: DIETAS.normal.proteina });
    expect(barras[2]).toMatchObject({ atual: pct.gorduraTotal, meta: DIETAS.normal.gorduraTotal });
  });

  it('sem dados, as barras ficam zeradas mas a meta continua visível', () => {
    const barras = barrasComposicao({ proteina: 0, carboidrato: 0, gorduraTotal: 0 }, 'cutting');
    expect(barras.every((b) => b.atual === 0)).toBe(true);
    expect(barras[1].meta).toBe(DIETAS.cutting.proteina);
  });
});
