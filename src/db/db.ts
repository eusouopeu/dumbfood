// Banco local (IndexedDB) via Dexie.

import Dexie, { type Table } from 'dexie';
import type { Compra, GeladeiraItem, PrecoItem, Recipe, VideoReceita, WeekPlan } from '../types';
import { gerarTags } from '../lib/tags';
import { reprocessarIngrediente } from '../lib/ingredientParser';

export class DumbfoodDB extends Dexie {
  recipes!: Table<Recipe, string>;
  plans!: Table<WeekPlan, string>;
  compras!: Table<Compra, string>;
  precos!: Table<PrecoItem, string>;
  geladeira!: Table<GeladeiraItem, string>;
  videos!: Table<VideoReceita, string>;

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
    // v3: histórico de compras de mercado e tabela de preços de ingredientes.
    this.version(3).stores({
      recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
      plans: 'id',
      compras: 'id, data',
      precos: 'itemKey, item',
    });
    // v4: reprocessa os ingredientes já importados com o parser corrigido.
    this.version(4)
      .stores({
        recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
        plans: 'id',
        compras: 'id, data',
        precos: 'itemKey, item',
      })
      .upgrade(async (tx) => {
        await tx.table('recipes').toCollection().modify((r: Recipe) => {
          if (Array.isArray(r.ingredientes)) r.ingredientes = r.ingredientes.map(reprocessarIngrediente);
        });
      });
    // v5: ingredientes disponíveis na geladeira/despensa.
    this.version(5).stores({
      recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
      plans: 'id',
      compras: 'id, data',
      precos: 'itemKey, item',
      geladeira: 'itemKey, adicionadoEm',
    });
    // v6: compras passam a registrar em qual mercado foram feitas (comparação entre
    // estabelecimentos e série histórica de preço por item). Compras antigas ficam sem
    // mercado — o índice aceita registros sem a chave.
    this.version(6).stores({
      recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
      plans: 'id',
      compras: 'id, data, mercado',
      precos: 'itemKey, item',
      geladeira: 'itemKey, adicionadoEm',
    });
    // v7: vídeos das receitas (TikTok e afins) guardados no dispositivo, para tocar
    // dentro do modo de preparo mesmo offline. O blob fica fora da tabela de receitas
    // para não carregar megabytes de vídeo em toda leitura da lista.
    this.version(7).stores({
      recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
      plans: 'id',
      compras: 'id, data, mercado',
      precos: 'itemKey, item',
      geladeira: 'itemKey, adicionadoEm',
      videos: 'id, criadoEm',
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
