import { describe, expect, it } from 'vitest';
import { estaAcabando, itensAcabando } from './despensaAcabando';
import type { GeladeiraItem } from '../types';

const item = (nome: string, quantidade?: number, unidade?: string | null): GeladeiraItem => ({
  itemKey: nome,
  nome,
  adicionadoEm: 0,
  ...(quantidade !== undefined ? { quantidade, unidade } : {}),
});

describe('estaAcabando', () => {
  it('usa um quarto da menor embalagem', () => {
    expect(estaAcabando(item('arroz', 200, 'g'))).toBe(true); // 1 kg → 250 g
    expect(estaAcabando(item('arroz', 0.4, 'kg'))).toBe(false);
    expect(estaAcabando(item('leite', 200, 'ml'))).toBe(true); // 1 L → 250 ml
  });

  it('piso para granel e contagem', () => {
    expect(estaAcabando(item('tomate', 80, 'g'))).toBe(true);
    expect(estaAcabando(item('tomate', 300, 'g'))).toBe(false);
    expect(estaAcabando(item('ovo', 1, null))).toBe(true);
    expect(estaAcabando(item('ovo', 6, 'unidade'))).toBe(false);
  });

  it('sem quantidade não é acabando', () => {
    expect(estaAcabando(item('sal'))).toBe(false);
    expect(itensAcabando([item('sal'), item('ovo', 1, null), item('arroz', 100, 'g')])).toEqual(['ovo', 'arroz']);
  });
});
