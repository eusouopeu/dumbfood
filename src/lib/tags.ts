// Geração automática de tags de tipo de receita a partir do título e ingredientes.

import { deburr } from './ingredientParser';
import type { Ingredient } from '../types';

// Cada tag tem palavras-chave (sem acento) buscadas no título e, em segundo plano,
// nos itens. A ordem prioriza tipos mais específicos.
const REGRAS: Array<[string, string[]]> = [
  ['Bolos', ['bolo', 'cupcake', 'muffin', 'brownie']],
  ['Tortas', ['torta', 'quiche', 'empadao', 'empada']],
  ['Biscoitos', ['biscoito', 'bolacha', 'cookie', 'sequilho', 'amanteigado']],
  ['Pães', ['pao', 'paozinho', 'brioche', 'focaccia', 'baguete', 'broa']],
  ['Massas', ['macarrao', 'massa', 'lasanha', 'nhoque', 'espaguete', 'talharim', 'panqueca', 'ravioli', 'canelone']],
  ['Pizzas', ['pizza', 'esfiha', 'calzone']],
  ['Sopas', ['sopa', 'caldo', 'creme de', 'canja']],
  ['Saladas', ['salada']],
  ['Carnes', ['carne', 'bife', 'frango', 'file', 'costela', 'linguica', 'porco', 'pernil', 'lombo', 'almondega', 'picadinho', 'peru', 'strogonoff', 'estrogonofe']],
  ['Peixes e Frutos do Mar', ['peixe', 'salmao', 'tilapia', 'bacalhau', 'camarao', 'atum', 'moqueca', 'sardinha']],
  ['Sobremesas', ['sobremesa', 'pudim', 'mousse', 'brigadeiro', 'beijinho', 'sorvete', 'pave', 'gelatina', 'doce', 'cocada', 'trufa', 'creme']],
  ['Bebidas', ['suco', 'vitamina', 'smoothie', 'drink', 'shake', 'limonada', 'cha', 'cafe', 'chocolate quente']],
  ['Molhos', ['molho', 'geleia', 'chutney', 'vinagrete']],
  ['Arroz', ['arroz', 'risoto']],
  ['Ovos', ['omelete', 'fritata', 'mexido', 'ovos']],
];

/** Deriva tags a partir do título (peso maior) e dos ingredientes. */
export function gerarTags(titulo: string, ingredientes: Ingredient[]): string[] {
  const tituloN = deburr(titulo).toLowerCase();
  const itensN = ingredientes.map((i) => deburr(i.item).toLowerCase());
  const found = new Set<string>();

  for (const [tag, palavras] of REGRAS) {
    const noTitulo = palavras.some((p) => tituloN.includes(p));
    if (noTitulo) {
      found.add(tag);
      continue;
    }
    // Fallback pelos ingredientes só para categorias de proteína principal.
    if ((tag === 'Carnes' || tag === 'Peixes e Frutos do Mar') &&
        palavras.some((p) => itensN.some((it) => it.includes(p)))) {
      found.add(tag);
    }
  }

  return Array.from(found);
}

/** Une tags existentes com novas, sem duplicar (case-insensitive), preservando ordem. */
export function mesclarTags(atuais: string[], novas: string[]): string[] {
  const vistas = new Set(atuais.map((t) => t.toLowerCase()));
  const out = [...atuais];
  for (const t of novas) {
    const norm = t.trim();
    if (norm && !vistas.has(norm.toLowerCase())) {
      vistas.add(norm.toLowerCase());
      out.push(norm);
    }
  }
  return out;
}
