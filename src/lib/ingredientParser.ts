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

/** Remove acentos e normaliza para comparação. */
export function deburr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Consome a quantidade no início do texto. Retorna [quantidade|null, resto]. */
function parseQuantity(text: string): [number | null, string] {
  let rest = text.trim();

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

/** Consome a unidade no início do texto (após a quantidade). */
function parseUnit(text: string): [string | null, string] {
  const deburred = deburr(text).toLowerCase();
  for (const phrase of UNIT_PHRASES) {
    // Casa a frase da unidade seguida de limite de palavra.
    if (deburred === phrase || deburred.startsWith(phrase + ' ')) {
      const def = lookupUnit(phrase);
      const consumed = text.slice(phrase.length);
      return [def ? def.canonical : null, consumed.trim()];
    }
  }
  return [null, text];
}

/** Limpa o nome do item para servir de chave de agregação e exibição. */
export function cleanItem(text: string): string {
  let s = text.trim();
  s = s.replace(/^(de|do|da|dos|das)\s+/i, ''); // preposição após unidade
  s = s.replace(/\([^)]*\)/g, ' '); // remove parênteses
  s = s.split(/,|;| - /)[0]; // descarta notas após vírgula/traço ("cebola, picada")
  s = s.replace(/\b(picad[oa]s?|ralad[oa]s?|em cubos|fatiad[oa]s?|em rodelas|bem picad[oa]s?|finamente picad[oa]s?)\b/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
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

export function parseIngredient(raw: string): Ingredient {
  const original = raw.trim();
  const lowerDeburred = deburr(original).toLowerCase();

  // "a gosto" e afins: sem quantidade.
  const isNoQty = NO_QTY_MARKERS.some((m) => lowerDeburred.includes(deburr(m)));

  const [quantidade, afterQty] = parseQuantity(original);
  const [unidade, afterUnit] = quantidade !== null ? parseUnit(afterQty) : [null, afterQty];

  let itemText = afterUnit;
  // Remove marcadores "a gosto" do nome do item.
  for (const m of NO_QTY_MARKERS) {
    const re = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    itemText = itemText.replace(re, ' ');
  }
  const item = cleanItem(itemText) || cleanItem(original);

  return {
    raw: original,
    quantidade: isNoQty ? null : quantidade,
    unidade,
    item,
    gondola: resolveGondola(item),
  };
}

export function parseIngredientLines(lines: string[]): Ingredient[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseIngredient);
}

/** Divide um bloco de texto colado em linhas de ingredientes. */
export function parseIngredientBlock(block: string): Ingredient[] {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*·–]\s*/, '').trim())
    .filter(Boolean);
  return parseIngredientLines(lines);
}
