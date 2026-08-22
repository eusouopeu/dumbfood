// Banco local (IndexedDB) via Dexie.

import Dexie, { type Table } from 'dexie';
import type { Compra, GeladeiraItem, ListaEstado, PrecoItem, Recipe, VideoReceita, WeekPlan } from '../types';
import { gerarTags } from '../lib/tags';
import { reprocessarIngrediente } from '../lib/ingredientParser';

export class DumbfoodDB extends Dexie {
  recipes!: Table<Recipe, string>;
  plans!: Table<WeekPlan, string>;
  compras!: Table<Compra, string>;
  precos!: Table<PrecoItem, string>;
  geladeira!: Table<GeladeiraItem, string>;
  videos!: Table<VideoReceita, string>;
  listaEstado!: Table<ListaEstado, string>;

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
    // v8: o estado da lista de mercado (marcados, itens manuais, quantidades corrigidas)
    // sai do localStorage e vem para o banco — assim é reativo, entra no backup e não
    // some quando o usuário limpa os dados do navegador no meio da compra.
    this.version(8)
      .stores({
        recipes: 'id, titulo, criadoEm, *tags, tempoPreparoMin',
        plans: 'id',
        compras: 'id, data, mercado',
        precos: 'itemKey, item',
        geladeira: 'itemKey, adicionadoEm',
        videos: 'id, criadoEm',
        listaEstado: 'id',
      })
      .upgrade(async (tx) => {
        const estado = lerListaDoLocalStorage();
        if (estado) await tx.table('listaEstado').put(estado);
      });
  }
}

/** Id do único registro de estado da lista de mercado. */
export const LISTA_ATUAL_ID = 'atual';

const CHAVES_LISTA_ANTIGAS = ['dumbfood:comprados', 'dumbfood:itensExtras', 'dumbfood:itensQtd'];

/**
 * Lê o estado da lista que ficava em três chaves de localStorage (versões <= 7),
 * para não perder a compra em andamento na migração. Devolve null quando não há nada.
 */
function lerListaDoLocalStorage(): ListaEstado | null {
  if (typeof localStorage === 'undefined') return null;
  const ler = <T,>(chave: string, padrao: T): T => {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? (JSON.parse(bruto) as T) : padrao;
    } catch {
      return padrao;
    }
  };
  const estado: ListaEstado = {
    id: LISTA_ATUAL_ID,
    comprados: ler<string[]>('dumbfood:comprados', []),
    extras: ler('dumbfood:itensExtras', []),
    overrides: ler('dumbfood:itensQtd', {}),
    ocultos: [],
  };
  const vazio =
    estado.comprados.length === 0 && estado.extras.length === 0 && Object.keys(estado.overrides).length === 0;
  for (const chave of CHAVES_LISTA_ANTIGAS) localStorage.removeItem(chave);
  return vazio ? null : estado;
}

export const db = new DumbfoodDB();

/** Id do único plano ativo (MVP com um plano de semana). */
export const PLANO_ATUAL_ID = 'atual';

/** Estado inicial da lista de mercado (nada marcado, nada manual). */
export function listaEstadoVazio(): ListaEstado {
  return { id: LISTA_ATUAL_ID, comprados: [], extras: [], overrides: {}, ocultos: [] };
}

/** Garante que exista um plano atual e o retorna. */
export async function getOrCreatePlanoAtual(): Promise<WeekPlan> {
  const existing = await db.plans.get(PLANO_ATUAL_ID);
  if (existing) return existing;
  const novo: WeekPlan = { id: PLANO_ATUAL_ID, itens: [] };
  await db.plans.put(novo);
  return novo;
}
