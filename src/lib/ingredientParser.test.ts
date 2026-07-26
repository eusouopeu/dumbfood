import { describe, it, expect } from 'vitest';
import {
  parseIngredient,
  parseIngredientes,
  parseIngredientBlock,
  reprocessarIngrediente,
} from './ingredientParser';
import type { Ingredient } from '../types';

describe('parseIngredient', () => {
  it('separa quantidade, unidade e item', () => {
    const r = parseIngredient('2 xícaras de farinha de trigo');
    expect(r.quantidade).toBe(2);
    expect(r.unidade).toBe('xicara');
    expect(r.item).toBe('farinha de trigo');
  });

  it('entende fração 1/2 e colher de chá', () => {
    const r = parseIngredient('1/2 colher de chá de sal');
    expect(r.quantidade).toBe(0.5);
    expect(r.unidade).toBe('colher_cha');
    expect(r.item).toBe('sal');
  });

  it('entende número misto 1 1/2', () => {
    const r = parseIngredient('1 1/2 xícara de açúcar');
    expect(r.quantidade).toBe(1.5);
    expect(r.unidade).toBe('xicara');
  });

  it('entende "3 e 1/2 xícaras" (valor após o "e")', () => {
    const r = parseIngredient('3 e 1/2 xícaras de farinha de trigo');
    expect(r.quantidade).toBe(3.5);
    expect(r.unidade).toBe('xicara');
    expect(r.item).toBe('farinha de trigo');
  });

  it('entende "1 e meia xícara"', () => {
    const r = parseIngredient('1 e meia xícara de leite');
    expect(r.quantidade).toBe(1.5);
    expect(r.unidade).toBe('xicara');
  });

  it('conta dentes de alho', () => {
    const r = parseIngredient('3 dentes de alho');
    expect(r.quantidade).toBe(3);
    expect(r.unidade).toBe('dente');
    expect(r.item).toBe('alho');
    expect(r.gondola).toBe('Hortifruti');
  });

  it('trata "a gosto" como sem quantidade', () => {
    const r = parseIngredient('sal a gosto');
    expect(r.quantidade).toBeNull();
    expect(r.item).toBe('sal');
  });

  it('entende decimal com vírgula e kg', () => {
    const r = parseIngredient('1,5 kg de tomate');
    expect(r.quantidade).toBe(1.5);
    expect(r.unidade).toBe('kg');
    expect(r.item).toBe('tomate');
  });

  it('itens sem unidade viram contagem', () => {
    const r = parseIngredient('3 ovos');
    expect(r.quantidade).toBe(3);
    expect(r.unidade).toBeNull();
    expect(r.item).toBe('ovos');
  });

  it('remove notas de preparo do item', () => {
    const r = parseIngredient('2 cebolas picadas');
    expect(r.item).toBe('cebolas');
  });

  it('não confunde "sal" com "salsinha"', () => {
    expect(parseIngredient('1 maço de salsinha').gondola).toBe('Hortifruti');
  });

  // A preposição entre quantidade e unidade fazia a unidade se perder, e o ingrediente
  // virava contagem ("3/4 un xícara de óleo").
  it('entende preposição entre a quantidade e a unidade', () => {
    const r = parseIngredient('3/4 de xícara (chá) de óleo');
    expect(r.quantidade).toBe(0.75);
    expect(r.unidade).toBe('xicara');
    expect(r.item).toBe('óleo');
  });

  it('entende "de um copo"', () => {
    const r = parseIngredient('1/2 de um copo de leite');
    expect(r.unidade).toBe('copo');
    expect(r.item).toBe('leite');
  });

  it('normaliza "colher (sopa)" e "xícara (chá)"', () => {
    expect(parseIngredient('1 colher (sopa) de manteiga').unidade).toBe('colher_sopa');
    expect(parseIngredient('2 xícaras (chá) de açúcar').unidade).toBe('xicara');
    expect(parseIngredient('1 e 1/2 xícara de chá de açúcar refinado').item).toBe('açúcar refinado');
  });

  it('não deixa o item começar com preposição', () => {
    expect(parseIngredient('1 xícara (chá) de leite').item).toBe('leite');
    expect(parseIngredient('4 colheres (sopa) de óleo').item).toBe('óleo');
  });

  it('remove termos que não descrevem o ingrediente', () => {
    expect(parseIngredient('3 cenouras médias raladas').item).toBe('cenouras');
    expect(parseIngredient('4 ovos em temperatura ambiente').item).toBe('ovos');
    expect(parseIngredient('200 gramas de cenoura picadinha').item).toBe('cenoura');
    expect(parseIngredient('2 tomates sem pele e sem sementes').item).toBe('tomates');
  });

  it('fica só com a primeira alternativa em "ou"', () => {
    expect(parseIngredient('3 colheres de achocolatado ou 4 colheres de chocolate em pó').item).toBe(
      'achocolatado',
    );
  });

  it('descarta pontuação final de listas de blog', () => {
    expect(parseIngredient('150 ml de óleo.').item).toBe('óleo');
  });
});

describe('parseIngredientes (linhas compostas)', () => {
  it('separa "manteiga e farinha de trigo para untar"', () => {
    const r = parseIngredientes('manteiga e farinha de trigo para untar e polvilhar a fôrma');
    expect(r.map((i) => i.item)).toEqual(['manteiga', 'farinha de trigo']);
    expect(r[0].gondola).toBe('Frios e Laticínios');
    expect(r[1].gondola).toBe('Massas e Grãos');
  });

  it('separa "sal e pimenta a gosto"', () => {
    const r = parseIngredientes('sal e pimenta-do-reino moída na hora a gosto');
    expect(r.map((i) => i.item)).toEqual(['sal', 'pimenta-do-reino']);
    expect(r.every((i) => i.quantidade === null)).toBe(true);
  });

  it('não separa quando há quantidade (não dá para saber quanto vai de cada)', () => {
    const r = parseIngredientes('2 xícaras de arroz e feijão');
    expect(r).toHaveLength(1);
  });

  it('não separa nomes compostos longos', () => {
    const r = parseIngredientes('creme de leite fresco e leite condensado gelado da geladeira');
    expect(r).toHaveLength(1);
  });
});

describe('parseIngredientBlock', () => {
  it('divide linhas e ignora marcadores', () => {
    const items = parseIngredientBlock('- 2 ovos\n• 1 xícara de leite\n\n');
    expect(items).toHaveLength(2);
    expect(items[0].item).toBe('ovos');
    expect(items[1].unidade).toBe('xicara');
  });
});

describe('reprocessarIngrediente (migração de receitas já salvas)', () => {
  it('limpa o nome antigo sem mexer na quantidade reescalada', () => {
    // Como ficava salvo antes: nome com preposição, quantidade já reescalada pelo usuário.
    const antigo: Ingredient = {
      raw: '2 xícaras (chá) de açúcar',
      quantidade: 0.66,
      unidade: 'xicara',
      item: 'de açúcar',
      gondola: 'Temperos e Condimentos',
    };
    const novo = reprocessarIngrediente(antigo);
    expect(novo.item).toBe('açúcar');
    expect(novo.quantidade).toBe(0.66);
    expect(novo.unidade).toBe('xicara');
  });

  it('recupera a unidade perdida em "3/4 de xícara"', () => {
    const antigo: Ingredient = {
      raw: '3/4 de xícara (chá) de óleo',
      quantidade: 0.75,
      unidade: null,
      item: 'xícara de óleo',
      gondola: 'Outros',
    };
    const novo = reprocessarIngrediente(antigo);
    expect(novo.unidade).toBe('xicara');
    expect(novo.item).toBe('óleo');
    expect(novo.quantidade).toBe(0.75);
  });

  it('não mexe em ingrediente sem texto original', () => {
    const semRaw = { raw: '', quantidade: 3, unidade: null, item: 'ovos', gondola: 'Frios e Laticínios' };
    expect(reprocessarIngrediente(semRaw)).toEqual(semRaw);
  });
});
