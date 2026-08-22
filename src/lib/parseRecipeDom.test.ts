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

// Estrutura das receitas do Panelinha em duas partes: cada parte tem o próprio par
// "Ingredientes" + "Modo de preparo" (ex.: cheesecake = massa + recheio).
const paginaDuasPartes = `
<html><head><title>Cheesecake de damasco | Panelinha</title></head><body>
  <h1>Cheesecake de damasco</h1>
  <dl><dt>Serve</dt><dd>Até 8 porções</dd></dl>
  <h2>Para a massa</h2>
  <h3>Ingredientes</h3>
  <ul>
    <li>1 xícara (chá) de farinha de trigo</li>
    <li>100 g de manteiga gelada cortada em cubos</li>
    <li>2 colheres (sopa) de açúcar</li>
    <li>1 ovo</li>
  </ul>
  <h3>Modo de preparo</h3>
  <ol>
    <li>Numa tigela grande, misture as farinhas com o açúcar e o sal.</li>
    <li>Modele a massa numa bola e leve à geladeira por 30 minutos.</li>
  </ol>
  <h2>Para o recheio</h2>
  <h3>Ingredientes</h3>
  <ul>
    <li>1 ricota (cerca de 500 g)</li>
    <li>⅔ de xícara (chá) de açúcar</li>
    <li>50 g de manteiga em temperatura ambiente</li>
    <li>3 ovos</li>
  </ul>
  <h3>Modo de preparo</h3>
  <ol>
    <li>Bata a ricota com o açúcar até ficar liso.</li>
    <li>Despeje sobre a massa pré-assada e leve ao forno.</li>
  </ol>
  <h3>Veja também</h3>
  <ul><li>Outra receita</li><li>Mais uma</li><li>E outra</li></ul>
</body></html>`;

describe('receitas com duas listas de ingredientes e dois modos de preparo', () => {
  it('combina os ingredientes das duas partes numa lista só', () => {
    const dom = parseRecipeFromDom(paginaDuasPartes);
    expect(dom.ingredientes).toHaveLength(8);
    expect(dom.ingredientes[0]).toContain('farinha de trigo');
    expect(dom.ingredientes[4]).toContain('ricota');
  });

  it('mantém um modo de preparo por parte, sem misturar os passos', () => {
    const dom = parseRecipeFromDom(paginaDuasPartes);
    expect(dom.secoesPreparo.map((s) => s.titulo)).toEqual(['Para a massa', 'Para o recheio']);
    expect(dom.secoesPreparo[0].passos).toHaveLength(2);
    expect(dom.secoesPreparo[1].passos[0]).toContain('Bata a ricota');
    // O preparo achatado segue a ordem das partes — é ele que o modo cozinha usa.
    expect(dom.modoPreparo).toHaveLength(4);
    expect(dom.modoPreparo[2]).toContain('Bata a ricota');
  });

  it('não captura listas fora da receita ("Veja também")', () => {
    const dom = parseRecipeFromDom(paginaDuasPartes);
    expect(dom.modoPreparo.some((p) => p.includes('Outra receita'))).toBe(false);
    expect(dom.ingredientes.some((i) => i.includes('Mais uma'))).toBe(false);
  });

  it('importa a receita inteira, com as seções, pelo caminho de fallback de marcação', () => {
    const recipe = parseRecipeFromHtml(paginaDuasPartes, 'https://panelinha.com.br/receita/cheesecake');
    expect(recipe).not.toBeNull();
    expect(recipe!.ingredientes).toHaveLength(8);
    expect(recipe!.secoesPreparo).toHaveLength(2);
    expect(recipe!.rendimentoBase).toEqual({ valor: 8, tipo: 'porcoes' });
  });

  it('receita de uma parte só continua sem seções', () => {
    const dom = parseRecipeFromDom(paginaSemJsonLd);
    expect(dom.secoesPreparo).toEqual([]);
    expect(dom.modoPreparo).toEqual(['Pique o tomate e o alho.', 'Refogue tudo e sirva.']);
  });
});
