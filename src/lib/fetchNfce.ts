// Busca a página de consulta da NFC-e do lado do servidor (endpoint /api/nfce) e
// extrai os itens. Compartilhado pela função serverless e pelo middleware de dev.

import { parseNfceHtml, totalDaNfce, type ItemNfce } from './nfce';

const TIMEOUT_MS = 15_000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface NotaFiscalLida {
  itens: ItemNfce[];
  total: number | null;
}

/**
 * Só busca dentro de `.gov.br`: o endpoint existe para ler a nota na SEFAZ, e sem essa
 * trava ele viraria um proxy de fetch aberto para qualquer endereço.
 */
export async function fetchAndParseNfce(url: string): Promise<NotaFiscalLida> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL inválida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Apenas URLs http(s) são suportadas.');
  }
  if (!/\.gov\.br$/i.test(parsed.hostname)) {
    throw new Error('Só é possível consultar notas nos portais da Fazenda (.gov.br).');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('O portal da Fazenda demorou demais para responder.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`O portal da Fazenda respondeu com status ${res.status}.`);

  const html = await res.text();
  return { itens: parseNfceHtml(html), total: totalDaNfce(html) };
}
