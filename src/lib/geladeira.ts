// Casamento entre os ingredientes que o usuário tem na geladeira e os das receitas
// da biblioteca, para responder "o que dá pra fazer com o que eu tenho?".

import type { GeladeiraItem, Ingredient, Recipe } from '../types';
import { normalizeItemKey } from './ingredientParser';

/**
 * Palavras que, quando aparecem *a mais* em um dos nomes, indicam um produto
 * diferente e não uma variação do mesmo: "leite" não é "leite condensado",
 * "tomate" não é "molho de tomate". As preposições cobrem a maioria dos casos
 * ("de coco", "em pó", "para bolo").
 */
const QUALIFICADORES_FORTES = new Set([
  'de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'em', 'para', 'ao', 'a',
  'condensado', 'condensada', 'po',
]);

function tokens(key: string): string[] {
  return key.split(/\s+/).filter(Boolean);
}

/** true quando `curto` é prefixo de palavras de `longo` sem qualificador forte sobrando. */
function prefixoCompativel(curto: string[], longo: string[]): boolean {
  if (curto.length > longo.length) return false;
  for (let i = 0; i < curto.length; i++) if (curto[i] !== longo[i]) return false;
  return longo.slice(curto.length).every((t) => !QUALIFICADORES_FORTES.has(t));
}

/**
 * Um ingrediente da geladeira atende um ingrediente da receita quando os nomes
 * canônicos são iguais ou quando um é uma especialização direta do outro
 * ("tomate" ↔ "tomate italiano"). Ter o específico atende o genérico e vice-versa.
 */
export function ingredienteAtendido(geladeiraKey: string, ingredienteKey: string): boolean {
  const g = tokens(geladeiraKey);
  const i = tokens(ingredienteKey);
  if (g.length === 0 || i.length === 0) return false;
  return g.length <= i.length ? prefixoCompativel(g, i) : prefixoCompativel(i, g);
}

export interface ReceitaCombinada {
  recipe: Recipe;
  /** Ingredientes da receita cobertos pela geladeira. */
  tem: Ingredient[];
  /** Ingredientes que ainda faltam comprar. */
  falta: Ingredient[];
  /** Chaves da geladeira efetivamente usadas por esta receita. */
  usados: string[];
  /** Ingredientes distintos da receita (tem + falta); pode ser menor que `ingredientes.length`. */
  total: number;
  /** Fração de ingredientes da receita já coberta (0 a 1). */
  cobertura: number;
}

/** Deduplica ingredientes por nome canônico, preservando a ordem da receita. */
function ingredientesUnicos(ingredientes: Ingredient[]): Ingredient[] {
  const vistos = new Set<string>();
  const out: Ingredient[] = [];
  for (const ing of ingredientes) {
    const key = normalizeItemKey(ing.item);
    if (!key || vistos.has(key)) continue;
    vistos.add(key);
    out.push(ing);
  }
  return out;
}

/** Cruza uma receita com a geladeira, separando o que já tem do que falta. */
export function combinarReceita(recipe: Recipe, geladeira: GeladeiraItem[]): ReceitaCombinada {
  const ingredientes = ingredientesUnicos(recipe.ingredientes ?? []);
  const tem: Ingredient[] = [];
  const falta: Ingredient[] = [];
  const usados = new Set<string>();

  for (const ing of ingredientes) {
    const key = normalizeItemKey(ing.item);
    const casados = geladeira.filter((g) => ingredienteAtendido(g.itemKey, key));
    if (casados.length > 0) {
      tem.push(ing);
      for (const g of casados) usados.add(g.itemKey);
    } else {
      falta.push(ing);
    }
  }

  return {
    recipe,
    tem,
    falta,
    usados: Array.from(usados),
    total: ingredientes.length,
    cobertura: ingredientes.length > 0 ? tem.length / ingredientes.length : 0,
  };
}

/**
 * Ordena as receitas pelo que melhor aproveita a geladeira: primeiro as que usam
 * mais ingredientes que o usuário já tem, desempatando por quantas compras ainda
 * faltam e depois pela cobertura relativa (receita curta ganha da longa).
 */
export function combinarReceitas(recipes: Recipe[], geladeira: GeladeiraItem[]): ReceitaCombinada[] {
  return recipes
    .map((r) => combinarReceita(r, geladeira))
    .sort(
      (a, b) =>
        b.tem.length - a.tem.length ||
        a.falta.length - b.falta.length ||
        b.cobertura - a.cobertura ||
        a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR'),
    );
}

/**
 * Ingredientes mais frequentes na biblioteca, para sugerir na hora de montar a
 * geladeira. Já exclui o que o usuário adicionou.
 */
export function sugestoesDeIngredientes(
  recipes: Recipe[],
  geladeira: GeladeiraItem[],
  limite = 12,
): { nome: string; itemKey: string; usos: number }[] {
  const contagem = new Map<string, { nome: string; usos: number }>();
  for (const r of recipes) {
    for (const ing of ingredientesUnicos(r.ingredientes ?? [])) {
      const key = normalizeItemKey(ing.item);
      if (!key) continue;
      const atual = contagem.get(key);
      if (atual) atual.usos += 1;
      else contagem.set(key, { nome: ing.item, usos: 1 });
    }
  }
  return Array.from(contagem.entries())
    .filter(([key]) => !geladeira.some((g) => ingredienteAtendido(g.itemKey, key)))
    .map(([itemKey, { nome, usos }]) => ({ itemKey, nome, usos }))
    .sort((a, b) => b.usos - a.usos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
}

/**
 * Receitas que aproveitam o que está para vencer, mais urgente primeiro. É a ponte
 * entre o aviso de validade ("3 itens vencendo") e a decisão que ele deveria provocar
 * ("faça isto hoje"): sem ela o aviso só informa que a comida vai estragar.
 *
 * `statusDoItem` recebe a validade e diz se o item está na janela de risco — injetado
 * para o módulo continuar puro (sem depender do relógio) e testável.
 */
export interface ReceitaUrgente {
  recipe: Recipe;
  /** Itens da geladeira vencendo que esta receita usa, do mais urgente ao menos. */
  vencendo: GeladeiraItem[];
  /** Ingredientes que ainda faltam comprar. */
  falta: Ingredient[];
}

export function receitasParaAproveitar(
  recipes: Recipe[],
  geladeira: GeladeiraItem[],
  emRisco: (item: GeladeiraItem) => boolean,
  limite = 3,
): ReceitaUrgente[] {
  const criticos = geladeira.filter((g) => g.validade != null && emRisco(g));
  if (criticos.length === 0) return [];

  return recipes
    .map((recipe) => {
      const { usados, falta } = combinarReceita(recipe, geladeira);
      const vencendo = criticos
        .filter((g) => usados.includes(g.itemKey))
        .sort((a, b) => (a.validade ?? 0) - (b.validade ?? 0));
      return { recipe, vencendo, falta };
    })
    .filter((r) => r.vencendo.length > 0)
    // Mais itens salvos primeiro; empate vai para a que exige menos compras e vence antes.
    .sort(
      (a, b) =>
        b.vencendo.length - a.vencendo.length ||
        a.falta.length - b.falta.length ||
        (a.vencendo[0].validade ?? 0) - (b.vencendo[0].validade ?? 0),
    )
    .slice(0, limite);
}
