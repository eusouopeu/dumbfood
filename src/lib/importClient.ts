// Cliente de importação: por URL ou por texto colado (parser local).

import type { NewRecipe } from '../types';
import { parseIngredientBlock } from './ingredientParser';
import { parseRecipeFromHtml } from './parseRecipeHtml';
import { buscarHtmlViaProxy } from './fetchViaProxy';
import { gerarTags } from './tags';

function normalizarUrl(entrada: string): string {
  const texto = entrada.trim();
  const comEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
  let parsed: URL;
  try {
    parsed = new URL(comEsquema);
  } catch {
    throw new Error('Link inválido. Confira o endereço da receita.');
  }
  if (!parsed.hostname.includes('.')) throw new Error('Link inválido. Confira o endereço da receita.');
  return parsed.toString();
}

/**
 * Tenta o endpoint próprio primeiro (existe no `npm run dev` e em hospedagens com
 * serverless); no GitHub Pages ele não existe, e aí a importação segue pelos proxies
 * com o parse acontecendo aqui mesmo no navegador.
 */
async function tentarEndpointProprio(url: string): Promise<NewRecipe | null> {
  try {
    const res = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
    const tipo = res.headers.get('content-type') ?? '';
    // Sem serverless, o host devolve o index.html do app com status 200.
    if (!tipo.includes('application/json')) return null;
    const body = await res.json();
    if (!res.ok) return null;
    return body as NewRecipe;
  } catch {
    return null;
  }
}

export async function importarPorUrl(entrada: string): Promise<NewRecipe> {
  const url = normalizarUrl(entrada);

  const direto = await tentarEndpointProprio(url);
  if (direto) return direto;

  const { html } = await buscarHtmlViaProxy(url, (pagina) => parseRecipeFromHtml(pagina, url) !== null);
  const receita = parseRecipeFromHtml(html, url);
  if (!receita) throw new Error('Não foi possível extrair uma receita desta página.');
  return receita;
}

export interface ColarInput {
  titulo: string;
  rendimentoValor: number;
  rendimentoTipo: NewRecipe['rendimentoBase']['tipo'];
  ingredientesTexto: string;
  modoPreparoTexto: string;
  tempoPreparoMin?: number;
  fonteUrl?: string;
}

export function montarPorTexto(input: ColarInput): NewRecipe {
  const titulo = input.titulo.trim() || 'Receita sem título';
  const ingredientes = parseIngredientBlock(input.ingredientesTexto);
  return {
    titulo,
    fonteUrl: input.fonteUrl?.trim() || undefined,
    rendimentoBase: {
      valor: input.rendimentoValor > 0 ? input.rendimentoValor : 1,
      tipo: input.rendimentoTipo,
    },
    ingredientes,
    modoPreparo: input.modoPreparoTexto
      .split(/\r?\n/)
      .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean),
    tags: gerarTags(titulo, ingredientes),
    tempoPreparoMin: input.tempoPreparoMin && input.tempoPreparoMin > 0 ? input.tempoPreparoMin : undefined,
  };
}
