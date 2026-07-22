import { describe, it, expect } from 'vitest';
import { parseRecipeFromHtml } from './parseRecipeHtml';

const html = (jsonld: object) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body></body></html>`;

describe('parseRecipeFromHtml', () => {
  it('extrai receita de JSON-LD simples', () => {
    const page = html({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Bolo de cenoura',
      recipeYield: '8 porções',
      recipeIngredient: ['2 xícaras de farinha', '3 ovos', '1 xícara de óleo'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Bata tudo.' }, { '@type': 'HowToStep', text: 'Asse.' }],
    });
    const r = parseRecipeFromHtml(page, 'https://x.com/bolo');
    expect(r).not.toBeNull();
    expect(r!.titulo).toBe('Bolo de cenoura');
    expect(r!.rendimentoBase).toEqual({ valor: 8, tipo: 'porcoes' });
    expect(r!.ingredientes).toHaveLength(3);
    expect(r!.modoPreparo).toEqual(['Bata tudo.', 'Asse.']);
    expect(r!.fonteUrl).toBe('https://x.com/bolo');
  });

  it('encontra Recipe dentro de @graph', () => {
    const page = html({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'página' },
        { '@type': ['Recipe'], name: 'Pão', recipeIngredient: ['500 g de farinha'] },
      ],
    });
    const r = parseRecipeFromHtml(page, undefined);
    expect(r).not.toBeNull();
    expect(r!.titulo).toBe('Pão');
  });

  it('retorna null quando não há receita', () => {
    const page = html({ '@type': 'Article', name: 'Texto' });
    expect(parseRecipeFromHtml(page)).toBeNull();
  });
});
