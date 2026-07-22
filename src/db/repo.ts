// Operações de alto nível sobre o banco.

import type { NewRecipe, Recipe, WeekPlan, YieldType } from '../types';
import { db, PLANO_ATUAL_ID, getOrCreatePlanoAtual } from './db';
import { scaleIngredients } from '../lib/scale';
import { mesclarTags } from '../lib/tags';

function novoId(): string {
  return (
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export async function salvarReceita(nova: NewRecipe): Promise<Recipe> {
  const recipe: Recipe = { ...nova, id: novoId(), criadoEm: Date.now() };
  await db.recipes.put(recipe);
  return recipe;
}

export async function atualizarReceita(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe);
}

/**
 * Redefine o rendimento padrão da receita: reescala os ingredientes armazenados
 * e passa a usar o novo valor/tipo como base dali em diante.
 */
export async function redefinirRendimentoPadrao(
  recipe: Recipe,
  alvoValor: number,
  alvoTipo?: YieldType,
): Promise<Recipe> {
  const base = recipe.rendimentoBase;
  const fator = base.valor > 0 ? alvoValor / base.valor : 1;
  const atualizada: Recipe = {
    ...recipe,
    ingredientes: scaleIngredients(recipe.ingredientes, fator),
    rendimentoBase: { valor: alvoValor, tipo: alvoTipo ?? base.tipo },
  };
  await db.recipes.put(atualizada);
  return atualizada;
}

/** Substitui as tags da receita. */
export async function definirTags(recipe: Recipe, tags: string[]): Promise<void> {
  await db.recipes.put({ ...recipe, tags });
}

/** Adiciona tags novas (sem duplicar) à receita. */
export async function adicionarTags(recipe: Recipe, novas: string[]): Promise<void> {
  await db.recipes.put({ ...recipe, tags: mesclarTags(recipe.tags ?? [], novas) });
}

export async function removerReceita(id: string): Promise<void> {
  await db.recipes.delete(id);
  const plano = await getOrCreatePlanoAtual();
  const itens = plano.itens.filter((i) => i.recipeId !== id);
  await db.plans.put({ ...plano, itens });
}

export async function definirNoPlano(recipeId: string, fator: number): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  const idx = plano.itens.findIndex((i) => i.recipeId === recipeId);
  const itens = [...plano.itens];
  if (idx >= 0) itens[idx] = { recipeId, fator };
  else itens.push({ recipeId, fator });
  await db.plans.put({ ...plano, itens });
}

export async function removerDoPlano(recipeId: string): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  await db.plans.put({ ...plano, itens: plano.itens.filter((i) => i.recipeId !== recipeId) });
}

export async function limparPlano(): Promise<void> {
  await db.plans.put({ id: PLANO_ATUAL_ID, itens: [] });
}

// ---- Backup ----

interface BackupData {
  version: 1;
  exportadoEm: string;
  recipes: Recipe[];
  plans: WeekPlan[];
}

export async function exportarJSON(): Promise<string> {
  const [recipes, plans] = await Promise.all([db.recipes.toArray(), db.plans.toArray()]);
  const data: BackupData = {
    version: 1,
    exportadoEm: new Date().toISOString(),
    recipes,
    plans,
  };
  return JSON.stringify(data, null, 2);
}

export async function importarJSON(json: string): Promise<{ recipes: number }> {
  const data = JSON.parse(json) as Partial<BackupData>;
  if (!Array.isArray(data.recipes)) throw new Error('Arquivo de backup inválido.');
  await db.transaction('rw', db.recipes, db.plans, async () => {
    await db.recipes.bulkPut(data.recipes as Recipe[]);
    if (Array.isArray(data.plans)) await db.plans.bulkPut(data.plans);
  });
  return { recipes: data.recipes.length };
}
