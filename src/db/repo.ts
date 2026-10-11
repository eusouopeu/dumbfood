// Operações de alto nível sobre o banco.

import type {
  Agendamento,
  CodigoBarras,
  Compra,
  GeladeiraItem,
  Ingredient,
  ListaEstado,
  NewRecipe,
  PlanItem,
  PrecoItem,
  Recipe,
  Refeicao,
  RegistroConsumo,
  RegistroExercicio,
  VideoReceita,
  WeekPlan,
  YieldType,
  PratoSalvo,
} from '../types';
import { db, LISTA_ATUAL_ID, PLANO_ATUAL_ID, getOrCreatePlanoAtual, listaEstadoVazio } from './db';
import { scaleIngredients } from '../lib/scale';
import { mesclarTags, removerTag } from '../lib/tags';
import { parseIngredient, normalizeItemKey } from '../lib/ingredientParser';
import { agendamentosDoItem, mesmoAgendamento } from '../lib/agenda';
import { distribuirSemana, tipoDaReceita } from '../lib/distribuirSemana';
import { sugerirReceitasParaPlano } from '../lib/autoPlano';
import { baixaPorConsumo } from '../lib/baixaDespensa';
import type { RegistroPeso } from '../lib/pesoCorporal';
import type { RegistroFome } from '../lib/fome';
import { chaveDia } from '../lib/consumo';

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
 * Ajusta os ingredientes da própria receita para uma restrição alimentar — sem criar
 * cópia. Guarda os ingredientes de antes (só na primeira vez; um segundo ajuste sem
 * reverter o primeiro não deve perder o original de verdade) para permitir reverter
 * depois, e marca a receita com a tag da restrição.
 */
export async function aplicarRestricao(
  recipe: Recipe,
  ingredientesAjustados: Ingredient[],
  restricao: { tag: string; label: string },
): Promise<Recipe> {
  const atualizada: Recipe = {
    ...recipe,
    ingredientes: ingredientesAjustados,
    ingredientesOriginais: recipe.ingredientesOriginais ?? recipe.ingredientes,
    restricaoAplicada: restricao,
    tags: mesclarTags(recipe.tags ?? [], [restricao.tag]),
  };
  await db.recipes.put(atualizada);
  return atualizada;
}

/** Desfaz o último ajuste por restrição: volta aos ingredientes originais e tira a tag. */
export async function reverterRestricao(recipe: Recipe): Promise<Recipe> {
  if (!recipe.ingredientesOriginais || !recipe.restricaoAplicada) return recipe;
  const { ingredientesOriginais, restricaoAplicada, ...resto } = recipe;
  const revertida: Recipe = {
    ...resto,
    ingredientes: ingredientesOriginais,
    tags: removerTag(recipe.tags ?? [], restricaoAplicada.tag),
  };
  await db.recipes.put(revertida);
  return revertida;
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
 * Agenda a receita em mais um lugar da semana (dia + refeição opcional). Uma receita
 * pode ocupar vários lugares — a panelada de segunda que também é o almoço de quinta —
 * e o mesmo lugar aceita várias receitas. Agendar não adiciona ao plano por si só.
 * Repetir um agendamento igual não duplica.
 */
export async function adicionarAgendamento(
  recipeId: string,
  dia: number,
  refeicao: Refeicao | undefined,
): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  const idx = plano.itens.findIndex((i) => i.recipeId === recipeId);
  if (idx < 0) return;
  const novo: Agendamento = { dia, ...(refeicao ? { refeicao } : {}) };
  const atuais = agendamentosDoItem(plano.itens[idx]);
  if (atuais.some((a) => mesmoAgendamento(a, novo))) return;
  await gravarAgendamentos(plano, idx, [...atuais, novo]);
}

/** Tira a receita de um lugar da semana; os outros agendamentos dela continuam. */
export async function removerAgendamento(
  recipeId: string,
  agendamento: Agendamento,
): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  const idx = plano.itens.findIndex((i) => i.recipeId === recipeId);
  if (idx < 0) return;
  const restantes = agendamentosDoItem(plano.itens[idx]).filter((a) => !mesmoAgendamento(a, agendamento));
  await gravarAgendamentos(plano, idx, restantes);
}

/** Grava a lista de agendamentos, descartando os campos do formato antigo. */
async function gravarAgendamentos(plano: WeekPlan, idx: number, agendamentos: Agendamento[]): Promise<void> {
  const itens = [...plano.itens];
  const { dia: _dia, refeicao: _refeicao, ...resto } = itens[idx];
  itens[idx] = { ...resto, agendamentos };
  await db.plans.put({ ...plano, itens });
}

/**
 * Põe na agenda as receitas do plano que ainda não têm dia, a partir de `hoje`, sem mexer
 * no que já foi agendado à mão (ver lib/distribuirSemana.ts). Devolve quantas receitas
 * ganharam lugar.
 */
export async function distribuirPlanoNaSemana(recipes: Recipe[], hoje: number): Promise<number> {
  const plano = await getOrCreatePlanoAtual();
  const porId = new Map(recipes.map((r) => [r.id, r]));
  const ocupados = plano.itens.flatMap(agendamentosDoItem);
  const pendentes = plano.itens.flatMap((item) => {
    const r = porId.get(item.recipeId);
    if (!r || agendamentosDoItem(item).length > 0) return [];
    const tipo = tipoDaReceita(r);
    if (!tipo) return [];
    return [{ recipeId: r.id, porcoes: (r.rendimentoBase.valor || 1) * item.fator, tipo }];
  });
  if (pendentes.length === 0) return 0;
  const distribuicao = distribuirSemana(pendentes, hoje, ocupados);
  const itens = plano.itens.map((item) => {
    const agendamentos = distribuicao.get(item.recipeId);
    if (!agendamentos || agendamentos.length === 0) return item;
    const { dia: _dia, refeicao: _refeicao, ...resto } = item;
    return { ...resto, agendamentos };
  });
  await db.plans.put({ ...plano, itens });
  return distribuicao.size;
}

/**
 * "Montar semana": as duas metades de escolher + agendar (autoPlano.ts +
 * distribuirSemana.ts) por trás de uma chamada só, pra elas nunca rodarem separadas e
 * ficarem fora de sincronia entre si.
 */
export async function montarSemana(
  recipes: Recipe[],
  geladeira: GeladeiraItem[],
  alvo: number,
  hoje: number,
): Promise<{ adicionadas: number; distribuidas: number }> {
  const plano = await getOrCreatePlanoAtual();
  const jaSelecionadas = new Set(plano.itens.map((i) => i.recipeId));
  const faltam = alvo - jaSelecionadas.size;
  const sugeridas = faltam > 0 ? sugerirReceitasParaPlano(recipes, geladeira, jaSelecionadas, faltam) : [];
  for (const r of sugeridas) await definirNoPlano(r.id, 1);
  const distribuidas = await distribuirPlanoNaSemana(recipes, hoje);
  return { adicionadas: sugeridas.length, distribuidas };
}

export async function removerDoPlano(recipeId: string): Promise<void> {
  const plano = await getOrCreatePlanoAtual();
  await db.plans.put({ ...plano, itens: plano.itens.filter((i) => i.recipeId !== recipeId) });
}

/** Chave do snapshot do plano anterior, para "repetir semana passada". Prefixo
 * `dumbfood:` entra automaticamente no backup, junto das outras preferências. */
const KEY_PLANO_ANTERIOR = 'dumbfood:planoAnterior';

export async function limparPlano(): Promise<void> {
  const atual = await getOrCreatePlanoAtual();
  if (atual.itens.length > 0 && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY_PLANO_ANTERIOR, JSON.stringify(atual.itens));
  }
  await db.plans.put({ id: PLANO_ATUAL_ID, itens: [] });
  // A lista de mercado é derivada do plano: os itens marcados como comprados e os que
  // o usuário escondeu com o arraste valem para *aquela* lista. Sem zerar aqui, um item
  // escondido semanas atrás continuava sumindo da lista nova, sem nenhum aviso.
  await limparListaEstado();
}

/** Se há uma semana anterior salva para repetir. */
export function planoAnteriorDisponivel(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(KEY_PLANO_ANTERIOR) !== null;
}

/**
 * Recoloca no plano atual as receitas da semana anterior (as que ainda existem na
 * biblioteca, com agendamentos), sem duplicar o que já está no plano. Devolve
 * quantas receitas entraram.
 */
export async function repetirPlanoAnterior(idsValidos: Set<string>): Promise<number> {
  if (typeof localStorage === 'undefined') return 0;
  const bruto = localStorage.getItem(KEY_PLANO_ANTERIOR);
  if (!bruto) return 0;
  let anteriores: PlanItem[];
  try {
    anteriores = JSON.parse(bruto);
  } catch {
    return 0;
  }
  const plano = await getOrCreatePlanoAtual();
  const existentes = new Set(plano.itens.map((i) => i.recipeId));
  const novos = anteriores.filter((i) => idsValidos.has(i.recipeId) && !existentes.has(i.recipeId));
  if (novos.length === 0) return 0;
  await db.plans.put({ ...plano, itens: [...plano.itens, ...novos] });
  return novos.length;
}

/** Salva a anotação livre do usuário sobre a receita (ajustes, observações de quem fez). */
export async function definirNotas(recipe: Recipe, notas: string): Promise<void> {
  const texto = notas.trim();
  if (texto) {
    await db.recipes.put({ ...recipe, notas: texto });
  } else {
    const { notas: _antigas, ...resto } = recipe;
    await db.recipes.put(resto);
  }
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
  version: 1 | 2 | 3 | 4 | 5 | 6;
  exportadoEm: string;
  recipes: Recipe[];
  plans: WeekPlan[];
  compras?: Compra[];
  precos?: PrecoItem[];
  geladeira?: GeladeiraItem[];
  listaEstado?: ListaEstado[];
  /** Refeições registradas (versão 3 do backup em diante). */
  consumo?: RegistroConsumo[];
  /** Códigos de barras já identificados (versão 3 em diante). */
  codigos?: CodigoBarras[];
  /** Exercícios registrados (versão 4 do backup em diante). */
  exercicios?: RegistroExercicio[];
  /** Peso corporal por dia (versão 5 em diante). */
  pesos?: RegistroPeso[];
  /** Horários de fome registrados à mão (versão 6 em diante). */
  fome?: RegistroFome[];
  /** Pratos estimados pela IA (versão 6 em diante). */
  pratos?: PratoSalvo[];
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
  const [recipes, plans, compras, precos, geladeira, listaEstado, consumo, codigos, exercicios, pesos, fome, pratos] = await Promise.all([
    db.recipes.toArray(),
    db.plans.toArray(),
    db.compras.toArray(),
    db.precos.toArray(),
    db.geladeira.toArray(),
    db.listaEstado.toArray(),
    db.consumo.toArray(),
    db.codigos.toArray(),
    db.exercicios.toArray(),
    db.pesos.toArray(),
    db.fome.toArray(),
    db.pratos.toArray(),
  ]);
  const data: BackupData = {
    version: 6,
    exportadoEm: new Date().toISOString(),
    recipes,
    plans,
    compras,
    precos,
    geladeira,
    listaEstado,
    consumo,
    codigos,
    exercicios,
    pesos,
    fome,
    pratos,
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
  consumo: number;
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
    [
      db.recipes,
      db.plans,
      db.compras,
      db.precos,
      db.geladeira,
      db.listaEstado,
      db.consumo,
      db.codigos,
      db.exercicios,
      db.pesos,
      db.fome,
      db.pratos,
    ],
    async () => {
      if (modo === 'substituir') {
        await db.recipes.clear();
        await db.plans.clear();
        if (data.compras) await db.compras.clear();
        if (data.precos) await db.precos.clear();
        if (data.geladeira) await db.geladeira.clear();
        if (data.listaEstado) await db.listaEstado.clear();
        if (data.consumo) await db.consumo.clear();
        if (data.codigos) await db.codigos.clear();
        if (data.exercicios) await db.exercicios.clear();
        if (data.pesos) await db.pesos.clear();
        if (data.fome) await db.fome.clear();
        if (data.pratos) await db.pratos.clear();
      }
      await db.recipes.bulkPut(data.recipes as Recipe[]);
      if (Array.isArray(data.plans)) await db.plans.bulkPut(data.plans);
      if (Array.isArray(data.compras)) await db.compras.bulkPut(data.compras);
      if (Array.isArray(data.precos)) await db.precos.bulkPut(data.precos);
      if (Array.isArray(data.geladeira)) await db.geladeira.bulkPut(data.geladeira);
      if (Array.isArray(data.listaEstado)) await db.listaEstado.bulkPut(data.listaEstado);
      if (Array.isArray(data.consumo)) await db.consumo.bulkPut(data.consumo);
      if (Array.isArray(data.codigos)) await db.codigos.bulkPut(data.codigos);
      if (Array.isArray(data.exercicios)) await db.exercicios.bulkPut(data.exercicios);
      if (Array.isArray(data.pesos)) await db.pesos.bulkPut(data.pesos);
      if (Array.isArray(data.fome)) await db.fome.bulkPut(data.fome);
      if (Array.isArray(data.pratos)) await db.pratos.bulkPut(data.pratos);
    },
  );

  gravarPreferencias(data.preferencias);

  return {
    recipes: data.recipes.length,
    compras: data.compras?.length ?? 0,
    precos: data.precos?.length ?? 0,
    geladeira: data.geladeira?.length ?? 0,
    consumo: data.consumo?.length ?? 0,
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
 * `quantidade` é o campo separado da folha de adicionar; quando vem preenchido, manda
 * mais que o número embutido no texto (o usuário acabou de digitá-lo à parte).
 */
export async function adicionarNaGeladeira(
  nomeBruto: string,
  validade?: number,
  quantidade?: number | null,
): Promise<void> {
  const ing = parseIngredient(nomeBruto);
  const nome = ing?.item ?? '';
  const itemKey = normalizeItemKey(nome);
  if (!itemKey) return;
  // "2 kg de arroz" guarda também o quanto: a quantidade já veio digitada, seria bobagem descartá-la.
  const qtd = quantidade ?? ing?.quantidade ?? null;
  const unidade = quantidade != null ? (ing?.quantidade != null ? ing.unidade : null) : (ing?.unidade ?? null);
  await db.geladeira.put({
    itemKey,
    nome,
    adicionadoEm: Date.now(),
    validade,
    ...(qtd != null ? { quantidade: qtd, unidade } : {}),
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

// ---- Consumo do dia ----

/** Grava uma refeição comida. Os nutrientes já vêm multiplicados pelas porções. */
export async function registrarConsumo(
  registro: Omit<RegistroConsumo, 'id' | 'criadoEm'>,
): Promise<RegistroConsumo> {
  const novo: RegistroConsumo = { ...registro, id: novoId(), criadoEm: Date.now() };
  await db.consumo.put(novo);
  return novo;
}

/** Registra um exercício do dia (nome + kcal queimadas, minutos opcionais). */
export async function registrarExercicio(
  registro: Omit<RegistroExercicio, 'id' | 'criadoEm'>,
): Promise<RegistroExercicio> {
  const novo: RegistroExercicio = { ...registro, id: novoId(), criadoEm: Date.now() };
  await db.exercicios.put(novo);
  return novo;
}

export async function removerExercicio(id: string): Promise<void> {
  await db.exercicios.delete(id);
}

// ---- Fome e pratos avulsos ----

/** "Estou com fome" agora: grava o horário (o dia é o de agora, não o navegado no painel). */
export async function registrarFome(intensidade: RegistroFome['intensidade'] = 2): Promise<RegistroFome> {
  const agora = Date.now();
  const novo: RegistroFome = { id: novoId(), dia: chaveDia(new Date(agora)), hora: agora, intensidade, criadoEm: agora };
  await db.fome.put(novo);
  return novo;
}

export async function removerFome(id: string): Promise<void> {
  await db.fome.delete(id);
}

/** Guarda (ou atualiza, pelo nome) um prato fora do acervo para a busca achar depois. */
export async function salvarPrato(prato: Omit<PratoSalvo, 'id' | 'criadoEm'>): Promise<PratoSalvo> {
  const mesmoNome = await db.pratos.where('nome').equals(prato.nome).first();
  const salvo: PratoSalvo = { ...prato, id: mesmoNome?.id ?? novoId(), criadoEm: Date.now() };
  await db.pratos.put(salvo);
  return salvo;
}

export async function removerConsumo(id: string): Promise<void> {
  await db.consumo.delete(id);
}

/** Troca a quantidade de porções de um registro, recalculando os nutrientes na proporção. */
export async function ajustarPorcoesConsumo(id: string, porcoes: number): Promise<void> {
  const atual = await db.consumo.get(id);
  if (!atual || porcoes <= 0) return;
  const fator = porcoes / (atual.porcoes || 1);
  const n = atual.nutrientes;
  await db.consumo.put({
    ...atual,
    porcoes,
    nutrientes: {
      kcal: n.kcal * fator,
      gorduraTotal: n.gorduraTotal * fator,
      gorduraSaturada: n.gorduraSaturada * fator,
      colesterolMg: n.colesterolMg * fator,
      carboidrato: n.carboidrato * fator,
      acucares: n.acucares * fator,
      proteina: n.proteina * fator,
      fibra: n.fibra * fator,
    },
  });
}

/** Apaga tudo que foi registrado num dia (o botão "limpar" do painel). */
export async function limparConsumoDoDia(dia: string): Promise<number> {
  return db.consumo.where('dia').equals(dia).delete();
}

/**
 * Desconta da despensa o que uma refeição registrada consumiu (ver lib/baixaDespensa.ts).
 * Devolve os itens como estavam antes, para o "Desfazer" do aviso, e quantos mudaram.
 */
export async function baixarDespensaPorConsumo(
  recipe: Recipe,
  porcoes: number,
): Promise<{ anteriores: GeladeiraItem[]; alterados: number }> {
  const despensa = await db.geladeira.toArray();
  const fator = porcoes / (recipe.rendimentoBase.valor || 1);
  const { atualizar, remover } = baixaPorConsumo(recipe.ingredientes, fator, despensa);
  const mexidos = new Set([...atualizar.map((g) => g.itemKey), ...remover]);
  const anteriores = despensa.filter((g) => mexidos.has(g.itemKey));
  if (mexidos.size === 0) return { anteriores, alterados: 0 };
  await db.transaction('rw', db.geladeira, async () => {
    if (atualizar.length > 0) await db.geladeira.bulkPut(atualizar);
    if (remover.length > 0) await db.geladeira.bulkDelete(remover);
  });
  return { anteriores, alterados: mexidos.size };
}

/** Devolve à despensa itens como estavam (o "Desfazer" da baixa automática). */
export async function restaurarNaDespensa(itens: GeladeiraItem[]): Promise<void> {
  if (itens.length > 0) await db.geladeira.bulkPut(itens);
}

// ---- Peso corporal ----

/** Grava o peso do dia (um por dia: registrar de novo no mesmo dia substitui). */
export async function registrarPeso(dia: string, kg: number): Promise<void> {
  await db.pesos.put({ dia, kg, criadoEm: Date.now() });
}

export async function removerPeso(dia: string): Promise<void> {
  await db.pesos.delete(dia);
}

// ---- Códigos de barras ----

/** Guarda a associação código de barras -> ingrediente, para a próxima leitura ser instantânea. */
export async function salvarCodigoBarras(codigo: string, nome: string, marca?: string): Promise<CodigoBarras> {
  const registro: CodigoBarras = {
    codigo,
    itemKey: normalizeItemKey(nome),
    nome: nome.trim(),
    ...(marca ? { marca } : {}),
    atualizadoEm: Date.now(),
  };
  await db.codigos.put(registro);
  return registro;
}

export async function buscarCodigoBarras(codigo: string): Promise<CodigoBarras | undefined> {
  return db.codigos.get(codigo);
}
