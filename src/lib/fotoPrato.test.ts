import { describe, expect, it } from 'vitest';
import { ajustarGramas, dimensoesReduzidas, limparItens, nutrientesDoItem, totalDosItens, type ItemFoto } from './fotoPrato';

const arroz: ItemFoto = { nome: 'arroz', gramas: 150, kcal: 192, proteina: 3.8, carboidrato: 42, gorduraTotal: 0.3, fibra: 2.4 };
const frango: ItemFoto = { nome: 'frango', gramas: 100, kcal: 160, proteina: 32, carboidrato: 0, gorduraTotal: 2.5, fibra: 0 };

describe('dimensoesReduzidas', () => {
  it('reduz pelo lado maior mantendo a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1024, altura: 768 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 768, altura: 1024 });
  });
  it('não amplia imagem pequena', () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe('ajustarGramas', () => {
  it('leva kcal e macros na proporção das gramas', () => {
    const r = ajustarGramas(arroz, 300);
    expect(r.gramas).toBe(300);
    expect(r.kcal).toBeCloseTo(384);
    expect(r.carboidrato).toBeCloseTo(84);
    expect(r.fibra).toBeCloseTo(4.8);
  });
  it('zera tudo com zero gramas e não aceita negativo', () => {
    expect(ajustarGramas(arroz, -10).kcal).toBe(0);
  });
});

describe('totalDosItens', () => {
  it('soma os itens', () => {
    const t = totalDosItens([arroz, frango]);
    expect(t.gramas).toBe(250);
    expect(t.kcal).toBe(352);
    expect(t.proteina).toBeCloseTo(35.8);
  });
  it('lista vazia dá zero', () => {
    expect(totalDosItens([]).kcal).toBe(0);
  });
});

describe('limparItens', () => {
  it('descarta sem nome ou sem gramas e zera inválidos', () => {
    const r = limparItens([
      { nome: '  feijão ', gramas: 80, kcal: NaN, proteina: -1 },
      { nome: '', gramas: 50 },
      { nome: 'salada', gramas: 0 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: 'feijão', gramas: 80, kcal: 0, proteina: 0 });
  });
});

describe('nutrientesDoItem', () => {
  it('converte para o formato do consumo, com o que a foto não estima em zero', () => {
    const n = nutrientesDoItem(frango);
    expect(n).toMatchObject({ kcal: 160, proteina: 32, gorduraTotal: 2.5, acucares: 0, gorduraSaturada: 0 });
  });
});
