import { describe, it, expect } from 'vitest';
import { parseArquivoPrecos, buscarPreco, custoLinha } from './prices';
import type { ShoppingLine } from '../types';

describe('parseArquivoPrecos', () => {
  it('lê CSV com cabeçalho', () => {
    const csv = 'item,preco,unidade\nArroz,6.50,kg\nOvo,0.80,unidade';
    const itens = parseArquivoPrecos(csv, 'precos.csv');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ item: 'Arroz', precoUnitario: 6.5, unidade: 'kg' });
    expect(itens[1]).toMatchObject({ item: 'Ovo', precoUnitario: 0.8, unidade: 'unidade' });
  });

  it('lê CSV sem cabeçalho', () => {
    const itens = parseArquivoPrecos('Leite,4.5,l', 'precos.csv');
    expect(itens).toHaveLength(1);
    expect(itens[0].unidade).toBe('l');
  });

  it('lê JSON como array', () => {
    const json = JSON.stringify([{ item: 'Tomate', preco: 8, unidade: 'kg' }]);
    const itens = parseArquivoPrecos(json, 'precos.json');
    expect(itens).toHaveLength(1);
    expect(itens[0].itemKey).toBe('tomate');
  });

  it('lê JSON com campo "itens"', () => {
    const json = JSON.stringify({ itens: [{ produto: 'Cebola', valor: 5 }] });
    const itens = parseArquivoPrecos(json, 'precos.json');
    expect(itens[0].item).toBe('Cebola');
    expect(itens[0].unidade).toBe('kg');
  });
});

describe('buscarPreco', () => {
  it('acha por chave exata e por substring', () => {
    const precos = [{ item: 'Açúcar refinado', itemKey: 'acucar refinado', precoUnitario: 5, unidade: 'kg' as const, atualizadoEm: 0 }];
    expect(buscarPreco('acucar refinado', precos)).toBeTruthy();
    expect(buscarPreco('acucar refinado especial', precos)).toBeTruthy();
  });
});

describe('custoLinha', () => {
  it('calcula custo por kg a partir de gramas', () => {
    const linha: ShoppingLine = {
      item: 'arroz',
      gondola: 'Massas e Grãos',
      quantidades: [{ unidade: 'g', quantidade: 500 }],
      rotulo: '500 g',
      origens: [],
    };
    const precos = [{ item: 'Arroz', itemKey: 'arroz', precoUnitario: 6, unidade: 'kg' as const, atualizadoEm: 0 }];
    expect(custoLinha(linha, precos)).toBe(3);
  });

  it('retorna null quando não há preço cadastrado', () => {
    const linha: ShoppingLine = { item: 'item sem preco', gondola: 'Outros', quantidades: [], rotulo: '', origens: [] };
    expect(custoLinha(linha, [])).toBeNull();
  });
});
