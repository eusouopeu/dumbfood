// Busca o HTML de uma página de receita a partir do navegador.
//
// O app é publicado no GitHub Pages, que serve apenas arquivos estáticos: não existe
// `/api/import` em produção (era essa a causa da importação por link ter parado de
// funcionar). E buscar o site direto do navegador esbarra em CORS. A saída é passar
// por um proxy público que devolva o HTML com `Access-Control-Allow-Origin`.
//
// São vários porque nenhum é confiável sozinho: se um estiver fora do ar ou for
// bloqueado pelo site de destino, o próximo assume.

export interface Proxy {
  nome: string;
  url: (alvo: string) => string;
  headers?: Record<string, string>;
}

export const PROXIES: Proxy[] = [
  // Lê a página com um navegador de verdade do lado deles, então também resolve
  // sites que montam o conteúdo via JavaScript. `x-respond-with: html` devolve o
  // HTML original em vez do markdown que é o padrão do serviço.
  {
    nome: 'r.jina.ai',
    url: (alvo) => `https://r.jina.ai/${alvo}`,
    headers: { 'x-respond-with': 'html' },
  },
  {
    nome: 'allorigins',
    url: (alvo) => `https://api.allorigins.win/raw?url=${encodeURIComponent(alvo)}`,
  },
  {
    nome: 'codetabs',
    url: (alvo) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(alvo)}`,
  },
  {
    nome: 'corsproxy.io',
    url: (alvo) => `https://corsproxy.io/?url=${encodeURIComponent(alvo)}`,
  },
];

const TIMEOUT_MS = 30_000;

async function buscarComTimeout(url: string, headers?: Record<string, string>): Promise<string> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: abort.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const texto = await res.text();
    if (texto.trim().length < 200) throw new Error('resposta vazia');
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tenta cada proxy na ordem e devolve o primeiro HTML que `aceitar` aprovar.
 * `aceitar` existe porque um proxy pode responder 200 com uma página de erro ou de
 * captcha — só quem sabe se o conteúdo serve é quem vai fazer o parse.
 */
export async function buscarHtmlViaProxy(
  alvo: string,
  aceitar: (html: string) => boolean,
): Promise<{ html: string; proxy: string }> {
  const falhas: string[] = [];
  for (const proxy of PROXIES) {
    try {
      const html = await buscarComTimeout(proxy.url(alvo), proxy.headers);
      if (!aceitar(html)) throw new Error('página sem receita reconhecível');
      return { html, proxy: proxy.nome };
    } catch (err) {
      falhas.push(`${proxy.nome}: ${(err as Error).message}`);
    }
  }
  throw new Error(`Não foi possível ler a página. Tentativas — ${falhas.join('; ')}.`);
}
