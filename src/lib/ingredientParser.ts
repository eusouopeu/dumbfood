// Parser heurístico de ingredientes em português.
// "2 xícaras de farinha de trigo" -> { quantidade: 2, unidade: 'xicara', item: 'farinha de trigo' }

import type { Ingredient } from '../types';
import { UNIT_PHRASES, lookupUnit } from './units';
import { resolveGondola } from './aisles';

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meia: 0.5, meio: 0.5,
  'meia-duzia': 6, duzia: 12,
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅛': 0.125,
};

const NO_QTY_MARKERS = [
  'a gosto', 'a vontade', 'à vontade', 'q.b.', 'quanto baste', 'o quanto baste',
];

/** Preposições/artigos que podem aparecer entre a quantidade e a unidade, ou antes do item. */
const CONECTIVOS = ['de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'o', 'a'];

/** Remove acentos e normaliza para comparação. */
export function deburr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Uniformiza grafias de medida antes do parse, para que o dicionário de unidades case:
 *  - "colher (sopa)"  -> "colher de sopa"   (o qualificador está no dicionário)
 *  - "xícara (chá)"   -> "xícara"           (não há xícara de café/chá distintas aqui)
 *  - "copo (americano)" -> "copo"
 */
function normalizarGrafiaMedida(texto: string): string {
  return texto
    .replace(/\b(colher(?:es)?)\s*\(\s*(sopa|ch[áa]|sobremesa|caf[ée])\s*\)/gi, '$1 de $2')
    .replace(/\b(x[íi]cara(?:s)?)\s*\(\s*(?:ch[áa]|caf[ée])\s*\)/gi, '$1')
    // `\b` não serve depois de "chá"/"café": em JS o acento já não é caractere de palavra.
    .replace(/\b(x[íi]cara(?:s)?)\s+de\s+(?:ch[áa]|caf[ée])(?=\s|$)/gi, '$1')
    .replace(/\b(copo(?:s)?)\s*\(\s*(?:americano|requeij[ãa]o|duplo)\s*\)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Consome a quantidade no início do texto. Retorna [quantidade|null, resto]. */
function parseQuantity(text: string): [number | null, string] {
  const rest = text.trim();

  // Fração unicode logo no início (ex.: "½ xícara").
  const uni = rest[0];
  if (UNICODE_FRACTIONS[uni] !== undefined) {
    return [UNICODE_FRACTIONS[uni], rest.slice(1).trim()];
  }

  // "3 e 1/2", "3 e ½", "1 e meia" -> inteiro + fração/palavra.
  const comE = rest.match(/^(\d+)\s+e\s+(\d+\s*\/\s*\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅛]|meia|meio)/i);
  if (comE) {
    const inteiro = Number(comE[1]);
    const parte = comE[2].toLowerCase();
    let fracVal: number;
    if (/^\d/.test(parte)) {
      const [a, b] = parte.split('/').map((x) => Number(x.trim()));
      fracVal = a / b;
    } else if (UNICODE_FRACTIONS[parte] !== undefined) {
      fracVal = UNICODE_FRACTIONS[parte];
    } else {
      fracVal = 0.5; // "meia"/"meio"
    }
    return [inteiro + fracVal, rest.slice(comE[0].length).trim()];
  }

  // Número misto "1 1/2" ou fração "1/2".
  const mixed = rest.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const val = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return [val, rest.slice(mixed[0].length).trim()];
  }
  const frac = rest.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const val = Number(frac[1]) / Number(frac[2]);
    return [val, rest.slice(frac[0].length).trim()];
  }

  // Decimal com vírgula ou ponto, aceitando faixas "2 a 3" / "2-3" (usa o primeiro).
  const dec = rest.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:a|-|até|ou)\s*\d+(?:[.,]\d+)?)?/);
  if (dec) {
    const val = Number(dec[1].replace(',', '.'));
    if (!Number.isNaN(val)) return [val, rest.slice(dec[0].length).trim()];
  }

  // Número por extenso.
  const firstWord = deburr(rest.split(/\s+/)[0] ?? '').toLowerCase();
  if (NUMBER_WORDS[firstWord] !== undefined) {
    return [NUMBER_WORDS[firstWord], rest.slice(rest.split(/\s+/)[0].length).trim()];
  }

  return [null, rest];
}

/**
 * Consome a unidade no início do texto (após a quantidade), tolerando uma preposição
 * ou artigo no meio — "3/4 **de** xícara de óleo", "1/2 **de um** copo de leite".
 * Sem isso a unidade se perdia e o ingrediente virava contagem ("3/4 un xícara de óleo").
 */
function parseUnit(text: string): [string | null, string] {
  const tentar = (candidato: string): [string, string] | null => {
    const deburred = deburr(candidato).toLowerCase();
    for (const phrase of UNIT_PHRASES) {
      // Casa a frase da unidade seguida de limite de palavra.
      if (deburred === phrase || deburred.startsWith(phrase + ' ')) {
        const def = lookupUnit(phrase);
        if (!def) continue;
        return [def.canonical, candidato.slice(phrase.length).trim()];
      }
    }
    return null;
  };

  const direto = tentar(text);
  if (direto) return direto;

  // Pula até dois conectivos ("de", "de um"...) antes de tentar de novo.
  let resto = text;
  for (let i = 0; i < 2; i++) {
    const m = resto.match(/^(\w+)\s+/);
    if (!m || !CONECTIVOS.includes(deburr(m[1]).toLowerCase())) break;
    resto = resto.slice(m[0].length);
    const comSalto = tentar(resto);
    if (comSalto) return comSalto;
  }

  return [null, text];
}

/**
 * Termos que descrevem *como* o ingrediente é usado ou preparado, e não o ingrediente em si.
 * Removê-los evita que "cenouras médias" e "cenouras" virem duas linhas na lista de mercado.
 */
const DESCRITORES = [
  // preparo / corte
  'bem picad[oa]s?', 'finamente picad[oa]s?', 'grosseiramente picad[oa]s?',
  'picadinh[oa]s?', 'picad[oa]s?', 'ralad[oa]s?', 'fatiad[oa]s?', 'cortad[oa]s?',
  'cozid[oa]s?', 'assad[oa]s?', 'refogad[oa]s?', 'desfiad[oa]s?', 'amassad[oa]s?', 'esmagad[oa]s?',
  'derretid[oa]s?', 'batid[oa]s?', 'peneirad[oa]s?', 'escorrid[oa]s?', 'lavad[oa]s?', 'descascad[oa]s?',
  'temperad[oa]s?', 'mo[íi]d[oa]s?', 'triturad[oa]s?', 'torrad[oa]s?', 'gelad[oa]s?',
  'quentes?', 'morn[oa]s?', 'madur[oa]s?',
  'em cubos', 'em rodelas', 'em tiras', 'em fatias', 'em peda[çc]os', 'em lascas',
  // tamanho / qualificadores vagos
  'm[ée]di[oa]s?', 'grandes?', 'pequen[oa]s?', 'graúd[oa]s?', 'graud[oa]s?', 'inteir[oa]s?',
  'aproximadamente', 'aproximad[oa]s?',
  // estado de conservação / temperatura
  'em temperatura ambiente', 'à temperatura ambiente', 'a temperatura ambiente',
  'sem pele', 'sem sementes', 'sem casca', 'sem osso', 'com casca', 'na hora',
];

/** Finalidades culinárias que não fazem parte do nome do ingrediente. */
const FINALIDADES =
  /\s+(?:para|pra)\s+(?:untar|polvilhar|enfarinhar|servir|decorar|acompanhar|finalizar|pincelar|fritar|regar|guarnecer|a\s+f[ôo]rma|a\s+forma|o\s+molho|a\s+massa|a\s+cobertura|o\s+recheio)\b[\s\S]*$/i;

const DESCRITOR_RE = new RegExp(`\\b(?:${DESCRITORES.join('|')})\\b`, 'gi');

/** Limpa o nome do item para servir de chave de agregação e exibição. */
export function cleanItem(text: string): string {
  let s = text.trim();
  s = s.replace(/\([^)]*\)/g, ' '); // remove parênteses ANTES de olhar a preposição inicial
  s = s.split(/,|;| - | – /)[0]; // descarta notas após vírgula/traço ("cebola, picada")
  // Fica só com a primeira alternativa/oração: "achocolatado ou 4 colheres de chocolate",
  // "água até a metade da panela", "filé de frango não usar com osso".
  s = s.split(/\s+(?:ou|at[ée]|se|quando|n[ãa]o)\s+/i)[0];
  s = s.replace(FINALIDADES, ' '); // "farinha para untar a fôrma" -> "farinha"
  s = s.replace(DESCRITOR_RE, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // A preposição só cai depois: "(chá) de óleo" precisa virar "óleo", não "de óleo".
  s = s.replace(/^(?:de|do|da|dos|das|o|a|os|as|um|uma)\s+/i, '');
  s = s.replace(/[.;:!?]+\s*$/, ''); // pontuação final de listas em blogs ("150 ml de óleo.")
  s = s.replace(/\s+(?:de|do|da|com|e|para)$/i, ''); // sobra pendurada no fim
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

/**
 * Divide uma linha que enumera dois ingredientes ("manteiga e farinha de trigo para untar",
 * "sal e pimenta a gosto") em linhas separadas — senão o par vira um item só na lista de
 * mercado e nunca soma com a manteiga/o sal das outras receitas.
 * Conservador de propósito: só divide quando não há quantidade numérica e os dois lados
 * são nomes curtos.
 */
function dividirComposto(item: string): string[] {
  const partes = item.split(/\s+e\s+/);
  if (partes.length !== 2) return [item];
  const limpas = partes.map((p) => p.trim()).filter(Boolean);
  if (limpas.length !== 2) return [item];
  if (limpas.some((p) => p.split(/\s+/).length > 3)) return [item];
  return limpas;
}

/** Singulariza uma palavra em português (heurística simples). */
function singularizar(word: string): string {
  if (word.length <= 3) return word;
  const d = deburr(word);
  if (d.endsWith('oes') || d.endsWith('aes')) return word.slice(0, -3) + 'ao';
  if (d.endsWith('ais')) return word.slice(0, -3) + 'al';
  if (d.endsWith('eis')) return word.slice(0, -3) + 'el';
  if (d.endsWith('ois')) return word.slice(0, -3) + 'ol';
  if (d.endsWith('ns')) return word.slice(0, -2) + 'm';
  if (d.endsWith('res') || d.endsWith('zes') || d.endsWith('ses')) return word.slice(0, -2);
  if (d.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Chave canônica de agregação: sem acento, minúscula e singularizada. */
export function normalizeItemKey(item: string): string {
  return deburr(item)
    .toLowerCase()
    .split(/\s+/)
    .map(singularizar)
    .join(' ')
    .trim();
}

/** Faz o parse de uma linha em um ou mais ingredientes (linhas compostas viram vários). */
export function parseIngredientes(raw: string): Ingredient[] {
  const original = raw.trim();
  const normalizado = normalizarGrafiaMedida(original);
  const lowerDeburred = deburr(normalizado).toLowerCase();

  // "a gosto" e afins: sem quantidade.
  const isNoQty = NO_QTY_MARKERS.some((m) => lowerDeburred.includes(deburr(m)));

  const [quantidade, afterQty] = parseQuantity(normalizado);
  const [unidade, afterUnit] = quantidade !== null ? parseUnit(afterQty) : [null, afterQty];

  let itemText = afterUnit;
  // Remove marcadores "a gosto" do nome do item.
  for (const m of NO_QTY_MARKERS) {
    const re = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    itemText = itemText.replace(re, ' ');
  }
  const item = cleanItem(itemText) || cleanItem(normalizado);

  // Só divide "X e Y" quando a linha não traz quantidade — com quantidade não dá
  // para saber quanto vai de cada um.
  const nomes = quantidade === null ? dividirComposto(item) : [item];

  return nomes.map((nome) => ({
    raw: original,
    quantidade: isNoQty ? null : quantidade,
    unidade,
    item: nome,
    gondola: resolveGondola(nome),
  }));
}

/** Faz o parse de uma linha em um único ingrediente (o primeiro, se a linha for composta). */
export function parseIngredient(raw: string): Ingredient {
  return parseIngredientes(raw)[0];
}

export function parseIngredientLines(lines: string[]): Ingredient[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .flatMap(parseIngredientes);
}

/**
 * Reprocessa um ingrediente já salvo, a partir do texto original, com o parser atual.
 * Usado na migração do banco (ver db.ts) para corrigir duas heranças:
 *  - nomes com sobra de preposição e adjetivo ("de óleo", "cenouras médias"), que
 *    apareciam como "De óleo" e ainda duplicavam linhas na lista de mercado;
 *  - unidade perdida quando a receita escrevia "3/4 **de** xícara" e o item virava contagem.
 *
 * A quantidade salva é preservada: ela nunca foi afetada por esses bugs, e pode ter sido
 * reescalada de propósito pelo usuário depois da importação.
 */
export function reprocessarIngrediente(ing: Ingredient): Ingredient {
  if (!ing?.raw) return ing;
  const novo = parseIngredient(ing.raw);
  return {
    ...ing,
    item: novo.item || ing.item,
    gondola: novo.item ? novo.gondola : ing.gondola,
    unidade: ing.unidade ?? novo.unidade,
  };
}

/** Divide um bloco de texto colado em linhas de ingredientes. */
export function parseIngredientBlock(block: string): Ingredient[] {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*·–]\s*/, '').trim())
    .filter(Boolean);
  return parseIngredientLines(lines);
}
