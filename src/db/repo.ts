// Operações de alto nível sobre o banco.

import type { Compra, GeladeiraItem, Ingredient, NewRecipe, PrecoItem, Recipe, Refeicao, VideoReceita, WeekPlan, YieldType } from '../types';
import { db, PLANO_ATUAL_ID, getOrCreatePlanoAtual } from './db';
import { scaleIngredients } from '../lib/scale';
import { mesclarTags } from '../lib/tags';
import { parseIngredient, normalizeItemKey } from '../lib/ingredientParser';

export function novoId(): string {
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

/** Alterna o favorito de uma receita. */
export async function alternarFavorito(recipe: Recipe): Promise<void> {
  await db.recipes.put({ ...recipe, favorito: !recipe.favorito });
}

/** Duplica a receita como uma nova, com título marcado como cópia. */
export async function duplicarReceita(recipe: Recipe): Promise<Recipe> {
  const copia: Recipe = {
    ...recipe,
    id: novoId(),
    titulo: `${recipe.titulo} (cópia)`,
    favorito: false,
    criadoEm: Date.now(),
  };
  await db.recipes.put(copia);
  return copia;
}

/** Adiciona tags novas (sem duplicar) à receita. */
export async function adicionarTags(recipe: Recipe, novas: string[]): Promise<void> {
  await db.recipes.put({ ...recipe, tags: mesclarTags(recipe.tags ?? [], novas) });
}

/**
 * Salva a receita com ingredientes ajustados para uma restrição alimentar como uma
 * nova receita (não sobrescreve o original — a versão "com lactose" continua
 * disponível), marcada com a tag da restrição.
 */
export async function salvarVersaoComRestricao(
  recipe: Recipe,
  ingredientesAjustados: Ingredient[],
  tagRestricao: string,
): Promise<Recipe> {
  const copia: Recipe = {
    ...recipe,
    id: novoId(),
    titulo: `${recipe.titulo} (${tagRestricao})`,
    ingredientes: ingredientesAjustados,
    tags: mesclarTags(recipe.tags ?? [], [tagRestricao]),
    favorito: false,
    criadoEm: Date.now(),
  };
  await db.recipes.put(copia);
  return copia;
}

export async function removerReceita(id: string): Promise<void> {
  const receita = await db.recipes.get(id);
  await db.recipes.delete(id);
  // O vídeo só existe por causa da receita: sem ela, viraria lixo ocupando espaço.
  if (receita?.videoId) await db.videos.delete(receita.videoId);
  const plano = await getOrCreatePlanoAtual();
  const itens = plano.itens.filter((i) => i.recipeId !== id);
  await db.plans.put({ ...plano, itens });
}

// ---- Vídeos das receitas ----

/** Teto de tamanho do vídeo: acima disso o IndexedDB começa a pesar no aparelho. */
export const TAMANHO_MAX_VIDEO = 100 * 1024 * 1024;

/** Guarda o arquivo de vídeo no dispositivo e devolve o id para vincular à receita. */
export async function salvarVideo(file: File): Promise<string> {
  if (file.size > TAMANHO_MAX_VIDEO) {
    throw new Error('Vídeo maior que 100 MB. Corte o trecho do preparo antes de importar.');
  }
  const video: VideoReceita = {
    id: novoId(),
    blob: file,
    mime: file.type || 'video/mp4',
    nome: file.name,
    tamanho: file.size,
    criadoEm: Date.now(),
  };
  await db.videos.put(video);
  return video.id;
}

/** Vincula (ou troca) o vídeo de uma receita, descartando o anterior. */
export async function definirVideoDaReceita(recipe: Recipe, videoId: string | undefined): Promise<void> {
  if (recipe.videoId && recipe.videoId !== videoId) await db.videos.delete(recipe.videoId);
  const { videoId: _antigo, ...resto } = recipe;
  await db.recipes.put(videoId ? { ...resto, videoId } : resto);
}

export async function definirNoPlano(recipeId: string, fator: number): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  const idx = plano.itens.findIndex((i) => i.recipeId === recipeId);
  const itens = [...plano.itens];
  // Preserva o agendamento (dia/refeição) ao ajustar só a quantidade.
  if (idx >= 0) itens[idx] = { ...itens[idx], recipeId, fator };
  else itens.push({ recipeId, fator });
  await db.plans.put({ ...plano, itens });
}

/**
 * Agenda (ou desagenda, passando undefined) a receita em um dia da semana e refeição.
 * Só mexe no item já existente no plano — agendar não adiciona ao plano por si só.
 */
export async function definirAgendamento(
  recipeId: string,
  dia: number | undefined,
  refeicao: Refeicao | undefined,
): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  const idx = plano.itens.findIndex((i) => i.recipeId === recipeId);
  if (idx < 0) return;
  const itens = [...plano.itens];
  const { dia: _d, refeicao: _r, ...resto } = itens[idx];
  itens[idx] = { ...resto, ...(dia !== undefined ? { dia } : {}), ...(refeicao !== undefined ? { refeicao } : {}) };
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

// ---- Preços de ingredientes ----

/** Insere/atualiza preços importados (upsert por chave normalizada do item). */
export async function importarPrecos(itens: PrecoItem[]): Promise<number> {
  await db.precos.bulkPut(itens);
  return itens.length;
}

export async function removerPreco(itemKey: string): Promise<void> {
  await db.precos.delete(itemKey);
}

// ---- Histórico de compras ----

export async function salvarCompra(compra: Omit<Compra, 'id' | 'criadoEm'>): Promise<Compra> {
  const nova: Compra = { ...compra, id: novoId(), criadoEm: Date.now() };
  await db.compras.put(nova);
  return nova;
}

export async function removerCompra(id: string): Promise<void> {
  await db.compras.delete(id);
}

// ---- Geladeira ----

/**
 * Adiciona um ingrediente à geladeira. Passa pelo mesmo parser das receitas, então
 * o usuário pode digitar do jeito que pensa ("2 cebolas grandes") que só o nome fica.
 * `validade`, quando informada, é a data (timestamp) em que o item vence.
 */
export async function adicionarNaGeladeira(nomeBruto: string, validade?: number): Promise<void> {
  const nome = parseIngredient(nomeBruto)?.item ?? '';
  const itemKey = normalizeItemKey(nome);
  if (!itemKey) return;
  await db.geladeira.put({ itemKey, nome, adicionadoEm: Date.now(), validade });
}

/**
 * Adiciona vários ingredientes de uma vez (ex.: itens recém-comprados no mercado),
 * sem sobrescrever a validade já informada de quem já estava na geladeira.
 * Devolve quantos itens novos entraram.
 */
export async function adicionarVariosNaGeladeira(nomesBrutos: string[]): Promise<number> {
  const agora = Date.now();
  const novos = new Map<string, GeladeiraItem>();
  for (const bruto of nomesBrutos) {
    const nome = parseIngredient(bruto)?.item ?? '';
    const itemKey = normalizeItemKey(nome);
    if (!itemKey || novos.has(itemKey)) continue;
    novos.set(itemKey, { itemKey, nome, adicionadoEm: agora });
  }
  if (novos.size === 0) return 0;
  const existentes = new Set((await db.geladeira.bulkGet(Array.from(novos.keys()))).filter(Boolean).map((g) => g!.itemKey));
  const inserir = Array.from(novos.values()).filter((g) => !existentes.has(g.itemKey));
  await db.geladeira.bulkPut(inserir);
  return inserir.length;
}

/** Dá baixa de vários itens da geladeira de uma vez (ex.: ingredientes usados ao cozinhar). */
export async function baixarDaGeladeira(itemKeys: string[]): Promise<number> {
  const unicos = Array.from(new Set(itemKeys.filter(Boolean)));
  if (unicos.length === 0) return 0;
  await db.geladeira.bulkDelete(unicos);
  return unicos.length;
}

export async function removerDaGeladeira(itemKey: string): Promise<void> {
  await db.geladeira.delete(itemKey);
}

/** Define (ou limpa, passando undefined) a validade de um item já na geladeira. */
export async function definirValidadeGeladeira(itemKey: string, validade: number | undefined): Promise<void> {
  const item = await db.geladeira.get(itemKey);
  if (!item) return;
  await db.geladeira.put({ ...item, validade });
}

export async function limparGeladeira(): Promise<void> {
  await db.geladeira.clear();
}
