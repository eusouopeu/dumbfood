// Operações de alto nível sobre o banco.

import type { NewRecipe, Recipe, WeekPlan } from '../types';
import { db, PLANO_ATUAL_ID, getOrCreatePlanoAtual } from './db';

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
