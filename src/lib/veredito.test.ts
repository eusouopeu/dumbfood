import { describe, expect, it } from 'vitest';
import { vereditoProduto } from './veredito';
import { metaFibra } from './metas';
import type { Nutrientes100g } from './nutrition';

const biscoito: Nutrientes100g = {
  kcal: 480,
  gorduraTotal: 20,
  gorduraSaturada: 9,
  colesterolMg: 0,
  carboidrato: 68,
  acucares: 30,
  proteina: 6,
  fibra: 2,
};
const meta = { gramas: { carboidrato: 250, proteina: 100, gorduraTotal: 60 }, fibra: 28 };

describe('vereditoProduto', () => {
  it('converte para a porção do rótulo', () => {
    const v = vereditoProduto(biscoito, 30, meta);
    expect(v.porcaoG).toBe(30);
    expect(v.kcal).toBeCloseTo(144);
    const gordura = v.aneis.find((a) => a.chave === 'gorduraTotal')!;
    expect(gordura.gramas).toBeCloseTo(6);
    expect(gordura.fracao).toBeCloseTo(0.1);
  });
  it('sem porção usa 100 g', () => {
    expect(vereditoProduto(biscoito, undefined, meta).porcaoG).toBe(100);
  });
  it('tem os quatro anéis na ordem e a fibra contra a meta de fibra', () => {
    const v = vereditoProduto(biscoito, 100, meta);
    expect(v.aneis.map((a) => a.chave)).toEqual(['gorduraTotal', 'proteina', 'carboidrato', 'fibra']);
    expect(v.aneis[3].fracao).toBeCloseTo(2 / 28);
  });
  it('meta zero não divide por zero', () => {
    const v = vereditoProduto(biscoito, 100, { gramas: { carboidrato: 0, proteina: 0, gorduraTotal: 0 }, fibra: 0 });
    expect(v.aneis.every((a) => a.fracao === 0)).toBe(true);
  });
});

describe('metaFibra', () => {
  it('14 g a cada 1.000 kcal', () => {
    expect(metaFibra(2000)).toBe(28);
    expect(metaFibra(1500)).toBe(21);
  });
});
