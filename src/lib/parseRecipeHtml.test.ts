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

  // O Panelinha usa `type=application/ld+json` sem aspas, e não publica recipeYield
  // nem totalTime no JSON-LD — esses dados só aparecem num bloco <dt>/<dd> na página.
  it('lê JSON-LD com atributo type sem aspas e completa rendimento/tempo pelo bloco <dt>/<dd> (Panelinha)', () => {
    const page = `<html><body>
      <script id=js_recipe_schema type=application/ld+json>${JSON.stringify({
        '@context': 'https://schema.org/',
        '@type': 'Recipe',
        name: 'Frango com quiabo',
        recipeIngredient: ['200 g de quiabo (cerca de 20 unidades)', '1 pimentão amarelo'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Cozinhe tudo.' }],
      })}</script>
      <dl>
        <div><dt>Autor</dt> <dd>Panelinha</dd></div>
        <div><dt>Tempo de preparo</dt> <dd>Até 2h</dd></div>
        <div><dt>Serve</dt> <dd>Até 6 porções</dd></div>
      </dl>
    </body></html>`;
    const r = parseRecipeFromHtml(page, 'https://panelinha.com.br/receita/frango-com-quiabo');
    expect(r).not.toBeNull();
    expect(r!.titulo).toBe('Frango com quiabo');
    expect(r!.ingredientes).toHaveLength(2);
    // Sem o fix, o rendimento pegaria "20 unidades" da lista de ingredientes.
    expect(r!.rendimentoBase).toEqual({ valor: 6, tipo: 'porcoes' });
    expect(r!.tempoPreparoMin).toBe(120);
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
