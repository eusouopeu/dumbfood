// Classificação de ingredientes por seção do mercado (gôndola).
// Baseada em correspondência de palavras-chave no nome do item (sem acento, minúsculo).

import { deburr, normalizeItemKey } from './ingredientParser';

export const GONDOLA_ORDER = [
  'Hortifruti',
  'Açougue',
  'Peixaria',
  'Frios e Laticínios',
  'Padaria',
  'Mercearia',
  'Temperos e Condimentos',
  'Enlatados e Conservas',
  'Massas e Grãos',
  'Bebidas',
  'Congelados',
  'Limpeza e Outros',
  'Outros',
] as const;

export type Gondola = (typeof GONDOLA_ORDER)[number];

/**
 * Estilo (degradê + borda) por gôndola, para identificação visual rápida na lista de mercado.
 * Classes utilitárias do Tailwind (paleta padrão) — cada gôndola com uma cor bem distinta,
 * usando degradês de dois tons da mesma família quando útil para dar mais vida ao cabeçalho.
 */
export const GONDOLA_ESTILO: Record<string, { header: string; borda: string }> = {
  Hortifruti: { header: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white', borda: 'border-green-600' },
  Açougue: { header: 'bg-gradient-to-r from-red-500 to-rose-600 text-white', borda: 'border-red-600' },
  Peixaria: { header: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white', borda: 'border-blue-600' },
  'Frios e Laticínios': { header: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white', borda: 'border-amber-500' },
  Padaria: { header: 'bg-gradient-to-r from-orange-400 to-orange-600 text-white', borda: 'border-orange-500' },
  Mercearia: { header: 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white', borda: 'border-purple-600' },
  'Temperos e Condimentos': { header: 'bg-gradient-to-r from-rose-400 to-pink-600 text-white', borda: 'border-rose-500' },
  'Enlatados e Conservas': { header: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white', borda: 'border-indigo-600' },
  'Massas e Grãos': { header: 'bg-gradient-to-r from-amber-400 to-yellow-600 text-white', borda: 'border-amber-500' },
  Bebidas: { header: 'bg-gradient-to-r from-cyan-400 to-teal-500 text-white', borda: 'border-cyan-500' },
  Congelados: { header: 'bg-gradient-to-r from-sky-400 to-blue-500 text-white', borda: 'border-sky-500' },
  'Limpeza e Outros': { header: 'bg-gradient-to-r from-slate-400 to-slate-600 text-white', borda: 'border-slate-500' },
  Outros: { header: 'bg-gradient-to-r from-stone-400 to-stone-600 text-white', borda: 'border-stone-500' },
};

export function estiloGondola(gondola: string): { header: string; borda: string } {
  return GONDOLA_ESTILO[gondola] ?? { header: 'bg-gradient-to-r from-stone-400 to-stone-600 text-white', borda: 'border-stone-500' };
}

// Palavras-chave por gôndola. A ordem importa: a primeira que casar vence,
// então listas mais específicas vêm antes das genéricas.
const KEYWORDS: Array<[Gondola, string[]]> = [
  ['Açougue', ['carne', 'bife', 'file', 'frango', 'peito de frango', 'coxa', 'sobrecoxa', 'linguica', 'bacon', 'costela', 'alcatra', 'patinho', 'moida', 'moido', 'porco', 'lombo', 'pernil', 'peru', 'salsicha', 'presunto de parma', 'picanha', 'cupim', 'maminha', 'fraldinha']],
  ['Peixaria', ['peixe', 'salmao', 'tilapia', 'atum fresco', 'camarao', 'bacalhau', 'sardinha', 'polvo', 'lula', 'merluza', 'pescada']],
  ['Frios e Laticínios', ['leite', 'queijo', 'mussarela', 'muçarela', 'parmesao', 'requeijao', 'iogurte', 'manteiga', 'margarina', 'creme de leite', 'nata', 'ricota', 'cream cheese', 'presunto', 'mortadela', 'peito de peru', 'ovo', 'ovos', 'catupiry', 'leite condensado']],
  ['Padaria', ['pao', 'paozinho', 'baguete', 'bisnaga', 'torrada', 'croissant', 'brioche', 'forma']],
  ['Temperos e Condimentos', ['sal', 'pimenta', 'oregano', 'cominho', 'colorau', 'pimentao em po', 'noz-moscada', 'noz moscada', 'canela', 'cravo', 'louro', 'curry', 'paprica', 'caldo de', 'tempero', 'mostarda', 'ketchup', 'maionese', 'molho de soja', 'shoyu', 'vinagre', 'azeite', 'oleo', 'acucar', 'adocante', 'fermento', 'essencia', 'baunilha', 'gengibre em po']],
  ['Enlatados e Conservas', ['milho', 'ervilha', 'seleta', 'palmito', 'azeitona', 'atum', 'sardinha em lata', 'extrato de tomate', 'molho de tomate', 'tomate pelado', 'grao-de-bico em conserva', 'champignon', 'pepino em conserva']],
  ['Massas e Grãos', ['arroz', 'feijao', 'macarrao', 'massa', 'espaguete', 'penne', 'lasanha', 'farinha', 'lentilha', 'grao-de-bico', 'grao de bico', 'quinoa', 'aveia', 'trigo', 'fuba', 'polvilho', 'amido', 'maisena', 'cuscuz', 'nhoque']],
  ['Hortifruti', ['cebola', 'alho', 'tomate', 'batata', 'cenoura', 'alface', 'couve', 'brocolis', 'abobrinha', 'abobora', 'pimentao', 'salsa', 'salsinha', 'cebolinha', 'coentro', 'manjericao', 'limao', 'laranja', 'maca', 'banana', 'mamao', 'abacaxi', 'morango', 'uva', 'manga', 'pepino', 'beringela', 'berinjela', 'espinafre', 'rucula', 'agriao', 'mandioca', 'aipim', 'inhame', 'gengibre', 'abacate', 'chuchu', 'quiabo', 'vagem', 'ervilha fresca', 'repolho', 'beterraba', 'nabo', 'alho-poro', 'alho poro', 'salsao', 'cogumelo', 'shitake', 'shimeji', 'batata-doce', 'batata doce']],
  ['Bebidas', ['agua', 'suco', 'refrigerante', 'vinho', 'cerveja', 'cachaca', 'vodka', 'rum', 'cafe', 'cha', 'leite de coco', 'agua de coco']],
  ['Congelados', ['sorvete', 'congelado', 'polpa de fruta', 'batata palito congelada', 'ervilha congelada']],
  ['Mercearia', ['chocolate', 'cacau', 'coco ralado', 'leite em po', 'gelatina', 'biscoito', 'bolacha', 'amendoim', 'castanha', 'noz', 'nozes', 'passas', 'mel', 'geleia', 'granola', 'cereal', 'achocolatado', 'leite condensado', 'doce de leite']],
];

const REGEX_CACHE = new Map<string, RegExp>();
function wordRegex(dw: string): RegExp {
  let re = REGEX_CACHE.get(dw);
  if (!re) {
    const escaped = dw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`\\b${escaped}\\b`);
    REGEX_CACHE.set(dw, re);
  }
  return re;
}

/** Resolve a gôndola de um item já limpo/minúsculo. */
export function resolveGondola(item: string): Gondola {
  // Singulariza para casar "cebolas" com a palavra-chave "cebola".
  const norm = normalizeItemKey(item);
  for (const [gondola, words] of KEYWORDS) {
    for (const w of words) {
      // Correspondência por palavra inteira evita que "sal" case "salsinha".
      if (wordRegex(deburr(w)).test(norm)) return gondola;
    }
  }
  return 'Outros';
}
