import { describe, it, expect } from 'vitest';
import { prazoPadraoDias, validadeSugerida } from './prazos';

describe('prazoPadraoDias', () => {
  it('dá prazos curtos para perecível e longos para despensa', () => {
    expect(prazoPadraoDias('alface americana')).toBe(4);
    expect(prazoPadraoDias('peito de frango')).toBe(3);
    expect(prazoPadraoDias('arroz')).toBe(180);
  });

  it('cai na gôndola quando o item específico não está na tabela', () => {
    // Não há entrada para "quiabo": vale o prazo do hortifruti.
    expect(prazoPadraoDias('quiabo')).toBe(7);
  });

  it('devolve undefined quando não dá para arriscar palpite', () => {
    expect(prazoPadraoDias('')).toBeUndefined();
  });
});

describe('validadeSugerida', () => {
  it('soma o prazo à data de hoje, no formato do campo de data', () => {
    const hoje = new Date('2026-03-10T12:00:00').getTime();
    expect(validadeSugerida('alface', hoje)).toBe('2026-03-14');
  });

  it('devolve vazio para item sem prazo conhecido', () => {
    expect(validadeSugerida('', Date.now())).toBe('');
  });
});
