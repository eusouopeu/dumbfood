// Leitura da NFC-e (nota fiscal de consumidor eletrônica) pelo QR Code impresso no cupom.
//
// O QR não guarda os itens: ele aponta para a página de consulta da SEFAZ do estado,
// onde a nota aparece *estruturada* — item, quantidade, unidade e valor unitário exatos.
// É por isso que este caminho vale mais que o OCR da foto: nada de "0" lido como "O",
// nem preço perdido numa dobra do papel.
//
// Puro (string -> dados), sem rede nem DOM, para rodar igual no navegador e no teste.

import { normalizeItemKey } from './ingredientParser';
import type { PrecoItem } from '../types';

export interface QrNfce {
  /** URL de consulta a abrir (a mesma do QR). */
  url: string;
  /** Chave de acesso de 44 dígitos, quando dá para extraí-la. */
  chave?: string;
}

/** Só a rede da Fazenda: sem essa trava o leitor viraria um buscador de URL qualquer. */
function hostDeFazenda(hostname: string): boolean {
  return /\.gov\.br$/i.test(hostname);
}

/**
 * Interpreta o conteúdo lido do QR Code (ou colado pelo usuário). Devolve null quando
 * não é uma consulta de NFC-e — texto de outro QR, link encurtado, etc.
 */
export function parseQrNfce(texto: string): QrNfce | null {
  const bruto = texto.trim();
  if (!bruto) return null;

  // Alguns cupons trazem só a chave de acesso (44 dígitos) em vez da URL completa.
  const soDigitos = bruto.replace(/\D/g, '');
  if (!/^https?:\/\//i.test(bruto)) {
    return soDigitos.length === 44 ? { url: '', chave: soDigitos } : null;
  }

  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return null;
  }
  if (!hostDeFazenda(url.hostname)) return null;

  const parametro = url.searchParams.get('p') ?? '';
  const chave = (parametro.split('|')[0] || '').replace(/\D/g, '');
  return { url: url.toString(), chave: chave.length === 44 ? chave : undefined };
}

export interface ItemNfce {
  item: string;
  quantidade: number;
  /** Unidade como veio da nota (UN, KG, L, PC...), em caixa alta. */
  unidade: string;
  /** Valor unitário em reais. */
  valorUnitario: number;
}

/**
 * Último número de um trecho como "Vl. Unit.: 24,90" ou "Qtde.:0,850". Pegar o último
 * é o que evita confundir o rótulo com o valor: "Vl. Unit." tem pontos, mas não dígitos.
 */
function numeroBR(texto: string | undefined): number {
  if (!texto) return 0;
  const numeros = texto.match(/\d[\d.,]*/g);
  if (!numeros) return 0;
  const bruto = numeros[numeros.length - 1].replace(/[.,]$/, '');
  const normalizado = bruto.includes(',')
    ? bruto.replace(/\./g, '').replace(',', '.')
    : bruto.replace(/\.(?=\d{3}\b)/g, '');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function textoDe(fragmento: string | undefined): string {
  if (!fragmento) return '';
  return fragmento
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capturar(bloco: string, classe: string): string {
  const m = bloco.match(new RegExp(`class=["']?${classe}["']?[^>]*>([\\s\\S]*?)</span>`, 'i'));
  return textoDe(m?.[1]);
}

/**
 * Extrai os itens da página de consulta da NFC-e. O portal é o mesmo modelo em quase
 * todos os estados (tabela `tabResult`, com `txtTit` para o nome e `Rqtd`/`RUN`/`RvlUnit`
 * para quantidade, unidade e valor unitário), então a leitura é por classe, e não por
 * posição de coluna — estado que muda a ordem das colunas continua funcionando.
 */
export function parseNfceHtml(html: string): ItemNfce[] {
  const itens: ItemNfce[] = [];
  for (const linha of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const bloco = linha[1];
    const nome = capturar(bloco, 'txtTit\\d*');
    if (!nome) continue;
    const quantidade = numeroBR(capturar(bloco, 'Rqtd'));
    const valorUnitario = numeroBR(capturar(bloco, 'RvlUnit'));
    if (quantidade <= 0 || valorUnitario <= 0) continue;
    const unidade = (capturar(bloco, 'RUN').replace(/^UN:?\s*/i, '') || 'UN').toUpperCase();
    itens.push({ item: nome, quantidade, unidade, valorUnitario });
  }
  return itens;
}

/** Total da nota, quando a página o publica — serve para conferir a leitura. */
export function totalDaNfce(html: string): number | null {
  const m = html.match(/class=["']?txtMax["']?[^>]*>([\s\S]*?)<\/span>/i);
  const valor = numeroBR(textoDe(m?.[1]));
  return valor > 0 ? valor : null;
}

/**
 * Converte a unidade do cupom para a unidade de preço do app. Itens vendidos por peso
 * viram preço por kg; por volume, por litro; o resto, por unidade.
 */
function unidadeDePreco(unidade: string): { unidade: PrecoItem['unidade']; fator: number } {
  const u = unidade.toUpperCase();
  if (/^KG|^QUILO/.test(u)) return { unidade: 'kg', fator: 1 };
  // 1 g na nota custa mil vezes menos que 1 kg — sem o fator o histórico ficaria absurdo.
  if (/^G$|^GR/.test(u)) return { unidade: 'kg', fator: 1000 };
  if (/^L$|^LT|^LITRO/.test(u)) return { unidade: 'l', fator: 1 };
  if (/^ML/.test(u)) return { unidade: 'l', fator: 1000 };
  return { unidade: 'unidade', fator: 1 };
}

/** Transforma itens lidos da nota em preços do app (mesmo destino de "Atualizar preços"). */
export function itensNfceParaPrecos(itens: ItemNfce[], agora = Date.now()): PrecoItem[] {
  return itens
    .map((i) => {
      const { unidade, fator } = unidadeDePreco(i.unidade);
      return {
        item: i.item,
        itemKey: normalizeItemKey(i.item),
        precoUnitario: Math.round(i.valorUnitario * fator * 100) / 100,
        unidade,
        atualizadoEm: agora,
      };
    })
    .filter((p) => p.itemKey && p.precoUnitario > 0);
}
