import { describe, expect, it } from 'vitest';
import { itensComHistoricoDePreco, precoForaDoPadrao, seriePrecoItem, variacaoPreco } from './precoHistorico';
import type { Compra, CompraItem } from '../types';

const DIA = 86_400_000;

function compra(data: number, itens: Partial<CompraItem>[], mercado?: string): Compra {
  return {
    id: `c${data}`,
    data,
    mercado,
    valorTotalReal: 0,
    valorTotalEstimado: 0,
    criadoEm: data,
    itens: itens.map((i) => ({
      item: i.item ?? '',
      gondola: 'Mercearia',
      quantidadeG: i.quantidadeG ?? null,
      quantidadeUnidades: i.quantidadeUnidades ?? null,
      precoEstimado: i.precoEstimado ?? null,
    })),
  };
}

describe('seriePrecoItem', () => {
  it('devolve os preços por kg em ordem cronológica', () => {
    const compras = [
      compra(10 * DIA, [{ item: 'açúcar', quantidadeG: 2000, precoEstimado: 10 }]),
      compra(1 * DIA, [{ item: 'açúcar', quantidadeG: 1000, precoEstimado: 4 }]),
    ];
    const serie = seriePrecoItem('açúcar', compras);
    expect(serie.map((p) => p.precoUnitario)).toEqual([4, 5]);
    expect(serie.every((p) => p.base === 'kg')).toBe(true);
  });

  it('descarta pontos de base diferente da mais recente', () => {
    const compras = [
      compra(1 * DIA, [{ item: 'ovo', quantidadeUnidades: 12, precoEstimado: 12 }]),
      compra(2 * DIA, [{ item: 'ovo', quantidadeG: 600, precoEstimado: 12 }]),
    ];
    const serie = seriePrecoItem('ovo', compras);
    expect(serie).toHaveLength(1);
    expect(serie[0].base).toBe('kg');
  });
});

describe('variacaoPreco', () => {
  it('mede a variação de ponta a ponta', () => {
    const compras = [
      compra(0, [{ item: 'arroz', quantidadeG: 1000, precoEstimado: 5 }]),
      compra(30 * DIA, [{ item: 'arroz', quantidadeG: 1000, precoEstimado: 6 }]),
    ];
    const v = variacaoPreco(seriePrecoItem('arroz', compras));
    expect(v?.percentual).toBe(20);
    expect(v?.dias).toBe(30);
  });

  it('devolve null com um único ponto', () => {
    expect(variacaoPreco(seriePrecoItem('arroz', [compra(0, [{ item: 'arroz', quantidadeG: 1000, precoEstimado: 5 }])]))).toBeNull();
  });
});

describe('precoForaDoPadrao', () => {
  const compras = [0, 1, 2].map((i) => compra(i * DIA, [{ item: 'feijão', quantidadeG: 1000, precoEstimado: 10 }]));
  const serie = seriePrecoItem('feijão', compras);

  it('aponta preço bem acima da mediana', () => {
    expect(precoForaDoPadrao(13, serie)).toBe('alto');
  });

  it('aponta preço bem abaixo', () => {
    expect(precoForaDoPadrao(7, serie)).toBe('baixo');
  });

  it('fica quieto dentro da faixa normal', () => {
    expect(precoForaDoPadrao(10.5, serie)).toBeNull();
  });

  it('não opina com histórico curto demais', () => {
    expect(precoForaDoPadrao(100, serie.slice(0, 2))).toBeNull();
  });
});

describe('itensComHistoricoDePreco', () => {
  it('lista do que mais subiu para o que mais caiu', () => {
    const compras = [
      compra(0, [
        { item: 'açúcar', quantidadeG: 1000, precoEstimado: 5 },
        { item: 'café', quantidadeG: 500, precoEstimado: 10 },
      ]),
      compra(30 * DIA, [
        { item: 'açúcar', quantidadeG: 1000, precoEstimado: 10 },
        { item: 'café', quantidadeG: 500, precoEstimado: 9 },
      ]),
    ];
    const itens = itensComHistoricoDePreco(compras);
    expect(itens.map((i) => i.nome)).toEqual(['açúcar', 'café']);
    expect(itens[0].variacao?.percentual).toBe(100);
    expect(itens[1].variacao?.percentual).toBe(-10);
  });
});
