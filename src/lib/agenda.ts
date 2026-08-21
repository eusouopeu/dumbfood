// Agenda da semana: distribui as receitas do plano em dias e refeições.
// O plano continua sendo a lista de receitas a fazer (é dele que sai a lista de mercado);
// o dia/refeição é uma camada em cima, opcional — receita sem dia continua valendo.

import type { PlanItem, Recipe, Refeicao } from '../types';

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const REFEICOES: { chave: Refeicao; label: string }[] = [
  { chave: 'cafe', label: 'Café' },
  { chave: 'almoco', label: 'Almoço' },
  { chave: 'lanche', label: 'Lanche' },
  { chave: 'jantar', label: 'Jantar' },
];

const ORDEM_REFEICAO: Record<Refeicao, number> = { cafe: 0, almoco: 1, lanche: 2, jantar: 3 };

export function rotuloRefeicao(refeicao: Refeicao | undefined): string {
  return REFEICOES.find((r) => r.chave === refeicao)?.label ?? '';
}

export interface ItemAgendado {
  item: PlanItem;
  recipe: Recipe;
}

export interface DiaAgendado {
  /** 0 = domingo .. 6 = sábado. */
  dia: number;
  nome: string;
  itens: ItemAgendado[];
}

/**
 * Agrupa o plano por dia da semana, na ordem em que a semana acontece a partir de
 * `hoje` — o dia atual primeiro, para a agenda abrir no que interessa agora.
 * As receitas sem dia definido saem separadas em `semDia`.
 */
export function agruparPorDia(
  itens: PlanItem[],
  recipes: Map<string, Recipe>,
  hoje: number,
): { dias: DiaAgendado[]; semDia: ItemAgendado[] } {
  const porDia = new Map<number, ItemAgendado[]>();
  const semDia: ItemAgendado[] = [];

  for (const item of itens) {
    const recipe = recipes.get(item.recipeId);
    if (!recipe) continue;
    if (item.dia === undefined || item.dia < 0 || item.dia > 6) {
      semDia.push({ item, recipe });
      continue;
    }
    const arr = porDia.get(item.dia) ?? [];
    arr.push({ item, recipe });
    porDia.set(item.dia, arr);
  }

  const ordenar = (a: ItemAgendado, b: ItemAgendado) =>
    (a.item.refeicao ? ORDEM_REFEICAO[a.item.refeicao] : 99) - (b.item.refeicao ? ORDEM_REFEICAO[b.item.refeicao] : 99) ||
    a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR');

  const dias: DiaAgendado[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = (hoje + i) % 7;
    const itensDoDia = (porDia.get(dia) ?? []).sort(ordenar);
    dias.push({ dia, nome: DIAS_SEMANA[dia], itens: itensDoDia });
  }
  return { dias, semDia: semDia.sort((a, b) => a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR')) };
}

/** Receitas agendadas para um dia específico (usado para "o que se come hoje"). */
export function receitasDoDia(itens: PlanItem[], recipes: Map<string, Recipe>, dia: number): ItemAgendado[] {
  return agruparPorDia(itens, recipes, dia).dias[0].itens;
}
