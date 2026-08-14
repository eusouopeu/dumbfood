// Substituições comuns de ingredientes na cozinha brasileira, para sugerir uma troca
// quando falta algo em casa. Não é uma equivalência nutricional exata — é o que dá
// pra usar sem correr atrás de mercado.

import { normalizeItemKey } from './ingredientParser';

const TABELA_BRUTA: Record<string, string[]> = {
  'creme de leite': ['iogurte natural', 'requeijao', 'leite com manteiga'],
  'leite': ['leite em po diluido', 'agua'],
  'manteiga': ['margarina', 'oleo'],
  'margarina': ['manteiga', 'oleo'],
  'oleo': ['manteiga derretida', 'margarina derretida'],
  'ovo': ['banana amassada', 'fermento com agua e oleo'],
  'farinha de trigo': ['farinha de aveia', 'amido de milho'],
  'amido de milho': ['farinha de trigo'],
  'fermento em po': ['bicarbonato de sodio com limao'],
  'acucar': ['mel', 'acucar demerara'],
  'acucar mascavo': ['acucar', 'mel'],
  'mel': ['acucar', 'melado'],
  'iogurte natural': ['creme de leite', 'coalhada'],
  'queijo parmesao': ['queijo minas curado', 'queijo grana padano'],
  'queijo mussarela': ['queijo prato', 'queijo coalho'],
  'requeijao': ['creme de leite', 'catupiry'],
  'vinho branco': ['vinagre de vinho branco com agua', 'caldo de legumes'],
  'vinho tinto': ['suco de uva integral', 'caldo de carne'],
  'caldo de galinha': ['caldo de legumes', 'agua com sal e ervas'],
  'molho de soja': ['molho ingles', 'sal com um pouco de acucar'],
  'alho': ['alho em po', 'cebola'],
  'cebola': ['alho po', 'cebolinha'],
  'salsa': ['coentro', 'cebolinha'],
  'coentro': ['salsa', 'cheiro verde'],
  'limao': ['vinagre', 'lima'],
  'vinagre': ['limao'],
  'creme de leite fresco': ['creme de leite de caixinha', 'nata'],
  'polvilho doce': ['amido de milho'],
  'polvilho azedo': ['polvilho doce com limao'],
  'leite de coco': ['leite com um fio de oleo de coco', 'creme de leite'],
  'chocolate em po': ['cacau em po com acucar'],
  'fermento biologico': ['fermento quimico (na proporcao certa)'],
};

/** Índice reverso, para "vinagre" também sugerir "limão" e vice-versa não precisa reflexo automático. */
const TABELA: Record<string, string[]> = Object.fromEntries(
  Object.entries(TABELA_BRUTA).map(([k, v]) => [normalizeItemKey(k), v]),
);

/** Sugestões de troca para a chave normalizada de um ingrediente, ou lista vazia se não houver. */
export function sugerirSubstitutos(itemKey: string): string[] {
  return TABELA[itemKey] ?? [];
}

/**
 * Mesma coisa, mas a partir do nome de exibição do ingrediente (como vem de
 * `Ingredient.item`, que às vezes carrega uma preposição solta do parser, ex.:
 * "de açúcar"). Reaproveita a normalização de `nomeItem` antes de buscar.
 */
export function sugerirSubstitutosParaItem(item: string): string[] {
  const limpo = item.trim().replace(/^(?:de|do|da|dos|das)\s+/i, '');
  return sugerirSubstitutos(normalizeItemKey(limpo || item));
}
