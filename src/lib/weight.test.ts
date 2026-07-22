import { describe, it, expect } from 'vitest';
import { pesoEmGramas } from './weight';

describe('pesoEmGramas', () => {
  it('massa: converte kg para g', () => {
    expect(pesoEmGramas('tomate', 1.5, 'kg')).toBe(1500);
  });

  it('volume: aplica densidade conhecida do item (leite ~1,03 g/ml)', () => {
    expect(pesoEmGramas('leite', 200, 'ml')).toBe(206);
  });

  it('volume: aplica densidade de item não líquido (óleo)', () => {
    expect(pesoEmGramas('oleo de soja', 100, 'ml')).toBe(92);
  });

  it('cozinha: converte xícara de farinha via densidade', () => {
    // 1 xícara = 240 ml * 0.5 (densidade farinha) = 120 g
    expect(pesoEmGramas('farinha de trigo', 1, 'xicara')).toBe(120);
  });

  it('cozinha sem densidade conhecida (pitada) retorna null', () => {
    expect(pesoEmGramas('sal', 1, 'pitada')).toBeNull();
  });

  it('contagem sem unidade explícita usa peso médio conhecido (ovo)', () => {
    expect(pesoEmGramas('ovos', 3, null)).toBe(150);
  });

  it('contagem sem peso médio conhecido retorna null', () => {
    expect(pesoEmGramas('item misterioso', 3, null)).toBeNull();
  });

  it('embalagens (lata, dente) sem peso padrão retornam null', () => {
    expect(pesoEmGramas('milho', 1, 'lata')).toBeNull();
  });
});
