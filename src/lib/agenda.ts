// Agenda da semana: distribui as receitas do plano em dias e refeições.
// O plano continua sendo a lista de receitas a fazer (é dele que sai a lista de mercado);
// o agendamento é uma camada em cima, opcional — receita sem dia continua valendo.
//
// Uma receita pode ocupar vários lugares da semana (a panelada de segunda que também é o
// almoço de quinta) e um mesmo lugar pode ter várias receitas (arroz + feijão + salada).
// Daí o plano guardar uma *lista* de agendamentos por receita.

import type { Agendamento, PlanItem, Recipe, Refeicao } from '../types';

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
  /** Refeição deste agendamento; ausente quando só o dia foi marcado. */
  refeicao?: Refeicao;
  /** Em quantos lugares da semana esta receita foi agendada (1 quando é só aqui). */
  vezesNaSemana: number;
}

/** true quando os dois agendamentos apontam para o mesmo lugar da semana. */
export function mesmoAgendamento(a: Agendamento, b: Agendamento): boolean {
  return a.dia === b.dia && (a.refeicao ?? null) === (b.refeicao ?? null);
}

/**
 * Agendamentos de um item do plano, já normalizados. Aceita o formato antigo
 * (um `dia`/`refeicao` soltos no item) para não quebrar planos e backups anteriores
 * à migração.
 */
export function agendamentosDoItem(item: PlanItem): Agendamento[] {
  if (item.agendamentos && item.agendamentos.length > 0) {
    return item.agendamentos.filter((a) => a.dia >= 0 && a.dia <= 6);
  }
  if (item.dia !== undefined && item.dia >= 0 && item.dia <= 6) {
    return [{ dia: item.dia, ...(item.refeicao ? { refeicao: item.refeicao } : {}) }];
  }
  return [];
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
    const agendamentos = agendamentosDoItem(item);
    if (agendamentos.length === 0) {
      semDia.push({ item, recipe, vezesNaSemana: 0 });
      continue;
    }
    // Uma entrada por lugar da semana: a mesma receita aparece em cada dia agendado.
    for (const a of agendamentos) {
      const arr = porDia.get(a.dia) ?? [];
      arr.push({ item, recipe, refeicao: a.refeicao, vezesNaSemana: agendamentos.length });
      porDia.set(a.dia, arr);
    }
  }

  const ordenar = (a: ItemAgendado, b: ItemAgendado) =>
    (a.refeicao ? ORDEM_REFEICAO[a.refeicao] : 99) - (b.refeicao ? ORDEM_REFEICAO[b.refeicao] : 99) ||
    a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR');

  const dias: DiaAgendado[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = (hoje + i) % 7;
    const itensDoDia = (porDia.get(dia) ?? []).sort(ordenar);
    dias.push({ dia, nome: DIAS_SEMANA[dia], itens: itensDoDia });
  }
  return { dias, semDia: semDia.sort((a, b) => a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR')) };
}

/**
 * Ordena os agendamentos de uma receita como a semana acontece, para listar os chips
 * na tela na mesma ordem em que eles vão ser comidos.
 */
export function ordenarAgendamentos(agendamentos: Agendamento[]): Agendamento[] {
  return [...agendamentos].sort(
    (a, b) =>
      a.dia - b.dia ||
      (a.refeicao ? ORDEM_REFEICAO[a.refeicao] : 99) - (b.refeicao ? ORDEM_REFEICAO[b.refeicao] : 99),
  );
}

/** Rótulo curto de um agendamento, para os chips: "Seg · Almoço". */
export function rotuloAgendamento(a: Agendamento): string {
  const refeicao = rotuloRefeicao(a.refeicao);
  return refeicao ? `${DIAS_CURTOS[a.dia]} · ${refeicao}` : DIAS_CURTOS[a.dia];
}

/** Receitas agendadas para um dia específico (usado para "o que se come hoje"). */
export function receitasDoDia(itens: PlanItem[], recipes: Map<string, Recipe>, dia: number): ItemAgendado[] {
  return agruparPorDia(itens, recipes, dia).dias[0].itens;
}
