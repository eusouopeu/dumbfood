import { describe, expect, it } from 'vitest';
import { pacoteParaNexo } from './compartilharNexo';
import type { RegistroConsumo } from '../types';

const nut = { kcal: 300, proteina: 0, carboidrato: 0, gordura: 0 } as unknown as RegistroConsumo['nutrientes'];
const ms = (dia: string, h: number, m = 0) => {
  const [a, me, d] = dia.split('-').map(Number);
  return new Date(a, me - 1, d, h, m).getTime();
};

describe('pacoteParaNexo', () => {
  it('manda os últimos dias, com horário, rótulo da refeição e ingredientes da receita', () => {
    const consumo: RegistroConsumo[] = [
      { id: 'a', dia: '2026-10-10', refeicao: 'almoco', nome: 'Strogonoff', recipeId: 'r1', porcoes: 1.5, nutrientes: nut, criadoEm: ms('2026-10-10', 12, 40) },
      // lançado hoje para ontem: usa o horário típico da refeição
      { id: 'b', dia: '2026-10-09', refeicao: 'cafe', nome: 'Pão com manteiga', porcoes: 1, nutrientes: nut, criadoEm: ms('2026-10-10', 9) },
      { id: 'velho', dia: '2026-09-01', refeicao: 'jantar', nome: 'Sopa', porcoes: 1, nutrientes: nut, criadoEm: ms('2026-09-01', 20) },
    ];
    const receitas = [{ id: 'r1', ingredientes: [{ item: 'creme de leite' }, { item: 'frango' }, { item: 'creme de leite' }, { item: '' }] }];
    const p = pacoteParaNexo(consumo, receitas, { almoco: 'Almoço', cafe: 'Café' }, '2026-10-10', 14);
    expect(p).toMatchObject({ app: 'dumbfood', versao: 1, de: '2026-09-27', ate: '2026-10-10' });
    expect(p.itens.map((i) => i.id)).toEqual(['b', 'a']);
    expect(p.itens[1]).toEqual({
      id: 'a', dia: '2026-10-10', hora: ms('2026-10-10', 12, 40), refeicao: 'Almoço', nome: 'Strogonoff',
      porcoes: 1.5, kcal: 300, ingredientes: ['creme de leite', 'frango'],
    });
    expect(p.itens[0]).toMatchObject({ hora: ms('2026-10-09', 8), refeicao: 'Café', ingredientes: [] });
  });
});
