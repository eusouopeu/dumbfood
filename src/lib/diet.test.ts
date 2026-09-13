import { describe, it, expect } from 'vitest';
import { composicaoRelativa, DIETAS, DIETA_ORDEM } from './diet';

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
