import { describe, expect, it } from 'vitest';
import { coposCheios, coposNaTela, tocarCopo } from './agua';

describe('coposCheios', () => {
  it('conta copos inteiros', () => {
    expect(coposCheios(0, 250)).toBe(0);
    expect(coposCheios(600, 250)).toBe(2);
    expect(coposCheios(-10, 250)).toBe(0);
  });
});

describe('coposNaTela', () => {
  it('mostra os copos da meta', () => {
    expect(coposNaTela(0, 250, 2000)).toBe(8);
    expect(coposNaTela(0, 300, 2000)).toBe(7);
  });
  it('mostra um copo vazio a mais depois de bater a meta', () => {
    expect(coposNaTela(2000, 250, 2000)).toBe(9);
  });
});

describe('tocarCopo', () => {
  it('copo vazio soma um copo', () => {
    expect(tocarCopo(0, 250, 0)).toBe(250);
    expect(tocarCopo(500, 250, 5)).toBe(750);
  });
  it('copo cheio desfaz a partir dele', () => {
    expect(tocarCopo(750, 250, 2)).toBe(500);
    expect(tocarCopo(750, 250, 0)).toBe(0);
  });
});
