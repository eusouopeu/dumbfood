import { describe, it, expect } from 'vitest';
import { parseIngredient, parseIngredientBlock } from './ingredientParser';

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
});

describe('parseIngredientBlock', () => {
  it('divide linhas e ignora marcadores', () => {
    const items = parseIngredientBlock('- 2 ovos\n• 1 xícara de leite\n\n');
    expect(items).toHaveLength(2);
    expect(items[0].item).toBe('ovos');
    expect(items[1].unidade).toBe('xicara');
  });
});
