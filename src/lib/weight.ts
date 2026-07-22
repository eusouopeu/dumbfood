// Converte uma quantidade de ingrediente (qualquer unidade) para gramas equivalentes.
// Usado pelo cálculo nutricional e pelo casamento de preços — não pela lista de mercado em si,
// que mostra as quantidades já convertidas (ver shoppingList.ts).

import { deburr, normalizeItemKey } from './ingredientParser';
import { unitDefByCanonical } from './units';
import { padronizarMedida, densidadeDe } from './measures';
import { round } from './scale';

// Peso médio (g) de uma unidade "inteira" de itens comumente contados, não pesados.
// Ordem importa: chaves mais específicas antes das genéricas.
const PESO_UNIDADE_G: Array<[string, number]> = [
  ['batata-doce', 180],
  ['batata doce', 180],
  ['batata', 150],
  ['ovo', 50],
  ['cenoura', 80],
  ['cebola', 150],
  ['tomate', 120],
  ['banana', 100],
  ['limão', 70],
  ['maçã', 130],
  ['laranja', 180],
  ['pepino', 200],
  ['abobrinha', 200],
  ['berinjela', 250],
  ['pimentão', 150],
  ['pão francês', 50],
  ['pãozinho', 50],
];

function pesoUnidadeDe(key: string): number | undefined {
  for (const [k, g] of PESO_UNIDADE_G) if (key.includes(deburr(k))) return g;
  return undefined;
}

/** Estima o peso em gramas de uma quantidade de ingrediente; null quando não é possível estimar. */
export function pesoEmGramas(item: string, quantidade: number | null, unidade: string | null): number | null {
  if (quantidade === null) return null;
  const key = normalizeItemKey(item);

  if (unidade === null) {
    const g = pesoUnidadeDe(key);
    return g !== undefined ? round(quantidade * g) : null;
  }

  const def = unitDefByCanonical(unidade);
  if (!def) return null;

  if (def.dimension === 'massa') return round(quantidade * def.toBase);

  if (def.dimension === 'volume') {
    // Densidade conhecida quando disponível; caso contrário assume ~1 g/ml (base aquosa).
    const ml = quantidade * def.toBase;
    const dens = densidadeDe(key) ?? 1;
    return round(ml * dens);
  }

  if (def.dimension === 'cozinha') {
    const met = padronizarMedida(item, quantidade, unidade, 'metrico');
    if (met.unidade && met.unidade !== unidade) return pesoEmGramas(item, met.quantidade, met.unidade);
    return null; // pitada/fio/gota: sem volume conhecido
  }

  if (def.dimension === 'contagem' && unidade === 'unidade') {
    const g = pesoUnidadeDe(key);
    return g !== undefined ? round(quantidade * g) : null;
  }

  return null; // lata, pacote, dente etc.: sem peso padrão confiável
}
