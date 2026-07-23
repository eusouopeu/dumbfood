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
 * Estilo (fundo pastel + texto/borda escuros) por gôndola, para identificação visual rápida
 * na lista de mercado. Classes utilitárias do Tailwind (paleta padrão). Cada gôndola tem uma
 * cor própria e bem espalhada pelo círculo cromático (não um degradê dentro do próprio
 * título, mas sim uma "escala" de cores distintas entre as gôndolas, para que nenhuma repita
 * ou fique parecida com a vizinha) — em tons claros/pastéis para não pesar na leitura.
 */
export const GONDOLA_ESTILO: Record<string, { header: string; borda: string }> = {
  Hortifruti: { header: 'bg-green-100 text-green-800', borda: 'border-green-700' },
  Açougue: { header: 'bg-red-100 text-red-800', borda: 'border-red-700' },
  Peixaria: { header: 'bg-sky-100 text-sky-800', borda: 'border-sky-700' },
  'Frios e Laticínios': { header: 'bg-yellow-100 text-yellow-800', borda: 'border-yellow-700' },
  Padaria: { header: 'bg-orange-100 text-orange-800', borda: 'border-orange-700' },
  Mercearia: { header: 'bg-violet-100 text-violet-800', borda: 'border-violet-700' },
  'Temperos e Condimentos': { header: 'bg-fuchsia-100 text-fuchsia-800', borda: 'border-fuchsia-700' },
  'Enlatados e Conservas': { header: 'bg-indigo-100 text-indigo-800', borda: 'border-indigo-700' },
  'Massas e Grãos': { header: 'bg-lime-100 text-lime-800', borda: 'border-lime-700' },
  Bebidas: { header: 'bg-teal-100 text-teal-800', borda: 'border-teal-700' },
  Congelados: { header: 'bg-blue-100 text-blue-800', borda: 'border-blue-700' },
  'Limpeza e Outros': { header: 'bg-slate-100 text-slate-800', borda: 'border-slate-700' },
  Outros: { header: 'bg-stone-100 text-stone-800', borda: 'border-stone-700' },
};

export function estiloGondola(gondola: string): { header: string; borda: string } {
  return GONDOLA_ESTILO[gondola] ?? { header: 'bg-stone-100 text-stone-800', borda: 'border-stone-700' };
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
