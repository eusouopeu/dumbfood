import { describe, expect, it } from 'vitest';
import { sugerirReceitasParaPlano } from './autoPlano';
import type { GeladeiraItem, Recipe } from '../types';

function receita(id: string, titulo: string, tags: string[], favorito = false): Recipe {
  return {
    id,
    titulo,
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    ingredientes: [{ raw: '', quantidade: 1, unidade: 'unidade', item: 'ovo', gondola: 'Frios e Laticínios' }],
    modoPreparo: [],
    tags,
    favorito,
    criadoEm: Date.now(),
  };
}

describe('sugerirReceitasParaPlano', () => {
  it('prioriza favoritos', () => {
    const recipes = [receita('a', 'A', ['Massas']), receita('b', 'B', ['Carnes'], true)];
    const sugestao = sugerirReceitasParaPlano(recipes, [], new Set(), 1);
    expect(sugestao.map((r) => r.id)).toEqual(['b']);
  });

  it('ignora receitas já selecionadas', () => {
    const recipes = [receita('a', 'A', ['Massas']), receita('b', 'B', ['Carnes'])];
    const sugestao = sugerirReceitasParaPlano(recipes, [], new Set(['b']), 2);
    expect(sugestao.map((r) => r.id)).toEqual(['a']);
  });

  it('limita quantas receitas da mesma tag principal entram', () => {
    const recipes = [
      receita('a', 'Bolo A', ['Bolos']),
      receita('b', 'Bolo B', ['Bolos']),
      receita('c', 'Bolo C', ['Bolos']),
      receita('d', 'Bolo D', ['Bolos']),
      receita('e', 'Carne E', ['Carnes']),
    ];
    const sugestao = sugerirReceitasParaPlano(recipes, [], new Set(), 4);
    const bolos = sugestao.filter((r) => r.tags[0] === 'Bolos').length;
    expect(bolos).toBeLessThan(4);
    expect(sugestao.some((r) => r.id === 'e')).toBe(true);
  });

  it('respeita a quantidade pedida e não estoura o total de candidatas', () => {
    const recipes = [receita('a', 'A', []), receita('b', 'B', [])];
    expect(sugerirReceitasParaPlano(recipes, [], new Set(), 5)).toHaveLength(2);
    expect(sugerirReceitasParaPlano(recipes, [], new Set(), 0)).toHaveLength(0);
  });

  it('favorece receitas cuja cobertura da geladeira é maior', () => {
    const recipes = [
      receita('a', 'A', ['Massas']),
      { ...receita('b', 'B', ['Massas']), ingredientes: [{ raw: '', quantidade: 1, unidade: 'unidade', item: 'alho', gondola: 'Hortifruti' }] },
    ];
    const geladeira: GeladeiraItem[] = [{ itemKey: 'alho', nome: 'alho', adicionadoEm: Date.now() }];
    const sugestao = sugerirReceitasParaPlano(recipes, geladeira, new Set(), 1);
    expect(sugestao[0].id).toBe('b');
  });
});
