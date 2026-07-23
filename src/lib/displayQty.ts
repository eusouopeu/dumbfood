// Formatação de quantidade sensível à unidade:
// massa/volume usam decimal (1,5 kg); contagem e medidas de cozinha usam frações (1 ½ xícara).

import { formatQuantidade, round } from './scale';
import { unitDefByCanonical, formatUnitLabel, formatUnitAbbrev } from './units';

export function formatDecimal(n: number): string {
  return round(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function usaDecimal(unidade: string | null): boolean {
  if (!unidade) return false;
  const def = unitDefByCanonical(unidade);
  return def?.dimension === 'massa' || def?.dimension === 'volume';
}

/** Formata só o número conforme a unidade. */
export function formatQtd(quantidade: number | null, unidade: string | null): string {
  if (quantidade === null) return 'a gosto';
  return usaDecimal(unidade) ? formatDecimal(quantidade) : formatQuantidade(quantidade);
}

/** Formata número + rótulo de unidade ("400 g", "2 xícaras", "3 un"). */
export function formatQtdUnidade(quantidade: number | null, unidade: string | null): string {
  if (quantidade === null) return 'a gosto';
  const num = formatQtd(quantidade, unidade);
  // Itens contados sem unidade explícita (ex.: "3 ovos") ou com "unidade" explícita são sempre "un".
  if (unidade === null || unidade === 'unidade') return `${num} ${formatUnitAbbrev('unidade')}`;
  const label = formatUnitLabel(unidade, quantidade);
  return label ? `${num} ${label}` : num;
}

/**
 * Igual ao anterior, mas com unidade abreviada e invariável (coluna uniforme).
 * Exceção: "xícara(s)" nunca é abreviada, para ficar explícita na leitura.
 */
export function formatQtdUnidadeAbrev(quantidade: number | null, unidade: string | null): string {
  if (quantidade === null) return 'a gosto';
  const num = formatQtd(quantidade, unidade);
  if (unidade === 'xicara') return `${num} ${formatUnitLabel('xicara', quantidade)}`;
  const label = unidade === null ? formatUnitAbbrev('unidade') : formatUnitAbbrev(unidade);
  return label ? `${num} ${label}` : num;
}
