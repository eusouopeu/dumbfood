// Ajuste de receita em lote para uma restrição alimentar (vegano, sem lactose, sem
// glúten, sem ovo): identifica de uma vez todos os ingredientes que violam a
// restrição e propõe uma troca específica pra ela — diferente de `substitutions.ts`,
// que sugere trocas genéricas por falta de item em casa, aqui a troca é escolhida
// para não reintroduzir o que está sendo evitado (ex.: "manteiga" vira "margarina
// vegana" no modo vegano, mas "manteiga sem lactose" no modo sem lactose).

import { normalizeItemKey } from './ingredientParser';
import { resolveGondola } from './aisles';
import { formatQtdUnidade } from './displayQty';
import type { Ingredient } from '../types';

export type Restricao = 'vegano' | 'vegetariano' | 'sem_lactose' | 'sem_gluten' | 'sem_ovo';

export const RESTRICOES: { valor: Restricao; label: string; tag: string }[] = [
  { valor: 'vegano', label: 'Vegano', tag: 'vegano' },
  { valor: 'vegetariano', label: 'Vegetariano', tag: 'vegetariano' },
  { valor: 'sem_lactose', label: 'Sem lactose', tag: 'sem lactose' },
  { valor: 'sem_gluten', label: 'Sem glúten', tag: 'sem glúten' },
  { valor: 'sem_ovo', label: 'Sem ovo', tag: 'sem ovo' },
];

/** item normalizado -> substituto sugerido para aquela restrição específica. */
const TABELAS: Record<Restricao, Record<string, string>> = {
  vegano: {
    'leite': 'leite vegetal (soja, aveia ou amêndoas)',
    'leite integral': 'leite vegetal (soja, aveia ou amêndoas)',
    'leite condensado': 'leite condensado de coco (vegano)',
    'manteiga': 'margarina vegana',
    'creme de leite': 'creme de leite vegetal (ou de castanha de caju)',
    'requeijao': 'requeijão vegano',
    'queijo': 'queijo vegetal',
    'queijo parmesao': 'queijo vegetal ralado',
    'queijo mussarela': 'queijo vegetal fatiado',
    'iogurte natural': 'iogurte de soja ou coco',
    'ovo': 'linhaça hidratada ou banana amassada',
    'mel': 'melado ou xarope de agave',
    'gelatina': 'gelatina de ágar-ágar',
    'frango': 'proteína de soja ou grão-de-bico',
    'carne moida': 'proteína de soja texturizada',
    'carne bovina': 'cogumelos ou grão-de-bico',
    'bacon': 'bacon vegetal ou cogumelo defumado',
    'presunto': 'presunto vegetal',
    'peixe': 'palmito ou banana da terra desfiada',
    'camarao': 'cogumelo shimeji',
  },
  vegetariano: {
    'frango': 'proteína de soja ou grão-de-bico',
    'carne moida': 'proteína de soja texturizada',
    'carne bovina': 'cogumelos ou grão-de-bico',
    'carne suina': 'cogumelos',
    'bacon': 'bacon vegetal ou cogumelo defumado',
    'presunto': 'presunto vegetariano',
    'peixe': 'palmito ou banana da terra desfiada',
    'camarao': 'cogumelo shimeji',
    'linguica': 'linguiça vegetariana',
  },
  sem_lactose: {
    'leite': 'leite sem lactose (ou vegetal)',
    'leite integral': 'leite sem lactose',
    'manteiga': 'manteiga sem lactose ou margarina',
    'creme de leite': 'creme de leite sem lactose',
    'requeijao': 'requeijão sem lactose',
    'queijo': 'queijo sem lactose',
    'queijo parmesao': 'queijo parmesão sem lactose',
    'queijo mussarela': 'queijo mussarela sem lactose',
    'iogurte natural': 'iogurte sem lactose',
    'leite condensado': 'leite condensado sem lactose',
  },
  sem_gluten: {
    'farinha de trigo': 'farinha sem glúten (arroz, mandioca ou mix próprio)',
    'trigo': 'farinha sem glúten',
    'aveia': 'aveia certificada sem glúten',
    'pao': 'pão sem glúten',
    'macarrao': 'macarrão sem glúten (arroz ou milho)',
    'cerveja': 'cerveja sem glúten',
    'molho de soja': 'molho de soja sem glúten (tamari)',
    'fermento em po': 'fermento em pó sem glúten',
  },
  sem_ovo: {
    'ovo': 'linhaça hidratada, chia hidratada ou banana amassada',
  },
};

/**
 * Variações que já atendem à restrição e não devem ser pegas pela regra genérica
 * (ex.: "leite" viraria "leite vegetal" no modo vegano, mas "leite de coco" e
 * "leite de soja" já são vegetais — a qualificação depois do nome muda o produto,
 * mesmo espírito de QUALIFICADORES_FORTES em geladeira.ts).
 */
const JA_ATENDE: Record<Restricao, string[]> = {
  vegano: [
    'leite de coco', 'leite de soja', 'leite de aveia', 'leite de amendoa', 'leite de arroz', 'leite de castanha',
    'creme de leite de coco', 'creme de leite vegetal', 'queijo vegetal', 'queijo vegano', 'manteiga vegana',
    'margarina vegana', 'iogurte de soja', 'iogurte de coco', 'iogurte vegetal', 'bacon vegetal', 'presunto vegetal',
    'requeijao vegano', 'leite condensado de coco', 'carne vegetal', 'proteina de soja', 'proteina vegetal',
  ],
  vegetariano: [
    'proteina de soja', 'proteina vegetal', 'bacon vegetal', 'presunto vegetariano', 'linguica vegetariana', 'carne vegetal',
  ],
  sem_lactose: [
    'leite de coco', 'leite de soja', 'leite de aveia', 'leite de amendoa', 'leite de arroz', 'leite sem lactose',
    'manteiga sem lactose', 'queijo sem lactose', 'requeijao sem lactose', 'creme de leite sem lactose',
    'iogurte sem lactose', 'leite condensado sem lactose',
  ],
  sem_gluten: ['farinha sem gluten', 'aveia sem gluten', 'macarrao sem gluten', 'pao sem gluten', 'cerveja sem gluten', 'molho de soja sem gluten'],
  sem_ovo: [],
};

export interface TrocaRestricao {
  /** Índice do ingrediente na lista original da receita. */
  idx: number;
  original: Ingredient;
  substituto: string;
}

function bateComoPalavra(itemKey: string, chave: string): boolean {
  return itemKey === chave || new RegExp(`(^|\\s)${chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(itemKey);
}

/**
 * Acha o substituto da restrição para uma chave de item: o item bate com uma entrada
 * da tabela tanto por igualdade quanto quando a entrada aparece como palavra inteira
 * dentro do item (ex.: "frango" bate com "peito de frango"), pra não depender de
 * catalogar cada corte/variação. Quando mais de uma entrada bate — incluindo as de
 * `JA_ATENDE` — vence a mais específica (mais longa); se a vencedora for uma
 * variação que já atende, não há troca.
 */
function acharSubstituto(itemKey: string, restricao: Restricao): string | undefined {
  let melhorChave = '';
  let melhorSubstituto: string | undefined;

  for (const [chave, substituto] of Object.entries(TABELAS[restricao])) {
    if (bateComoPalavra(itemKey, chave) && chave.length > melhorChave.length) {
      melhorChave = chave;
      melhorSubstituto = substituto;
    }
  }
  for (const chave of JA_ATENDE[restricao]) {
    if (bateComoPalavra(itemKey, chave) && chave.length > melhorChave.length) {
      melhorChave = chave;
      melhorSubstituto = undefined;
    }
  }
  return melhorSubstituto;
}

/** Acha, na lista de ingredientes de uma receita, quais violam a restrição e o que usar no lugar. */
export function encontrarTrocas(ingredientes: Ingredient[], restricao: Restricao): TrocaRestricao[] {
  const trocas: TrocaRestricao[] = [];
  ingredientes.forEach((ing, idx) => {
    const substituto = acharSubstituto(normalizeItemKey(ing.item), restricao);
    if (substituto) trocas.push({ idx, original: ing, substituto });
  });
  return trocas;
}

/** Aplica as trocas escolhidas, devolvendo uma nova lista de ingredientes (a original não é alterada). */
export function aplicarTrocas(ingredientes: Ingredient[], trocas: TrocaRestricao[]): Ingredient[] {
  const porIdx = new Map(trocas.map((t) => [t.idx, t]));
  return ingredientes.map((ing, idx) => {
    const troca = porIdx.get(idx);
    if (!troca) return ing;
    const novoItem = troca.substituto;
    const qtd = ing.quantidade != null ? formatQtdUnidade(ing.quantidade, ing.unidade) : null;
    return {
      ...ing,
      item: novoItem,
      gondola: resolveGondola(novoItem),
      raw: qtd ? `${qtd} de ${novoItem}` : novoItem,
    };
  });
}
