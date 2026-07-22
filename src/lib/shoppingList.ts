// Gera a lista de mercado unificada a partir de um plano da semana.
// Soma ingredientes em comum (por unidade compatível) e agrupa por gôndola.

import type { Ingredient, Recipe, ShoppingLine, ShoppingSection, WeekPlan } from '../types';
import { GONDOLA_ORDER } from './aisles';
import { normalizeItemKey } from './ingredientParser';
import { scaleIngredients, round } from './scale';
import { unitDefByCanonical } from './units';
import { padronizarMedida } from './measures';
import { formatQtdUnidade } from './displayQty';

const COUNT_KEY = '__count__';
const AGOSTO_KEY = '__agosto__';

interface Bucket {
  item: string;
  gondola: string;
  origens: Set<string>;
  // chave de unidade -> soma acumulada (na unidade base da chave)
  grupos: Map<string, { unidadeCanonica: string | null; base: string; soma: number | null }>;
}

/** Reduz o plano + receitas a linhas de compra somadas e agrupadas por gôndola. */
export function buildShoppingList(plan: WeekPlan, recipes: Map<string, Recipe>): ShoppingSection[] {
  const buckets = new Map<string, Bucket>();

  for (const planItem of plan.itens) {
    const recipe = recipes.get(planItem.recipeId);
    if (!recipe) continue;
    const escalados = scaleIngredients(recipe.ingredientes, planItem.fator);
    for (const ing of escalados) {
      acumular(buckets, ing, recipe.titulo);
    }
  }

  // Monta linhas e agrupa por gôndola.
  const porGondola = new Map<string, ShoppingLine[]>();
  for (const bucket of buckets.values()) {
    const linha = bucketParaLinha(bucket);
    const arr = porGondola.get(bucket.gondola) ?? [];
    arr.push(linha);
    porGondola.set(bucket.gondola, arr);
  }

  // Ordena seções conforme GONDOLA_ORDER; itens alfabeticamente.
  const sections: ShoppingSection[] = [];
  for (const gondola of GONDOLA_ORDER) {
    const linhas = porGondola.get(gondola);
    if (!linhas || linhas.length === 0) continue;
    linhas.sort((a, b) => a.item.localeCompare(b.item, 'pt-BR'));
    sections.push({ gondola, linhas });
  }
  return sections;
}

function acumular(buckets: Map<string, Bucket>, ing: Ingredient, origem: string) {
  const key = normalizeItemKey(ing.item);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { item: ing.item, gondola: ing.gondola, origens: new Set(), grupos: new Map() };
    buckets.set(key, bucket);
  }
  bucket.origens.add(origem);

  // A lista de mercado sempre exibe em g/L e unidades: medidas de cozinha (xícara, colher...)
  // com densidade conhecida são convertidas para métrico antes de somar.
  const metrico = padronizarMedida(ing.item, ing.quantidade, ing.unidade, 'metrico');
  const quantidade = metrico.quantidade;
  const unidade = metrico.unidade;

  // Determina a chave/base do grupo de unidade.
  let grupoKey: string;
  let unidadeCanonica: string | null;
  let base: string;
  let valorNaBase: number | null;

  if (quantidade === null) {
    grupoKey = AGOSTO_KEY;
    unidadeCanonica = unidade;
    base = AGOSTO_KEY;
    valorNaBase = null;
  } else if (unidade === null) {
    grupoKey = COUNT_KEY;
    unidadeCanonica = null;
    base = COUNT_KEY;
    valorNaBase = quantidade;
  } else {
    const def = unitDefByCanonical(unidade);
    if (def && (def.dimension === 'massa' || def.dimension === 'volume')) {
      grupoKey = def.base;
      unidadeCanonica = def.base;
      base = def.base;
      valorNaBase = quantidade * def.toBase;
    } else {
      grupoKey = unidade;
      unidadeCanonica = unidade;
      base = unidade;
      valorNaBase = quantidade;
    }
  }

  const grupo = bucket.grupos.get(grupoKey);
  if (!grupo) {
    bucket.grupos.set(grupoKey, { unidadeCanonica, base, soma: valorNaBase });
  } else if (grupo.soma !== null && valorNaBase !== null) {
    grupo.soma = round(grupo.soma + valorNaBase);
  }
}

function bucketParaLinha(bucket: Bucket): ShoppingLine {
  const quantidades: ShoppingLine['quantidades'] = [];
  const partes: string[] = [];

  for (const grupo of bucket.grupos.values()) {
    if (grupo.base === AGOSTO_KEY) {
      quantidades.push({ unidade: grupo.unidadeCanonica, quantidade: null });
      partes.push('a gosto');
      continue;
    }
    if (grupo.base === COUNT_KEY) {
      const q = grupo.soma;
      quantidades.push({ unidade: null, quantidade: q });
      partes.push(formatQtdUnidade(q, null));
      continue;
    }
    // Massa/volume: promove para kg/l quando grande.
    let unidade = grupo.unidadeCanonica;
    let valor = grupo.soma ?? 0;
    if (grupo.base === 'g' && valor >= 1000) {
      unidade = 'kg';
      valor = round(valor / 1000);
    } else if (grupo.base === 'ml' && valor >= 1000) {
      unidade = 'l';
      valor = round(valor / 1000);
    }
    quantidades.push({ unidade, quantidade: valor });
    partes.push(formatQtdUnidade(valor, unidade));
  }

  return {
    item: bucket.item,
    gondola: bucket.gondola,
    quantidades,
    rotulo: partes.join(' + '),
    origens: Array.from(bucket.origens),
  };
}

/** Resume uma linha em peso (g) e contagem (unidades), quando aplicável a cada grupo. */
export function resumoLinha(linha: ShoppingLine): { gramas: number | null; unidades: number | null } {
  let gramas = 0;
  let achouGramas = false;
  let unidades = 0;
  let achouUnidades = false;
  for (const q of linha.quantidades) {
    if (q.quantidade === null) continue;
    if (q.unidade === 'g') { gramas += q.quantidade; achouGramas = true; }
    else if (q.unidade === 'kg') { gramas += q.quantidade * 1000; achouGramas = true; }
    else if (q.unidade === 'ml') { gramas += q.quantidade; achouGramas = true; }
    else if (q.unidade === 'l') { gramas += q.quantidade * 1000; achouGramas = true; }
    else if (q.unidade === null) { unidades += q.quantidade; achouUnidades = true; }
  }
  return { gramas: achouGramas ? round(gramas) : null, unidades: achouUnidades ? unidades : null };
}

/**
 * Peso total das seções em kg, tratando 1 L como 1 kg e desconsiderando medidas sem peso
 * conhecido (pitada, fio, gota) e itens comprados por contagem/embalagem.
 */
export function pesoTotalKg(sections: ShoppingSection[]): number {
  let totalG = 0;
  for (const s of sections) {
    for (const l of s.linhas) {
      const { gramas } = resumoLinha(l);
      if (gramas !== null) totalG += gramas;
    }
  }
  return round(totalG / 1000);
}
