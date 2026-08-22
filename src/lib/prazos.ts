// Prazo de validade típico por tipo de ingrediente, para sugerir a data ao adicionar
// algo na geladeira. Preencher data à mão é o atrito que faz o campo ficar vazio — e
// sem validade não há aviso de vencimento nem priorização do que cozinhar primeiro.
//
// São prazos de geladeira/despensa doméstica depois de aberto/comprado, arredondados
// para baixo: errar para menos faz o app avisar cedo demais, o que é inofensivo.

import { deburr, normalizeItemKey } from './ingredientParser';
import { resolveGondola } from './aisles';

/** Prazos por palavra-chave do item; ordem importa (específico antes de genérico). */
const PRAZOS: Array<[string[], number]> = [
  [['peixe', 'tilapia', 'salmao', 'merluza', 'pescada', 'camarao'], 2],
  [['carne moida'], 2],
  [['alface', 'rucula', 'agriao', 'espinafre', 'coentro', 'salsinha', 'cebolinha', 'manjericao', 'hortela'], 4],
  [['frango', 'file de frango', 'peito de frango'], 3],
  [['carne', 'alcatra', 'patinho', 'coxao', 'picanha', 'maminha', 'linguica', 'bacon', 'costela'], 4],
  [['leite', 'iogurte', 'creme de leite', 'requeijao'], 7],
  [['queijo', 'mussarela', 'presunto', 'peito de peru'], 10],
  [['ovo'], 21],
  [['banana', 'morango', 'uva', 'abacate', 'mamao'], 5],
  [['tomate', 'pepino', 'abobrinha', 'berinjela', 'pimentao', 'brocolis', 'couve'], 7],
  [['maca', 'laranja', 'limao', 'cenoura', 'beterraba', 'repolho'], 14],
  [['batata', 'cebola', 'alho', 'abobora', 'mandioca'], 30],
  [['manteiga', 'margarina'], 60],
  [['pao', 'pao de forma'], 5],
];

/** Prazos de reserva por gôndola, quando o item específico não está na tabela. */
const PRAZO_POR_GONDOLA: Record<string, number> = {
  Hortifruti: 7,
  'Açougue': 3,
  Peixaria: 2,
  'Frios e Laticínios': 7,
  Padaria: 5,
  Congelados: 90,
  Bebidas: 180,
  Mercearia: 180,
  'Enlatados e Conservas': 365,
  'Massas e Grãos': 180,
  'Temperos e Condimentos': 365,
};

/**
 * Prazo sugerido em dias para um item; undefined quando não dá para arriscar um palpite
 * (item desconhecido em gôndola desconhecida).
 */
export function prazoPadraoDias(item: string): number | undefined {
  const key = normalizeItemKey(item);
  if (!key) return undefined;
  for (const [chaves, dias] of PRAZOS) {
    for (const c of chaves) if (key.includes(deburr(c))) return dias;
  }
  return PRAZO_POR_GONDOLA[resolveGondola(item)];
}

/** Data (yyyy-mm-dd) sugerida de validade para o item, no formato do <input type="date">. */
export function validadeSugerida(item: string, hoje = Date.now()): string {
  const dias = prazoPadraoDias(item);
  if (dias === undefined) return '';
  const d = new Date(hoje);
  d.setDate(d.getDate() + dias);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}
