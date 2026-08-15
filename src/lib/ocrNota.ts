// Parse do texto reconhecido por OCR de uma nota fiscal de mercado (cupom fiscal /
// NFC-e), para virar candidatos de PrecoItem sem depender de um formato fixo — o
// texto vindo de OCR é ruidoso (linhas quebradas, código de barras colado, "O" no
// lugar de "0"), então o parser é propositalmente tolerante: por linha, acha o
// preço (o último número no formato decimal brasileiro) e usa o resto como nome.

import { normalizeItemKey } from './ingredientParser';
import type { PrecoItem } from '../types';

/** Linhas de cabeçalho/rodapé de cupom que nunca são item — descarta antes de tentar casar preço. */
const RUIDO = [
  'cupom fiscal', 'nfc-e', 'nfce', 'sat', 'cnpj', 'cpf', 'endereco', 'razao social',
  'valor total', 'total a pagar', 'total r$', 'subtotal', 'desconto', 'acrescimo',
  'troco', 'dinheiro', 'cartao', 'debito', 'credito', 'pix', 'forma de pagamento',
  'tributos', 'consumidor', 'chave de acesso', 'protocolo', 'via consumidor',
  'obrigado', 'volte sempre', 'numero', 'serie', 'emissao', 'extrato', 'qtde total',
];

/** Preço decimal brasileiro no fim (ou perto do fim) da linha: "12,90", "1.234,56". */
const RE_PRECO = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
/** Código de barras / item numérico solto no início da linha (ex.: "001 7891234567890 "). */
const RE_CODIGO_INICIAL = /^[\d.\s]{0,20}?(?=[A-Za-zÀ-ÿ])/;
/** "2x" ou "2 UN x" de quantidade, que às vezes fica colado antes do preço — não é nome. */
const RE_QTD_UNIDADE_FINAL = /\s+\d+([.,]\d+)?\s*(x|un|kg|g|l|ml)?\s*$/i;

function paraNumeroBR(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function ehRuido(linhaLower: string): boolean {
  return RUIDO.some((r) => linhaLower.includes(r));
}

function limparNomeItem(bruto: string): string {
  let nome = bruto.replace(RE_CODIGO_INICIAL, '');
  nome = nome.replace(RE_QTD_UNIDADE_FINAL, '');
  nome = nome.replace(/\s{2,}/g, ' ').trim();
  // Nomes de cupom vêm em CAIXA ALTA; deixa mais legível sem perder siglas curtas.
  if (nome === nome.toUpperCase() && nome.length > 3) {
    nome = nome
      .toLowerCase()
      .split(' ')
      .map((p) => (p.length <= 2 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(' ');
  }
  return nome;
}

export interface CandidatoOcr {
  linhaOriginal: string;
  item: string;
  preco: number;
}

/** Extrai candidatos a item+preço do texto bruto reconhecido por OCR na nota. */
export function extrairCandidatos(textoOcr: string): CandidatoOcr[] {
  const linhas = textoOcr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidatos: CandidatoOcr[] = [];

  for (const linha of linhas) {
    const lower = linha.toLowerCase();
    if (ehRuido(lower)) continue;

    const m = linha.match(RE_PRECO);
    if (!m) continue;
    const preco = paraNumeroBR(m[1]);
    if (!Number.isFinite(preco) || preco <= 0 || preco > 9999) continue;

    const nomeBruto = linha.slice(0, m.index).trim();
    const item = limparNomeItem(nomeBruto);
    if (!item || item.length < 2 || /^\d+$/.test(item)) continue;

    candidatos.push({ linhaOriginal: linha, item, preco });
  }

  return candidatos;
}

/** Converte candidatos revisados/editados pelo usuário em PrecoItem prontos para importar. */
export function candidatosParaPrecos(candidatos: CandidatoOcr[]): PrecoItem[] {
  const agora = Date.now();
  return candidatos.map((c) => ({
    item: c.item,
    itemKey: normalizeItemKey(c.item),
    precoUnitario: c.preco,
    unidade: 'unidade',
    atualizadoEm: agora,
  }));
}
