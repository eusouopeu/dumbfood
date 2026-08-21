import { describe, expect, it } from 'vitest';
import { extrairLegenda } from './ocrLegenda';

describe('extrairLegenda', () => {
  it('respeita os cabeçalhos de ingredientes e preparo', () => {
    const r = extrairLegenda(
      [
        'Bolo de cenoura de liquidificador 🥕',
        'INGREDIENTES:',
        '- 3 cenouras médias',
        '- 3 ovos',
        '- 2 xícaras de açúcar',
        'MODO DE PREPARO:',
        '1. Bata tudo no liquidificador',
        '2. Asse por 40 minutos',
      ].join('\n'),
    );
    expect(r.titulo).toBe('Bolo de cenoura de liquidificador');
    expect(r.ingredientes).toEqual(['3 cenouras médias', '3 ovos', '2 xícaras de açúcar']);
    expect(r.preparo).toEqual(['Bata tudo no liquidificador', 'Asse por 40 minutos']);
  });

  it('descarta hashtag, arroba e chamada de engajamento', () => {
    const r = extrairLegenda(
      [
        'Frango cremoso #receitafacil #jantar',
        'salva essa receita pra fazer depois!',
        'me segue @cozinhadaana',
        '500 g de frango',
      ].join('\n'),
    );
    expect(r.titulo).toBe('Frango cremoso');
    expect(r.ingredientes).toEqual(['500 g de frango']);
    expect(r.preparo).toEqual([]);
  });

  it('sem cabeçalho, separa por quantidade/unidade', () => {
    const r = extrairLegenda(
      ['Omelete de forno', '4 ovos', 'sal a gosto', 'Leve ao forno até dourar'].join('\n'),
    );
    expect(r.ingredientes).toEqual(['4 ovos', 'sal a gosto']);
    expect(r.preparo).toEqual(['Leve ao forno até dourar']);
  });

  it('entende frações e marcadores de lista da legenda', () => {
    const r = extrairLegenda(['Panqueca', '• ½ xícara de leite', '✅ 1 ovo'].join('\n'));
    expect(r.ingredientes).toEqual(['½ xícara de leite', '1 ovo']);
  });

  it('devolve tudo vazio para legenda só de ruído', () => {
    const r = extrairLegenda('#fyp #viral\n😍😍😍\nlink na bio');
    expect(r.ingredientes).toEqual([]);
    expect(r.preparo).toEqual([]);
    expect(r.titulo).toBe('');
  });
});
