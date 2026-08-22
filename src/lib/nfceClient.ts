// Busca a página de consulta da NFC-e e devolve os itens da nota.
//
// Mesma estratégia da importação de receitas: primeiro o endpoint próprio (existe no
// `npm run dev` e em hospedagem com serverless); onde ele não existe — GitHub Pages e
// o APK — a página vem por proxy público e o parse acontece aqui mesmo.

import { parseNfceHtml, totalDaNfce, type ItemNfce } from './nfce';
import { buscarHtmlViaProxy } from './fetchViaProxy';

export interface NotaLida {
  itens: ItemNfce[];
  total: number | null;
}

async function tentarEndpointProprio(url: string): Promise<NotaLida | null> {
  try {
    const res = await fetch(`/api/nfce?url=${encodeURIComponent(url)}`);
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    const body = await res.json();
    if (!res.ok || !Array.isArray(body.itens) || body.itens.length === 0) return null;
    return body as NotaLida;
  } catch {
    return null;
  }
}

export async function buscarItensDaNota(url: string): Promise<NotaLida> {
  const direto = await tentarEndpointProprio(url);
  if (direto) return direto;

  const { html } = await buscarHtmlViaProxy(url, (pagina) => parseNfceHtml(pagina).length > 0);
  return { itens: parseNfceHtml(html), total: totalDaNfce(html) };
}
