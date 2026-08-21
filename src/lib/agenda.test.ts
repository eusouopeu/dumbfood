import { describe, expect, it } from 'vitest';
import { agruparPorDia, receitasDoDia } from './agenda';
import type { PlanItem, Recipe } from '../types';

function receita(id: string, titulo: string): Recipe {
  return {
    id,
    titulo,
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    ingredientes: [],
    modoPreparo: [],
    tags: [],
    criadoEm: 0,
  };
}

const recipes = new Map([
  ['a', receita('a', 'lasanha')],
  ['b', receita('b', 'omelete')],
  ['c', receita('c', 'sopa')],
]);

const itens: PlanItem[] = [
  { recipeId: 'a', fator: 1, dia: 3, refeicao: 'jantar' },
  { recipeId: 'b', fator: 1, dia: 3, refeicao: 'cafe' },
  { recipeId: 'c', fator: 1 },
];

describe('agruparPorDia', () => {
  it('começa a semana no dia de hoje', () => {
    const { dias } = agruparPorDia(itens, recipes, 5);
    expect(dias.map((d) => d.dia)).toEqual([5, 6, 0, 1, 2, 3, 4]);
  });

  it('ordena as receitas do dia pela ordem das refeições', () => {
    const { dias } = agruparPorDia(itens, recipes, 3);
    expect(dias[0].itens.map((i) => i.recipe.titulo)).toEqual(['omelete', 'lasanha']);
  });

  it('separa quem não tem dia definido', () => {
    const { semDia } = agruparPorDia(itens, recipes, 0);
    expect(semDia.map((i) => i.recipe.titulo)).toEqual(['sopa']);
  });

  it('ignora itens de receitas que não existem mais', () => {
    const { dias, semDia } = agruparPorDia([{ recipeId: 'sumida', fator: 1, dia: 2 }], recipes, 2);
    expect(dias[0].itens).toEqual([]);
    expect(semDia).toEqual([]);
  });
});

describe('receitasDoDia', () => {
  it('devolve só o que está agendado naquele dia', () => {
    expect(receitasDoDia(itens, recipes, 3).map((i) => i.recipe.id)).toEqual(['b', 'a']);
    expect(receitasDoDia(itens, recipes, 1)).toEqual([]);
  });
});
