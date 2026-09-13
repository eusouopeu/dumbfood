import { describe, expect, it } from 'vitest';
import { distribuirSemana } from './distribuirSemana';

describe('distribuirSemana', () => {
  it('dá ao menos um lugar para cada receita, começando hoje, sem dois pratos no mesmo lugar', () => {
    const r = distribuirSemana(
      [
        { recipeId: 'a', porcoes: 1, tipo: 'principal' },
        { recipeId: 'b', porcoes: 1, tipo: 'principal' },
      ],
      6,
    );
    expect(r.get('a')).toEqual([{ dia: 6, refeicao: 'almoco' }]);
    expect(r.get('b')).toEqual([{ dia: 6, refeicao: 'jantar' }]);
  });

  it('transforma porções em refeições intercalando receitas e pulando lugares já ocupados', () => {
    const r = distribuirSemana(
      [
        { recipeId: 'a', porcoes: 3, tipo: 'principal' },
        { recipeId: 'b', porcoes: 2, tipo: 'principal' },
      ],
      0,
      [{ dia: 0, refeicao: 'almoco' }],
    );
    expect(r.get('a')).toEqual([
      { dia: 0, refeicao: 'jantar' },
      { dia: 1, refeicao: 'jantar' },
      { dia: 2, refeicao: 'jantar' },
    ]);
    expect(r.get('b')).toEqual([
      { dia: 1, refeicao: 'almoco' },
      { dia: 2, refeicao: 'almoco' },
    ]);
  });

  it('receita de lanche vai para o lanche dos dias', () => {
    const r = distribuirSemana([{ recipeId: 'c', porcoes: 2, tipo: 'lanche' }], 1);
    expect(r.get('c')).toEqual([
      { dia: 1, refeicao: 'lanche' },
      { dia: 2, refeicao: 'lanche' },
    ]);
  });
});
