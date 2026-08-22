// Operações de alto nível sobre o banco.

import type {
  Compra,
  GeladeiraItem,
  Ingredient,
  ListaEstado,
  NewRecipe,
  PrecoItem,
  Recipe,
  Refeicao,
  VideoReceita,
  WeekPlan,
  YieldType,
} from '../types';
import { db, LISTA_ATUAL_ID, PLANO_ATUAL_ID, getOrCreatePlanoAtual, listaEstadoVazio } from './db';
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

/**
 * Backup versão 2: leva *tudo* que o usuário construiu — não só receitas e plano.
 * O histórico de compras e a série de preços são justamente o que não dá para
 * reconstruir depois de trocar de aparelho.
 *
 * Fora do arquivo ficam só os vídeos das receitas (megabytes de blob, que
 * inflariam o JSON) — por isso `videos` não aparece aqui.
 */
interface BackupData {
  version: 1 | 2;
  exportadoEm: string;
  recipes: Recipe[];
  plans: WeekPlan[];
  compras?: Compra[];
  precos?: PrecoItem[];
  geladeira?: GeladeiraItem[];
  listaEstado?: ListaEstado[];
  /** Preferências de interface (tema, dieta, orçamento, lembretes...), chave -> valor. */
  preferencias?: Record<string, string>;
}

/** Prefixo das preferências no localStorage; tudo com ele entra e volta no backup. */
const PREFIXO_PREFERENCIAS = 'dumbfood:';

function lerPreferencias(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (!chave || !chave.startsWith(PREFIXO_PREFERENCIAS)) continue;
    const valor = localStorage.getItem(chave);
    if (valor !== null) out[chave] = valor;
  }
  return out;
}

function gravarPreferencias(prefs: Record<string, string> | undefined): void {
  if (!prefs || typeof localStorage === 'undefined') return;
  for (const [chave, valor] of Object.entries(prefs)) {
    if (chave.startsWith(PREFIXO_PREFERENCIAS)) localStorage.setItem(chave, valor);
  }
}

export async function exportarJSON(): Promise<string> {
  const [recipes, plans, compras, precos, geladeira, listaEstado] = await Promise.all([
    db.recipes.toArray(),
    db.plans.toArray(),
    db.compras.toArray(),
    db.precos.toArray(),
    db.geladeira.toArray(),
    db.listaEstado.toArray(),
  ]);
  const data: BackupData = {
    version: 2,
    exportadoEm: new Date().toISOString(),
    recipes,
    plans,
    compras,
    precos,
    geladeira,
    listaEstado,
    preferencias: lerPreferencias(),
  };
  return JSON.stringify(data, null, 2);
}

export type ModoImportacao = 'mesclar' | 'substituir';

export interface ResumoImportacao {
  recipes: number;
  compras: number;
  precos: number;
  geladeira: number;
}

/**
 * Restaura um backup. `mesclar` mantém o que já existe (registros com o mesmo id são
 * sobrescritos pelo arquivo); `substituir` apaga o conteúdo atual antes — é o modo de
 * "este aparelho passa a ser o do backup", sem sobras da instalação anterior.
 *
 * Backups versão 1 (só receitas e plano) continuam válidos: o que eles não trazem
 * simplesmente não é tocado, nem mesmo no modo substituir.
 */
export async function importarJSON(json: string, modo: ModoImportacao = 'mesclar'): Promise<ResumoImportacao> {
  const data = JSON.parse(json) as Partial<BackupData>;
  if (!Array.isArray(data.recipes)) throw new Error('Arquivo de backup inválido.');

  await db.transaction(
    'rw',
    [db.recipes, db.plans, db.compras, db.precos, db.geladeira, db.listaEstado],
    async () => {
      if (modo === 'substituir') {
        await db.recipes.clear();
        await db.plans.clear();
        if (data.compras) await db.compras.clear();
        if (data.precos) await db.precos.clear();
        if (data.geladeira) await db.geladeira.clear();
        if (data.listaEstado) await db.listaEstado.clear();
      }
      await db.recipes.bulkPut(data.recipes as Recipe[]);
      if (Array.isArray(data.plans)) await db.plans.bulkPut(data.plans);
      if (Array.isArray(data.compras)) await db.compras.bulkPut(data.compras);
      if (Array.isArray(data.precos)) await db.precos.bulkPut(data.precos);
      if (Array.isArray(data.geladeira)) await db.geladeira.bulkPut(data.geladeira);
      if (Array.isArray(data.listaEstado)) await db.listaEstado.bulkPut(data.listaEstado);
    },
  );

  gravarPreferencias(data.preferencias);

  return {
    recipes: data.recipes.length,
    compras: data.compras?.length ?? 0,
    precos: data.precos?.length ?? 0,
    geladeira: data.geladeira?.length ?? 0,
  };
}

// ---- Estado da lista de mercado ----

export async function getOrCreateListaEstado(): Promise<ListaEstado> {
  const atual = await db.listaEstado.get(LISTA_ATUAL_ID);
  if (atual) return atual;
  const novo = listaEstadoVazio();
  await db.listaEstado.put(novo);
  return novo;
}

/** Aplica uma alteração parcial ao estado da lista (padrão read-modify-write do repo). */
export async function atualizarListaEstado(
  patch: Partial<Omit<ListaEstado, 'id'>> | ((atual: ListaEstado) => Partial<Omit<ListaEstado, 'id'>>),
): Promise<void> {
  const atual = await getOrCreateListaEstado();
  const mudanca = typeof patch === 'function' ? patch(atual) : patch;
  await db.listaEstado.put({ ...atual, ...mudanca, id: LISTA_ATUAL_ID });
}

/** Zera a lista em andamento (após salvar a compra no histórico, por exemplo). */
export async function limparListaEstado(): Promise<void> {
  await db.listaEstado.put(listaEstadoVazio());
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
  const ing = parseIngredient(nomeBruto);
  const nome = ing?.item ?? '';
  const itemKey = normalizeItemKey(nome);
  if (!itemKey) return;
  // "2 kg de arroz" guarda também o quanto: a quantidade já veio digitada, seria bobagem descartá-la.
  await db.geladeira.put({
    itemKey,
    nome,
    adicionadoEm: Date.now(),
    validade,
    ...(ing?.quantidade != null ? { quantidade: ing.quantidade, unidade: ing.unidade } : {}),
  });
}

/** Item a lançar na geladeira: só o nome, ou nome + quanto sobrou/entrou. */
export interface EntradaGeladeira {
  nome: string;
  quantidade?: number;
  unidade?: string | null;
}

/**
 * Adiciona vários ingredientes de uma vez (ex.: itens recém-comprados no mercado),
 * sem sobrescrever a validade já informada de quem já estava na geladeira.
 * Quando a entrada traz quantidade (ex.: a sobra de uma embalagem arredondada), ela
 * é somada à que já estava registrada. Devolve quantos itens novos entraram.
 */
export async function adicionarVariosNaGeladeira(entradas: (string | EntradaGeladeira)[]): Promise<number> {
  const agora = Date.now();
  const novos = new Map<string, GeladeiraItem>();
  for (const bruta of entradas) {
    const entrada: EntradaGeladeira = typeof bruta === 'string' ? { nome: bruta } : bruta;
    const nome = parseIngredient(entrada.nome)?.item ?? '';
    const itemKey = normalizeItemKey(nome);
    if (!itemKey) continue;
    const anterior = novos.get(itemKey);
    novos.set(itemKey, {
      itemKey,
      nome,
      adicionadoEm: agora,
      ...(entrada.quantidade != null
        ? {
            quantidade: (anterior?.unidade === entrada.unidade ? (anterior?.quantidade ?? 0) : 0) + entrada.quantidade,
            unidade: entrada.unidade ?? null,
          }
        : {}),
    });
  }
  if (novos.size === 0) return 0;

  const existentes = (await db.geladeira.bulkGet(Array.from(novos.keys()))).filter(
    (g): g is GeladeiraItem => Boolean(g),
  );
  const porChave = new Map(existentes.map((g) => [g.itemKey, g]));

  const gravar: GeladeiraItem[] = [];
  let inseridos = 0;
  for (const [itemKey, novo] of novos) {
    const atual = porChave.get(itemKey);
    if (!atual) {
      gravar.push(novo);
      inseridos += 1;
      continue;
    }
    // Já estava lá: preserva validade/nome e só acumula a quantidade, quando as unidades batem.
    if (novo.quantidade == null) continue;
    const mesmaUnidade = (atual.unidade ?? null) === (novo.unidade ?? null);
    gravar.push({
      ...atual,
      quantidade: mesmaUnidade ? round2((atual.quantidade ?? 0) + novo.quantidade) : novo.quantidade,
      unidade: novo.unidade ?? null,
    });
  }
  if (gravar.length > 0) await db.geladeira.bulkPut(gravar);
  return inseridos;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Define (ou limpa) quanto se tem de um item já na geladeira. */
export async function definirQuantidadeGeladeira(
  itemKey: string,
  quantidade: number | undefined,
  unidade: string | null | undefined,
): Promise<void> {
  const item = await db.geladeira.get(itemKey);
  if (!item) return;
  const { quantidade: _q, unidade: _u, ...resto } = item;
  await db.geladeira.put(quantidade == null ? resto : { ...resto, quantidade, unidade: unidade ?? null });
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
