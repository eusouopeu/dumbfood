import { describe, expect, it } from 'vitest';
import { agendamentosDoItem, agruparPorDia, ordenarAgendamentos, receitasDoDia, rotuloAgendamento } from './agenda';
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

describe('agendamentos múltiplos', () => {
  // A panelada de domingo que também é o almoço de segunda e o jantar de quarta.
  const panelada: PlanItem[] = [
    {
      recipeId: 'a',
      fator: 2,
      agendamentos: [
        { dia: 1, refeicao: 'almoco' },
        { dia: 3, refeicao: 'jantar' },
      ],
    },
    { recipeId: 'b', fator: 1, agendamentos: [{ dia: 1, refeicao: 'almoco' }] },
  ];

  it('põe a mesma receita em todos os dias agendados', () => {
    const { dias } = agruparPorDia(panelada, recipes, 1);
    expect(dias[0].dia).toBe(1);
    expect(dias[0].itens.map((i) => i.recipe.titulo)).toEqual(['lasanha', 'omelete']);
    expect(dias[2].itens.map((i) => i.recipe.titulo)).toEqual(['lasanha']);
  });

  it('aceita mais de uma receita na mesma refeição', () => {
    const almocoDeSegunda = receitasDoDia(panelada, recipes, 1).filter((i) => i.refeicao === 'almoco');
    expect(almocoDeSegunda).toHaveLength(2);
  });

  it('informa em quantos lugares a receita foi agendada, para ratear a receita entre eles', () => {
    const { dias } = agruparPorDia(panelada, recipes, 1);
    expect(dias[0].itens.find((i) => i.recipe.id === 'a')!.vezesNaSemana).toBe(2);
    expect(dias[0].itens.find((i) => i.recipe.id === 'b')!.vezesNaSemana).toBe(1);
  });

  it('lê o formato antigo (um dia/refeição soltos no item)', () => {
    expect(agendamentosDoItem({ recipeId: 'a', fator: 1, dia: 3, refeicao: 'jantar' })).toEqual([
      { dia: 3, refeicao: 'jantar' },
    ]);
    expect(agendamentosDoItem({ recipeId: 'a', fator: 1 })).toEqual([]);
  });

  it('ordena e rotula os agendamentos como a semana acontece', () => {
    const ordenados = ordenarAgendamentos([
      { dia: 3, refeicao: 'jantar' },
      { dia: 1, refeicao: 'almoco' },
      { dia: 1, refeicao: 'cafe' },
    ]);
    expect(ordenados.map(rotuloAgendamento)).toEqual(['Seg · Café', 'Seg · Almoço', 'Qua · Jantar']);
  });
});
