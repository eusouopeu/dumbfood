// Busca uma página de receita e a converte em NewRecipe.
// Usado pelo endpoint serverless (api/import.ts) e pelo middleware de dev do Vite.

import type { NewRecipe } from '../types';
import { parseRecipeFromHtml } from './parseRecipeHtml';

/** Teto de espera pela página: sem isso, um site lento segura a função até o timeout da plataforma. */
const TIMEOUT_MS = 12_000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function fetchAndParseRecipe(url: string): Promise<NewRecipe | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL inválida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Apenas URLs http(s) são suportadas.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('O site demorou demais para responder.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`O site respondeu com status ${res.status}.`);
  }

  const html = await res.text();
  return parseRecipeFromHtml(html, parsed.toString());
}
