// Banco local (IndexedDB) via Dexie.

import Dexie, { type Table } from 'dexie';
import type { Recipe, WeekPlan } from '../types';
import { gerarTags } from '../lib/tags';

export class DumbfoodDB extends Dexie {
  recipes!: Table<Recipe, string>;
  plans!: Table<WeekPlan, string>;

  constructor() {
    super('dumbfood');
    this.version(1).stores({
      recipes: 'id, titulo, criadoEm',
      plans: 'id',
    });
    // v2: tags (índice multiEntry) e tempo de preparo; backfill de tags/tags vazias.
    this.version(2)
      .stores({
        recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
        plans: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('recipes').toCollection().modify((r: Recipe) => {
          if (!Array.isArray(r.tags)) r.tags = gerarTags(r.titulo, r.ingredientes ?? []);
        });
      });
  }
}

export const db = new DumbfoodDB();

/** Id do único plano ativo (MVP com um plano de semana). */
export const PLANO_ATUAL_ID = 'atual';

/** Garante que exista um plano atual e o retorna. */
export async function getOrCreatePlanoAtual(): Promise<WeekPlan> {
  const existing = await db.plans.get(PLANO_ATUAL_ID);
  if (existing) return existing;
  const novo: WeekPlan = { id: PLANO_ATUAL_ID, itens: [] };
  await db.plans.put(novo);
  return novo;
}
