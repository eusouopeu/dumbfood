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

/** Formata número + rótulo de unidade ("400 g", "2 xícaras", "3 unidades"). */
export function formatQtdUnidade(quantidade: number | null, unidade: string | null): string {
  if (quantidade === null) return 'a gosto';
  const num = formatQtd(quantidade, unidade);
  // Itens contados sem unidade explícita (ex.: "3 ovos") são sempre rotulados como "unidade(s)".
  const label = unidade ? formatUnitLabel(unidade, quantidade) : formatUnitLabel('unidade', quantidade);
  return label ? `${num} ${label}` : num;
}

/**
 * Igual ao anterior, mas com unidade abreviada e invariável (coluna uniforme).
 * Exceções: "xícara(s)" e "unidade(s)" nunca são abreviadas, para ficarem explícitas na leitura.
 */
export function formatQtdUnidadeAbrev(quantidade: number | null, unidade: string | null): string {
  if (quantidade === null) return 'a gosto';
  const num = formatQtd(quantidade, unidade);
  if (unidade === null) return `${num} ${formatUnitLabel('unidade', quantidade)}`;
  if (unidade === 'xicara') return `${num} ${formatUnitLabel('xicara', quantidade)}`;
  const label = formatUnitAbbrev(unidade);
  return label ? `${num} ${label}` : num;
}
