// Função serverless (formato Vercel) que lê uma NFC-e a partir da URL do QR Code do
// cupom. Mesma razão de existir do /api/import: o portal da SEFAZ não libera CORS,
// então a busca precisa acontecer do lado do servidor.

import { fetchAndParseNfce } from '../src/lib/fetchNfce';
import { registrarRequisicao } from '../src/lib/importCache';

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

  // Nota fiscal não é cacheada: cada consulta é de um cupom diferente, e o conteúdo
  // é do usuário. Só o limite por IP se aplica, para o endpoint não virar proxy aberto.
  const limite = registrarRequisicao(clienteDe(req));
  if (!limite.permitido) {
    res.setHeader('Retry-After', String(limite.esperarSegundos));
    res.status(429).json({ error: `Muitas consultas seguidas. Tente de novo em ${limite.esperarSegundos}s.` });
    return;
  }

  try {
    const nota = await fetchAndParseNfce(url);
    if (nota.itens.length === 0) {
      res.status(422).json({ error: 'Não foi possível ler os itens dessa nota.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(nota);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
