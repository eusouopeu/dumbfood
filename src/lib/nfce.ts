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

/**
 * Só a rede da Fazenda: sem essa trava o leitor viraria um buscador de URL qualquer.
 * Quase todo portal estadual de NFC-e está em `.gov.br`, mas alguns estados publicam a
 * consulta em domínio próprio (`sefaz.*`, `nfce.*`, `fazenda.*`) — recusar esses era
 * justamente o que fazia o QR de cupom impresso não abrir em parte do país.
 */
function hostDeFazenda(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (/\.gov\.br$/.test(h)) return true;
  return /(^|\.)(sefaz|fazenda|nfce|nfe|sef|set|dfe|receita)[.-]/.test(h) && /\.br$/.test(h);
}

/** Chave de acesso: 44 dígitos seguidos, em qualquer lugar do texto. */
function chaveDe(texto: string): string | undefined {
  const m = texto.replace(/\D+/g, ' ').match(/(?<!\d)\d{44}(?!\d)/);
  return m ? m[0] : undefined;
}

/**
 * Interpreta o conteúdo lido do QR Code (ou colado pelo usuário). Devolve null quando
 * não é uma consulta de NFC-e — texto de outro QR, link encurtado, etc.
 */
export function parseQrNfce(texto: string): QrNfce | null {
  const bruto = texto.trim();
  if (!bruto) return null;

  // Alguns cupons trazem só a chave de acesso (44 dígitos) em vez da URL completa.
  if (!/^https?:\/\//i.test(bruto)) {
    const chave = chaveDe(bruto);
    return chave ? { url: '', chave } : null;
  }

  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return null;
  }
  if (!hostDeFazenda(url.hostname)) return null;

  // A chave vem no parâmetro `p` (formato oficial do QR), em `chNFe` (portais que
  // recebem a consulta já montada) ou solta no caminho da URL. Tenta os três, nessa
  // ordem, antes de desistir dela — a URL em si continua valendo mesmo sem a chave.
  const parametro = url.searchParams.get('p') ?? '';
  const chave =
    chaveDe(parametro.split('|')[0] ?? '') ??
    chaveDe(url.searchParams.get('chNFe') ?? '') ??
    chaveDe(url.searchParams.get('chave') ?? '') ??
    chaveDe(url.pathname);
  return { url: url.toString(), chave };
}

/**
 * Portal de consulta por estado (os dois primeiros dígitos da chave são o código do
 * IBGE da UF). Serve para o caso em que o QR do cupom traz só a chave de acesso, sem a
 * URL: sem isso o app lia a chave e não tinha o que fazer com ela.
 */
const PORTAL_POR_UF: Record<string, string> = {
  '11': 'https://www.sefin.ro.gov.br/nfce/consulta?p=',
  '12': 'http://www.sefaznet.ac.gov.br/nfce/consulta?p=',
  '13': 'http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?p=',
  '14': 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode?p=',
  '15': 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam?p=',
  '16': 'https://www.sefaz.ap.gov.br/nfce/nfcep.php?p=',
  '17': 'http://www.sefaz.to.gov.br/nfce/qrcode?p=',
  '21': 'http://www.nfce.sefaz.ma.gov.br/portal/consultaNFe.do?p=',
  '22': 'http://www.sefaz.pi.gov.br/nfce/qrcode?p=',
  '23': 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=',
  '24': 'http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=',
  '25': 'https://www.receita.pb.gov.br/nfce?p=',
  '26': 'http://nfce.sefaz.pe.gov.br/nfce/consulta?p=',
  '27': 'http://nfce.sefaz.al.gov.br/consultaNFCe.provisorio.htm?p=',
  '28': 'http://www.nfce.se.gov.br/portal/consultarNFCe.jsp?p=',
  '29': 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=',
  '31': 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=',
  '32': 'http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx?p=',
  '33': 'https://consultadfe.fazenda.rj.gov.br/consultaDFe/paginas/consultaChaveAcesso.faces?p=',
  '35': 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=',
  '41': 'http://www.fazenda.pr.gov.br/nfce/qrcode?p=',
  '42': 'https://sat.sef.sc.gov.br/nfce/consulta?p=',
  '43': 'https://www.sefaz.rs.gov.br/ASP/AAE_ROOT/NFE/SAT-WEB-NFE-NFC_QRCODE_1.aspx?p=',
  '50': 'http://www.dfe.ms.gov.br/nfce/qrcode?p=',
  '51': 'http://www.sefaz.mt.gov.br/nfce/consultanfce?p=',
  '52': 'http://nfe.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=',
  '53': 'http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p=',
};

/** Endereço de consulta a partir da chave de acesso, quando o estado é reconhecido. */
export function urlConsultaPorChave(chave: string): string | undefined {
  const base = PORTAL_POR_UF[chave.slice(0, 2)];
  return base ? `${base}${chave}` : undefined;
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
