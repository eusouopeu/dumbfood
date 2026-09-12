import { describe, expect, it } from 'vitest';
import { avaliarAlimento } from './rating';
import type { Nutrientes100g } from './nutrition';

function n(v: Partial<Nutrientes100g>): Nutrientes100g {
  return {
    kcal: 0,
    gorduraTotal: 0,
    gorduraSaturada: 0,
    colesterolMg: 0,
    carboidrato: 0,
    acucares: 0,
    proteina: 0,
    fibra: 0,
    ...v,
  };
}

describe('avaliarAlimento', () => {
  it('marca chocolate como denso, açucarado e com gordura saturada alta', () => {
    const r = avaliarAlimento(n({ kcal: 540, acucares: 51, gorduraSaturada: 18, gorduraTotal: 30, fibra: 3 }), { sodio: 20 });
    const negativos = r.negativos.map((s) => s.chave);
    expect(negativos).toContain('acucar');
    expect(negativos).toContain('calorico');
    expect(negativos).toContain('gordura_saturada');
    expect(r.positivos.map((s) => s.chave)).toContain('pouco_sodio');
    expect(r.nota).toBe('ruim');
  });

  it('marca feijão como bom: fibra e proteína altas, sem excessos', () => {
    const r = avaliarAlimento(n({ kcal: 76, carboidrato: 13.6, acucares: 0.3, proteina: 4.8, fibra: 8.5 }), { sodio: 2 });
    expect(r.positivos.map((s) => s.chave)).toContain('fibra');
    expect(r.negativos).toHaveLength(0);
    expect(r.nota).toBe('bom');
  });

  it('acusa sódio alto quando o micronutriente é informado', () => {
    const r = avaliarAlimento(n({ kcal: 120, proteina: 12 }), { sodio: 900 });
    expect(r.negativos.map((s) => s.chave)).toContain('sodio');
    expect(r.nota).toBe('moderado');
  });
});
