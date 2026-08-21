// Comparação entre estabelecimentos: usando o último preço pago por item em cada
// mercado do histórico, estima quanto a lista atual custaria em cada um deles.

import type { Compra, PrecoItem, ShoppingLine } from '../types';
import { normalizeItemKey } from './ingredientParser';
import { custoLinha } from './prices';
import { seriePrecoItem, type PontoPreco } from './precoHistorico';

/** Mercados já registrados no histórico, do mais recente para o mais antigo. */
export function mercadosDoHistorico(compras: Compra[]): string[] {
  const ultimoUso = new Map<string, number>();
  for (const c of compras) {
    const m = c.mercado?.trim();
    if (!m) continue;
    ultimoUso.set(m, Math.max(ultimoUso.get(m) ?? 0, c.data));
  }
  return Array.from(ultimoUso.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

/** Último preço pago por item em um mercado específico, no formato da tabela de preços. */
function precosDoMercado(compras: Compra[], mercado: string): PrecoItem[] {
  const doMercado = compras.filter((c) => c.mercado?.trim() === mercado);
  const nomes = new Map<string, string>();
  for (const c of doMercado) {
    for (const i of c.itens) {
      const key = normalizeItemKey(i.item);
      if (key && !nomes.has(key)) nomes.set(key, i.item);
    }
  }
  const ultimo = new Map<string, { nome: string; ponto: PontoPreco }>();
  for (const [key, nome] of nomes) {
    const ponto = seriePrecoItem(nome, doMercado).at(-1);
    if (ponto) ultimo.set(key, { nome, ponto });
  }
  return Array.from(ultimo.entries()).map(([itemKey, { nome, ponto }]) => ({
    item: nome,
    itemKey,
    precoUnitario: ponto.precoUnitario,
    unidade: ponto.base === 'kg' ? 'kg' : 'unidade',
    atualizadoEm: ponto.data,
  }));
}

export interface ComparacaoMercado {
  mercado: string;
  /** Total estimado considerando só os itens com preço conhecido nesse mercado. */
  total: number;
  itensCobertos: number;
  itensTotal: number;
  /** Data da compra mais recente nesse mercado — quão velhos são esses preços. */
  atualizadoEm: number;
}

/**
 * Estima o valor da lista em cada mercado do histórico. Mercados cobrem conjuntos
 * diferentes de itens, então `itensCobertos` é parte da resposta: um total baixo com
 * cobertura baixa não significa mercado mais barato.
 */
export function compararMercados(linhas: ShoppingLine[], compras: Compra[]): ComparacaoMercado[] {
  return mercadosDoHistorico(compras)
    .map((mercado) => {
      const precos = precosDoMercado(compras, mercado);
      let total = 0;
      let itensCobertos = 0;
      for (const l of linhas) {
        const custo = custoLinha(l, precos);
        if (custo !== null) {
          total += custo;
          itensCobertos += 1;
        }
      }
      const atualizadoEm = Math.max(...compras.filter((c) => c.mercado?.trim() === mercado).map((c) => c.data));
      return { mercado, total: Math.round(total * 100) / 100, itensCobertos, itensTotal: linhas.length, atualizadoEm };
    })
    .filter((c) => c.itensCobertos > 0)
    .sort((a, b) => a.total / Math.max(1, a.itensCobertos) - b.total / Math.max(1, b.itensCobertos));
}
