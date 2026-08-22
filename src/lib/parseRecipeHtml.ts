// Extrai uma receita a partir do HTML de uma página, usando schema.org/Recipe (JSON-LD).
// Puro (sem rede), para ser testável e reutilizável no servidor.

import type { NewRecipe, RecipeYield, SecaoPreparo, YieldType } from '../types';
import { parseIngredientLines } from './ingredientParser';
import { decodeEntities } from './decodeEntities';
import { gerarTags } from './tags';
import { parseRecipeFromDom, extrairRendimentoDoHtml, extrairTempoDoHtml } from './parseRecipeDom';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extrai todos os blocos <script type="application/ld+json"> do HTML. O valor do
 * atributo pode vir sem aspas (ex.: Panelinha usa `type=application/ld+json`), então
 * as aspas em volta de "application/ld+json" são opcionais.
 */
function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
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

/**
 * Achata `recipeInstructions` em uma lista de passos.
 *
 * O formato varia bastante entre os sites: string única, array de strings, HowToStep
 * com `text`, HowToSection com `itemListElement`, e — como no Panelinha — HowToStep
 * cujo texto fica dentro de um `itemListElement` que é um objeto só, não um array.
 * Por isso a descida é recursiva em vez de um punhado de casos especiais.
 */
function parseInstructions(value: any): string[] {
  if (!value) return [];

  if (typeof value === 'string') {
    return decodeEntities(value)
      .split(/\r?\n|\.\s+(?=[A-ZÀ-Ú])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => parseInstructions(item));
  }

  if (typeof value === 'object') {
    if (value.itemListElement) return parseInstructions(value.itemListElement);
    const texto = firstString(value.text ?? value.name ?? value.description);
    if (texto) {
      const limpo = decodeEntities(texto).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return limpo.length > 2 ? [limpo] : [];
    }
  }

  return [];
}

/**
 * Separa o preparo em partes quando o site publica HowToSection (uma seção por etapa
 * da receita: massa, recheio, cobertura). Devolve [] quando não há seções — aí o preparo
 * é uma lista só.
 */
function parseInstructionSections(value: any): SecaoPreparo[] {
  const nos = Array.isArray(value) ? value : [value];
  const secoes: SecaoPreparo[] = [];
  for (const no of nos) {
    if (!no || typeof no !== 'object' || !typeIncludes(no, 'howtosection')) continue;
    const passos = parseInstructions(no.itemListElement ?? no.steps);
    if (passos.length === 0) continue;
    secoes.push({ titulo: decodeEntities(firstString(no.name) ?? '').trim(), passos });
  }
  return secoes.length > 1 || (secoes.length === 1 && secoes[0].titulo) ? secoes : [];
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

/**
 * Última tentativa quando não há JSON-LD de receita: lê ingredientes e preparo
 * direto da marcação (Panelinha, Panelaterapia e blogs em geral).
 */
function parseViaMarcacao(html: string, fonteUrl?: string): NewRecipe | null {
  const dom = parseRecipeFromDom(html);
  if (dom.ingredientes.length === 0) return null;

  const titulo = (dom.titulo ?? 'Receita sem título').trim();
  const ingredientes = parseIngredientLines(dom.ingredientes);
  if (ingredientes.length === 0) return null;

  return {
    titulo,
    fonteUrl,
    imagem: dom.imagem,
    rendimentoBase: dom.rendimento,
    ingredientes,
    modoPreparo: dom.modoPreparo,
    ...(dom.secoesPreparo.length > 0 ? { secoesPreparo: dom.secoesPreparo } : {}),
    tags: gerarTags(titulo, ingredientes),
    tempoPreparoMin: extrairTempoDoHtml(html),
  };
}

/** Constrói uma NewRecipe a partir do HTML; retorna null se não achar receita. */
export function parseRecipeFromHtml(html: string, fonteUrl?: string): NewRecipe | null {
  const blocks = extractJsonLdBlocks(html);
  let node: any = null;
  for (const b of blocks) {
    node = findRecipeNode(b);
    if (node) break;
  }
  if (!node) return parseViaMarcacao(html, fonteUrl);

  const titulo = decodeEntities(firstString(node.name) ?? 'Receita sem título');
  const imagem = firstString(node.image);
  const ingredienteRaw: string[] = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient.map((x: any) => decodeEntities(String(x)))
    : Array.isArray(node.ingredients)
      ? node.ingredients.map((x: any) => decodeEntities(String(x)))
      : [];

  // Há sites que declaram Recipe mas deixam recipeIngredient vazio (a lista fica só no HTML).
  if (ingredienteRaw.length === 0) return parseViaMarcacao(html, fonteUrl);

  const ingredientes = parseIngredientLines(ingredienteRaw);

  // Se o JSON-LD não trouxer o preparo em formato reconhecível, tenta a marcação —
  // é melhor importar a receita com os passos do HTML do que sem passo nenhum.
  const modoPreparo = parseInstructions(node.recipeInstructions);
  const secoesPreparo = parseInstructionSections(node.recipeInstructions);

  // Alguns sites (ex.: Panelinha) publicam Recipe em JSON-LD sem recipeYield/totalTime —
  // esses dados só aparecem na marcação visível da página ("Tempo de preparo", "Serve").
  const rendimentoLd = node.recipeYield ?? node.yield;
  const rendimentoBase = rendimentoLd ? parseYield(rendimentoLd) : (extrairRendimentoDoHtml(html) ?? parseYield(undefined));
  const tempoPreparoMin =
    parseIsoDurationMin(node.totalTime ?? node.cookTime ?? node.prepTime) ?? extrairTempoDoHtml(html);

  // Sem preparo utilizável no JSON-LD, a marcação da página é a fonte — e é lá que
  // ficam as partes separadas das receitas de duas etapas (massa + recheio).
  const doDom = modoPreparo.length > 0 ? null : parseRecipeFromDom(html);
  const secoes = secoesPreparo.length > 0 ? secoesPreparo : (doDom?.secoesPreparo ?? []);

  return {
    titulo: titulo.trim(),
    fonteUrl,
    imagem,
    rendimentoBase,
    ingredientes,
    modoPreparo: doDom ? doDom.modoPreparo : modoPreparo,
    ...(secoes.length > 0 ? { secoesPreparo: secoes } : {}),
    tags: gerarTags(titulo, ingredientes),
    tempoPreparoMin,
  };
}
