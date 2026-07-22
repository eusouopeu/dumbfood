// Função serverless (formato Vercel) que importa uma receita por URL.
// Contorna CORS/anti-bot buscando a página do lado servidor e extraindo o JSON-LD.

import { fetchAndParseRecipe } from '../src/lib/fetchRecipe';

interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  const raw = req.query.url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  if (!url) {
    res.status(400).json({ error: 'Parâmetro "url" é obrigatório.' });
    return;
  }
  try {
    const recipe = await fetchAndParseRecipe(url);
    if (!recipe) {
      res.status(422).json({ error: 'Não foi possível extrair uma receita desta página.' });
      return;
    }
    res.status(200).json(recipe);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
