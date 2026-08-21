// Função serverless (formato Vercel) que importa uma receita por URL.
// Contorna CORS/anti-bot buscando a página do lado servidor e extraindo o JSON-LD.
// Cache em memória + limite por IP ficam em src/lib/importCache.ts, compartilhados
// com o middleware de desenvolvimento do Vite.

import { fetchAndParseRecipe } from '../src/lib/fetchRecipe';
import { gravarNoCache, lerDoCache, registrarRequisicao } from '../src/lib/importCache';

interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface Res {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Identifica o cliente pelo IP repassado pela borda; cai para "desconhecido" fora dela. */
function clienteDe(req: Req): string {
  const encaminhado = primeiro(req.headers?.['x-forwarded-for']);
  if (encaminhado) return encaminhado.split(',')[0].trim();
  return primeiro(req.headers?.['x-real-ip']) ?? req.socket?.remoteAddress ?? 'desconhecido';
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  const url = primeiro(req.query.url);
  if (!url) {
    res.status(400).json({ error: 'Parâmetro "url" é obrigatório.' });
    return;
  }

  const cacheada = lerDoCache(url);
  if (cacheada) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(cacheada);
    return;
  }

  const limite = registrarRequisicao(clienteDe(req));
  if (!limite.permitido) {
    res.setHeader('Retry-After', String(limite.esperarSegundos));
    res.status(429).json({ error: `Muitas importações seguidas. Tente de novo em ${limite.esperarSegundos}s.` });
    return;
  }

  try {
    const recipe = await fetchAndParseRecipe(url);
    if (!recipe) {
      res.status(422).json({ error: 'Não foi possível extrair uma receita desta página.' });
      return;
    }
    gravarNoCache(url, recipe);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(recipe);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
