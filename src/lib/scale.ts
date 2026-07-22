// Reescala de quantidades de ingredientes por um fator.

import type { Ingredient, RecipeYield } from '../types';

/** Multiplica as quantidades numéricas pelo fator; mantém "a gosto" (null) intacto. */
export function scaleIngredients(ingredientes: Ingredient[], fator: number): Ingredient[] {
  if (!Number.isFinite(fator) || fator <= 0) fator = 1;
  return ingredientes.map((ing) => ({
    ...ing,
    quantidade: ing.quantidade === null ? null : round(ing.quantidade * fator),
  }));
}

/** Fator para atingir um rendimento-alvo a partir do rendimento base. */
export function fatorParaRendimento(base: RecipeYield, alvoValor: number): number {
  if (!base.valor || base.valor <= 0) return 1;
  const f = alvoValor / base.valor;
  return Number.isFinite(f) && f > 0 ? f : 1;
}

/** Arredonda para no máximo 2 casas, evitando ruído de ponto flutuante. */
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formata uma quantidade numérica de forma amigável (frações comuns e inteiros). */
export function formatQuantidade(n: number | null): string {
  if (n === null) return 'a gosto';
  const rounded = round(n);
  if (Number.isInteger(rounded)) return String(rounded);
  // Frações comuns para leitura de cozinha.
  const frac: Record<string, string> = {
    '0.25': '¼', '0.5': '½', '0.75': '¾', '0.33': '⅓', '0.67': '⅔',
  };
  const inteiro = Math.floor(rounded);
  const resto = round(rounded - inteiro);
  const key = resto.toFixed(2).replace(/0$/, '');
  const fkey = frac[resto.toString()] ?? frac[key];
  if (fkey) return inteiro > 0 ? `${inteiro} ${fkey}` : fkey;
  return rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
