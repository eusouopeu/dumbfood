// Série histórica de preço por item, derivada do histórico de compras.
// Cada compra salva congela o preço pago por item; juntando as compras dá pra dizer
// "o açúcar subiu 22% em 3 meses" e apontar preço fora do padrão na hora de comprar.

import type { Compra } from '../types';
import { normalizeItemKey } from './ingredientParser';
import { round } from './scale';

/** Base do preço unitário: por quilo (inclui litro) ou por unidade contada. */
export type BasePreco = 'kg' | 'unidade';

export interface PontoPreco {
  data: number;
  /** Preço por kg ou por unidade, conforme `base`. */
  precoUnitario: number;
  base: BasePreco;
  mercado?: string;
}

/**
 * Preço unitário pago por um item em uma compra. Prefere o preço por peso, que é
 * comparável entre compras de tamanhos diferentes; cai para o preço por unidade
 * quando o item foi registrado só por contagem.
 */
function pontoDaCompra(compra: Compra, precoEstimado: number, quantidadeG: number | null, quantidadeUnidades: number | null): PontoPreco | null {
  if (quantidadeG !== null && quantidadeG > 0) {
    return { data: compra.data, precoUnitario: precoEstimado / (quantidadeG / 1000), base: 'kg', mercado: compra.mercado };
  }
  if (quantidadeUnidades !== null && quantidadeUnidades > 0) {
    return { data: compra.data, precoUnitario: precoEstimado / quantidadeUnidades, base: 'unidade', mercado: compra.mercado };
  }
  return null;
}

/**
 * Série de preços de um item, da compra mais antiga para a mais recente.
 * Só entram pontos da mesma base do ponto mais recente — misturar preço por kg com
 * preço por unidade produziria uma variação sem sentido.
 */
export function seriePrecoItem(itemNome: string, compras: Compra[]): PontoPreco[] {
  const chave = normalizeItemKey(itemNome);
  const pontos: PontoPreco[] = [];
  for (const c of compras) {
    for (const i of c.itens) {
      if (normalizeItemKey(i.item) !== chave || i.precoEstimado === null) continue;
      const p = pontoDaCompra(c, i.precoEstimado, i.quantidadeG, i.quantidadeUnidades);
      if (p) pontos.push(p);
    }
  }
  pontos.sort((a, b) => a.data - b.data);
  const baseRecente = pontos.at(-1)?.base;
  return pontos.filter((p) => p.base === baseRecente);
}

export interface VariacaoPreco {
  /** Variação percentual entre o primeiro e o último ponto da série. */
  percentual: number;
  primeiro: PontoPreco;
  ultimo: PontoPreco;
  /** Dias entre o primeiro e o último ponto. */
  dias: number;
  base: BasePreco;
}

/** Variação de ponta a ponta da série; null com menos de dois pontos comparáveis. */
export function variacaoPreco(serie: PontoPreco[]): VariacaoPreco | null {
  if (serie.length < 2) return null;
  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  if (primeiro.precoUnitario <= 0) return null;
  return {
    percentual: round(((ultimo.precoUnitario - primeiro.precoUnitario) / primeiro.precoUnitario) * 100),
    primeiro,
    ultimo,
    dias: Math.round((ultimo.data - primeiro.data) / 86_400_000),
    base: ultimo.base,
  };
}

function mediana(valores: number[]): number {
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[meio - 1] + ord[meio]) / 2 : ord[meio];
}

/**
 * Compara um preço com a mediana histórica do item e avisa quando ele destoa em mais
 * de 20% — o alerta de "esse não é o preço de sempre" na hora da compra.
 * Precisa de ao menos três pontos para não disparar por causa de uma única compra atípica.
 */
export function precoForaDoPadrao(precoUnitario: number, serie: PontoPreco[]): 'alto' | 'baixo' | null {
  if (serie.length < 3 || !(precoUnitario > 0)) return null;
  const med = mediana(serie.map((p) => p.precoUnitario));
  if (!(med > 0)) return null;
  if (precoUnitario > med * 1.2) return 'alto';
  if (precoUnitario < med * 0.8) return 'baixo';
  return null;
}

export interface ItemHistorico {
  itemKey: string;
  nome: string;
  serie: PontoPreco[];
  variacao: VariacaoPreco | null;
}

/** Todos os itens do histórico que têm ao menos dois preços comparáveis, do que mais subiu ao que mais caiu. */
export function itensComHistoricoDePreco(compras: Compra[]): ItemHistorico[] {
  const nomes = new Map<string, string>();
  for (const c of compras) {
    for (const i of c.itens) {
      const key = normalizeItemKey(i.item);
      if (key && !nomes.has(key)) nomes.set(key, i.item);
    }
  }
  return Array.from(nomes.entries())
    .map(([itemKey, nome]) => {
      const serie = seriePrecoItem(nome, compras);
      return { itemKey, nome, serie, variacao: variacaoPreco(serie) };
    })
    .filter((x) => x.variacao !== null)
    .sort((a, b) => (b.variacao?.percentual ?? 0) - (a.variacao?.percentual ?? 0));
}
