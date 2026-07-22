// Importação e casamento de preços de ingredientes, a partir de CSV/JSON
// gerado pelo usuário (ex.: análise por IA de fotos de notas fiscais de mercado).
//
// Formatos aceitos:
//  - JSON: array de objetos, ou { itens: [...] } / { precos: [...] }.
//    Campos aceitos (qualquer um): item|produto|nome, preco|precoUnitario|valor|price, unidade|unit.
//  - CSV: colunas "item,preco,unidade" (cabeçalho opcional). unidade ∈ kg | l | unidade (padrão: kg).

import type { PrecoItem, ShoppingLine } from '../types';
import { normalizeItemKey } from './ingredientParser';

type LinhaBruta = Record<string, unknown>;

function paraNumero(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  // Se não havia separador decimal por vírgula, o replace acima pode ter removido milhar incorretamente;
  // tenta a leitura direta primeiro.
  const direto = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(direto) ? direto : Number(s);
}

function normalizarLinha(row: LinhaBruta, agora: number): PrecoItem | null {
  const item = String(row.item ?? row.produto ?? row.nome ?? '').trim();
  const precoRaw = row.preco ?? row.precoUnitario ?? row.valor ?? row.price;
  const preco = paraNumero(precoRaw);
  if (!item || !Number.isFinite(preco) || preco <= 0) return null;
  const unidadeRaw = String(row.unidade ?? row.unit ?? 'kg').trim().toLowerCase();
  const unidade: PrecoItem['unidade'] = unidadeRaw.startsWith('l')
    ? 'l'
    : unidadeRaw.startsWith('un')
      ? 'unidade'
      : 'kg';
  return { item, itemKey: normalizeItemKey(item), precoUnitario: preco, unidade, atualizadoEm: agora };
}

function parseCsv(conteudo: string, agora: number): PrecoItem[] {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length === 0) return [];
  const cabecalho = linhas[0].toLowerCase();
  const temCabecalho = /item|produto|nome/.test(cabecalho) && /prec|valor/.test(cabecalho);
  const dados = temCabecalho ? linhas.slice(1) : linhas;
  const out: PrecoItem[] = [];
  for (const l of dados) {
    const [item, preco, unidade] = l.split(/[,;]/).map((c) => c.trim());
    const r = normalizarLinha({ item, preco, unidade }, agora);
    if (r) out.push(r);
  }
  return out;
}

/** Faz o parse de um arquivo de preços (CSV ou JSON) para uma lista de PrecoItem. */
export function parseArquivoPrecos(conteudo: string, nomeArquivo: string): PrecoItem[] {
  const agora = Date.now();
  const pareceJson = nomeArquivo.toLowerCase().endsWith('.json') || /^\s*[[{]/.test(conteudo);
  if (pareceJson) {
    const data = JSON.parse(conteudo);
    const arr: LinhaBruta[] = Array.isArray(data) ? data : (data.itens ?? data.precos ?? []);
    return arr.map((row) => normalizarLinha(row, agora)).filter((x): x is PrecoItem => x !== null);
  }
  return parseCsv(conteudo, agora);
}

/** Busca o melhor preço para uma chave de item (exato, depois por substring). */
export function buscarPreco(itemKey: string, precos: PrecoItem[]): PrecoItem | undefined {
  const exato = precos.find((p) => p.itemKey === itemKey);
  if (exato) return exato;
  return precos.find((p) => itemKey.includes(p.itemKey) || p.itemKey.includes(itemKey));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Estima o custo de uma linha da lista de mercado a partir da tabela de preços. */
export function custoLinha(linha: ShoppingLine, precos: PrecoItem[]): number | null {
  const preco = buscarPreco(normalizeItemKey(linha.item), precos);
  if (!preco) return null;
  let total = 0;
  let achou = false;
  for (const q of linha.quantidades) {
    if (q.quantidade === null) continue;
    if (preco.unidade === 'unidade') {
      if (q.unidade === null || q.unidade === 'unidade') {
        total += preco.precoUnitario * q.quantidade;
        achou = true;
      }
      continue;
    }
    // Preço por kg ou por litro (1 L tratado como 1 kg).
    if (q.unidade === 'g') { total += preco.precoUnitario * (q.quantidade / 1000); achou = true; }
    else if (q.unidade === 'kg') { total += preco.precoUnitario * q.quantidade; achou = true; }
    else if (q.unidade === 'ml') { total += preco.precoUnitario * (q.quantidade / 1000); achou = true; }
    else if (q.unidade === 'l') { total += preco.precoUnitario * q.quantidade; achou = true; }
  }
  return achou ? round2(total) : null;
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
