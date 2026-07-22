// Extrai uma receita a partir do HTML de uma página, usando schema.org/Recipe (JSON-LD).
// Puro (sem rede), para ser testável e reutilizável no servidor.

import type { NewRecipe, RecipeYield, YieldType } from '../types';
import { parseIngredientLines } from './ingredientParser';
import { decodeEntities } from './decodeEntities';
import { gerarTags } from './tags';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Extrai todos os blocos <script type="application/ld+json"> do HTML. */
function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Tenta limpar comentários/HTML entities comuns antes de desistir.
      try {
        blocks.push(JSON.parse(raw.replace(/<!--[\s\S]*?-->/g, '').trim()));
      } catch {
        /* ignora bloco inválido */
      }
    }
  }
  return blocks;
}

function typeIncludes(node: any, wanted: string): boolean {
  const t = node?.['@type'];
  if (!t) return false;
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === wanted);
  return String(t).toLowerCase() === wanted;
}

/** Procura recursivamente um nó Recipe em qualquer estrutura JSON-LD. */
function findRecipeNode(data: any): any | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeIncludes(data, 'recipe')) return data;
  if (Array.isArray(data['@graph'])) {
    const found = findRecipeNode(data['@graph']);
    if (found) return found;
  }
  return null;
}

function firstString(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstString(value[0]);
  if (typeof value === 'object') return value.url ?? value.text ?? value.name;
  return undefined;
}

function parseYield(value: any): RecipeYield {
  const raw = Array.isArray(value) ? value.find((v) => v != null) : value;
  const str = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '';
  const numMatch = str.match(/\d+/);
  const valor = numMatch ? Number(numMatch[0]) : 1;
  let tipo: YieldType = 'porcoes';
  const low = str.toLowerCase();
  if (/pessoa/.test(low)) tipo = 'pessoas';
  else if (/unidade|fatia/.test(low)) tipo = 'unidades';
  return { valor: valor > 0 ? valor : 1, tipo };
}

function parseInstructions(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return decodeEntities(value)
      .split(/\r?\n|\.\s+(?=[A-ZÀ-Ú])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
  }
  if (Array.isArray(value)) {
    const steps: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') steps.push(item.trim());
      else if (item?.['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
        for (const sub of item.itemListElement) {
          const t = firstString(sub?.text ?? sub);
          if (t) steps.push(t.trim());
        }
      } else {
        const t = firstString(item?.text ?? item?.name ?? item);
        if (t) steps.push(t.trim());
      }
    }
    return steps.map((s) => decodeEntities(s)).filter((s) => s.length > 0);
  }
  return [];
}

/** Converte duração ISO 8601 (ex.: "PT1H30M") em minutos. */
function parseIsoDurationMin(value: any): number | undefined {
  const s = Array.isArray(value) ? value.find((v) => typeof v === 'string') : value;
  if (typeof s !== 'string') return undefined;
  const m = s.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return undefined;
  const horas = m[1] ? Number(m[1]) : 0;
  const min = m[2] ? Number(m[2]) : 0;
  const total = horas * 60 + min;
  return total > 0 ? total : undefined;
}

/** Constrói uma NewRecipe a partir do HTML; retorna null se não achar receita. */
export function parseRecipeFromHtml(html: string, fonteUrl?: string): NewRecipe | null {
  const blocks = extractJsonLdBlocks(html);
  let node: any = null;
  for (const b of blocks) {
    node = findRecipeNode(b);
    if (node) break;
  }
  if (!node) return null;

  const titulo = decodeEntities(firstString(node.name) ?? 'Receita sem título');
  const imagem = firstString(node.image);
  const ingredienteRaw: string[] = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient.map((x: any) => decodeEntities(String(x)))
    : Array.isArray(node.ingredients)
      ? node.ingredients.map((x: any) => decodeEntities(String(x)))
      : [];

  if (ingredienteRaw.length === 0) return null;

  const ingredientes = parseIngredientLines(ingredienteRaw);

  return {
    titulo: titulo.trim(),
    fonteUrl,
    imagem,
    rendimentoBase: parseYield(node.recipeYield ?? node.yield),
    ingredientes,
    modoPreparo: parseInstructions(node.recipeInstructions),
    tags: gerarTags(titulo, ingredientes),
    tempoPreparoMin: parseIsoDurationMin(node.totalTime ?? node.cookTime ?? node.prepTime),
  };
}
