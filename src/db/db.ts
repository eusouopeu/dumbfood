// Banco local (IndexedDB) via Dexie.

import Dexie, { type Table } from 'dexie';
import type { Recipe, WeekPlan } from '../types';

export class DumbfoodDB extends Dexie {
  recipes!: Table<Recipe, string>;
  plans!: Table<WeekPlan, string>;

  constructor() {
    super('dumbfood');
    this.version(1).stores({
      recipes: 'id, titulo, criadoEm',
      plans: 'id',
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
