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

  // Formato do Panelinha: o texto do passo fica dentro de um itemListElement que é
  // um objeto só (não um array). Antes disso, a receita importava sem nenhum passo.
  it('lê passos aninhados em itemListElement', () => {
    const page = html({
      '@type': 'Recipe',
      name: 'Arroz',
      recipeYield: '2',
      recipeIngredient: ['1 xícara de arroz'],
      recipeInstructions: [
        { '@type': 'HowToStep', position: 1, itemListElement: { '@type': 'HowToDirection', text: 'Lave o arroz.' } },
        { '@type': 'HowToStep', position: 2, itemListElement: { '@type': 'HowToDirection', text: 'Cozinhe.' } },
      ],
    });
    expect(parseRecipeFromHtml(page)!.modoPreparo).toEqual(['Lave o arroz.', 'Cozinhe.']);
  });

  it('lê passos agrupados em HowToSection', () => {
    const page = html({
      '@type': 'Recipe',
      name: 'Bolo',
      recipeIngredient: ['2 ovos'],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Massa', itemListElement: [{ '@type': 'HowToStep', text: 'Bata.' }] },
        { '@type': 'HowToSection', name: 'Cobertura', itemListElement: [{ '@type': 'HowToStep', text: 'Derreta.' }] },
      ],
    });
    expect(parseRecipeFromHtml(page)!.modoPreparo).toEqual(['Bata.', 'Derreta.']);
  });
});
