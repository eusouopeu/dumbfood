import { describe, it, expect } from 'vitest';
import { padronizarMedida } from './measures';

describe('padronizarMedida', () => {
  it('converte xícara de farinha para gramas (métrico)', () => {
    // 1 xícara (240ml) * densidade farinha 0.5 = 120 g
    const m = padronizarMedida('farinha de trigo', 1, 'xicara', 'metrico');
    expect(m.unidade).toBe('g');
    expect(m.quantidade).toBe(120);
  });

  it('converte xícara de leite para ml (métrico, líquido)', () => {
    const m = padronizarMedida('leite', 1, 'xicara', 'metrico');
    expect(m.unidade).toBe('ml');
    expect(m.quantidade).toBe(240);
  });

  it('não converte itens de contagem (ovos)', () => {
    const m = padronizarMedida('ovos', 3, null, 'metrico');
    expect(m).toEqual({ quantidade: 3, unidade: null });
  });

  it('não converte dentes de alho', () => {
    const m = padronizarMedida('alho', 3, 'dente', 'metrico');
    expect(m).toEqual({ quantidade: 3, unidade: 'dente' });
  });

  it('converte gramas de farinha para xícaras (recipiente)', () => {
    // 120 g / 0.5 = 240 ml -> 1 xícara
    const m = padronizarMedida('farinha de trigo', 120, 'g', 'recipiente');
    expect(m.unidade).toBe('xicara');
    expect(m.quantidade).toBe(1);
  });

  it('modo original não altera', () => {
    const m = padronizarMedida('farinha', 2, 'xicara', 'original');
    expect(m).toEqual({ quantidade: 2, unidade: 'xicara' });
  });
});
