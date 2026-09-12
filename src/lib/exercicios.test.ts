import { describe, expect, it } from 'vitest';
import { kcalQueimadaNoDia, kcalQueimadaPorDia } from './exercicios';
import type { RegistroExercicio } from '../types';

const reg = (dia: string, kcal: number, nome = 'corrida'): RegistroExercicio => ({
  id: `${dia}-${nome}-${kcal}`,
  dia,
  nome,
  kcal,
  criadoEm: 0,
});

describe('kcalQueimadaNoDia', () => {
  it('soma só os exercícios do dia pedido', () => {
    const regs = [reg('2026-09-12', 300), reg('2026-09-12', 120, 'caminhada'), reg('2026-09-11', 500)];
    expect(kcalQueimadaNoDia(regs, '2026-09-12')).toBe(420);
    expect(kcalQueimadaNoDia(regs, '2026-09-10')).toBe(0);
  });
});

describe('kcalQueimadaPorDia', () => {
  it('indexa por dia para o gráfico da semana', () => {
    const mapa = kcalQueimadaPorDia([reg('2026-09-12', 300), reg('2026-09-12', 100)]);
    expect(mapa.get('2026-09-12')).toBe(400);
    expect(mapa.get('2026-09-11')).toBeUndefined();
  });
});
