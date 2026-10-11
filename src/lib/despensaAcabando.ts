// O que está acabando na despensa — base do aviso "passe no mercado" ao sair da academia.
//
// Só dá para dizer "acabando" de item com quantidade conhecida (nota fiscal, sobra de
// embalagem, baixa por consumo). O limite é um quarto da menor embalagem do produto, com
// piso fixo para o que é vendido a granel: 100 g, 150 ml ou a última unidade.

import type { GeladeiraItem } from '../types';
import { embalagemDe } from './embalagens';
import { unitDefByCanonical } from './units';

const PISO = { g: 100, ml: 150 };

export function estaAcabando(item: GeladeiraItem): boolean {
  if (item.quantidade == null) return false;
  const def = item.unidade ? unitDefByCanonical(item.unidade) : undefined;
  if (def?.dimension === 'massa' || def?.dimension === 'volume') {
    const base = def.dimension === 'massa' ? 'g' : 'ml';
    const emBase = item.quantidade * def.toBase;
    const emb = embalagemDe(item.nome);
    const menor = emb && emb.base === base ? Math.min(...emb.tamanhos) : 0;
    return emBase <= Math.max(PISO[base], menor * 0.25);
  }
  if (!item.unidade || item.unidade === 'unidade') return item.quantidade <= 1;
  return false;
}

/** Nomes dos itens acabando, mais urgentes (menor quantidade relativa) primeiro. */
export function itensAcabando(despensa: GeladeiraItem[]): string[] {
  return despensa
    .filter(estaAcabando)
    .sort((a, b) => (a.quantidade ?? 0) - (b.quantidade ?? 0))
    .map((i) => i.nome);
}
