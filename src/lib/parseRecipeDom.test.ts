import { describe, it, expect } from 'vitest';
import { parseRecipeFromDom } from './parseRecipeDom';
import { parseRecipeFromHtml } from './parseRecipeHtml';

// Estrutura equivalente à do Panelinha: HTML completo, sem JSON-LD de receita.
const paginaSemJsonLd = `
<html><head>
  <title>Arroz caldoso | Panelinha</title>
  <meta property="og:image" content="https://exemplo/foto.jpg" />
</head><body>
  <nav><ul><li>Início</li><li>Receitas</li><li>Vídeos</li></ul></nav>
  <h1>Arroz caldoso com ragu</h1>
  <p>Rende 2 porções.</p>
  <div>
    <h5>Ingredientes</h5>
    <ul>
      <li> &frac12; x&iacute;cara (ch&aacute;) de <a href="/x">sobra de ragu</a> </li>
      <li> &frac12; x&iacute;cara (ch&aacute;) de arroz </li>
      <li> 1 tomate </li>
      <li> 2 dentes de alho </li>
      <li> sal e pimenta a gosto </li>
    </ul>
  </div>
  <div>
    <h5>Modo de preparo</h5>
    <ol><li>Pique o tomate e o alho.</li></ol>
    <ol><li>Refogue tudo e sirva.</li></ol>
  </div>
  <h3>Veja também</h3>
  <ul><li>Outra receita</li><li>Mais uma</li><li>E outra</li></ul>
</body></html>`;

describe('parseRecipeFromDom', () => {
  it('lê ingredientes e preparo de uma página sem dados estruturados', () => {
    const dom = parseRecipeFromDom(paginaSemJsonLd);
    expect(dom.titulo).toBe('Arroz caldoso com ragu');
    expect(dom.imagem).toBe('https://exemplo/foto.jpg');
    expect(dom.ingredientes).toHaveLength(5);
    expect(dom.ingredientes[0]).toContain('½ xícara');
    expect(dom.ingredientes[0]).toContain('sobra de ragu');
    expect(dom.modoPreparo).toEqual(['Pique o tomate e o alho.', 'Refogue tudo e sirva.']);
    expect(dom.rendimento).toEqual({ valor: 2, tipo: 'porcoes' });
  });

  it('ignora menus de navegação e listas de links', () => {
    const dom = parseRecipeFromDom(paginaSemJsonLd);
    expect(dom.ingredientes.some((i) => i.includes('Vídeos'))).toBe(false);
    expect(dom.ingredientes.some((i) => i.includes('Outra receita'))).toBe(false);
  });

  it('junta listas vizinhas (massa + cobertura)', () => {
    const html = `<h2>Ingredientes</h2>
      <ul><li>2 xícaras de farinha</li><li>3 ovos</li><li>1 xícara de leite</li></ul>
      <h3>Para a cobertura</h3>
      <ul><li>1 lata de leite condensado</li><li>2 colheres de chocolate</li><li>1 colher de manteiga</li></ul>`;
    expect(parseRecipeFromDom(html).ingredientes).toHaveLength(6);
  });
});

describe('parseRecipeFromHtml com fallback de marcação', () => {
  it('importa a receita mesmo sem JSON-LD', () => {
    const r = parseRecipeFromHtml(paginaSemJsonLd, 'https://exemplo/arroz');
    expect(r).not.toBeNull();
    expect(r!.titulo).toBe('Arroz caldoso com ragu');
    expect(r!.fonteUrl).toBe('https://exemplo/arroz');
    // "sal e pimenta a gosto" vira dois itens.
    expect(r!.ingredientes.map((i) => i.item)).toContain('sal');
    expect(r!.ingredientes.map((i) => i.item)).toContain('pimenta');
    const arroz = r!.ingredientes.find((i) => i.item === 'arroz')!;
    expect(arroz.quantidade).toBe(0.5);
    expect(arroz.unidade).toBe('xicara');
  });

  it('continua retornando null em páginas que não são receita', () => {
    expect(parseRecipeFromHtml('<html><body><p>Um texto qualquer.</p></body></html>')).toBeNull();
  });
});
