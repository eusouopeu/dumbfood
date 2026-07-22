// Cliente de importação: por URL (via /api/import) ou por texto colado (parser local).

import type { NewRecipe } from '../types';
import { parseIngredientBlock } from './ingredientParser';

export async function importarPorUrl(url: string): Promise<NewRecipe> {
  const res = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Falha na importação (status ${res.status}).`);
  }
  return body as NewRecipe;
}

export interface ColarInput {
  titulo: string;
  rendimentoValor: number;
  rendimentoTipo: NewRecipe['rendimentoBase']['tipo'];
  ingredientesTexto: string;
  modoPreparoTexto: string;
  fonteUrl?: string;
}

export function montarPorTexto(input: ColarInput): NewRecipe {
  return {
    titulo: input.titulo.trim() || 'Receita sem título',
    fonteUrl: input.fonteUrl?.trim() || undefined,
    rendimentoBase: {
      valor: input.rendimentoValor > 0 ? input.rendimentoValor : 1,
      tipo: input.rendimentoTipo,
    },
    ingredientes: parseIngredientBlock(input.ingredientesTexto),
    modoPreparo: input.modoPreparoTexto
      .split(/\r?\n/)
      .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean),
  };
}
