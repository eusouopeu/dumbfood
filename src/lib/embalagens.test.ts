import { describe, expect, it } from 'vitest';
import { arredondarLinha, embalagemDe, escolherEmbalagem } from './embalagens';

describe('escolherEmbalagem', () => {
  it('escolhe o tamanho que sobra menos', () => {
    const def = { base: 'g' as const, tamanhos: [1000, 5000] };
    expect(escolherEmbalagem(700, def)).toMatchObject({ tamanho: 1000, pacotes: 1, totalBase: 1000, sobraBase: 300 });
    // 5 × 1 kg e 1 × 5 kg sobram os mesmos 200 g: o desempate escolhe menos pacotes.
    expect(escolherEmbalagem(4800, def)).toMatchObject({ tamanho: 5000, pacotes: 1, sobraBase: 200 });
  });

  it('empata a favor de menos pacotes', () => {
    const def = { base: 'g' as const, tamanhos: [500, 1000] };
    expect(escolherEmbalagem(1000, def)).toMatchObject({ tamanho: 1000, pacotes: 1, sobraBase: 0 });
  });
});

describe('embalagemDe', () => {
  it('reconhece produtos vendidos fechados', () => {
    expect(embalagemDe('farinha de trigo')?.tamanhos).toContain(1000);
    expect(embalagemDe('leite condensado')?.tamanhos).toEqual([395]);
  });

  it('deixa de fora o que é pesado no balcão', () => {
    expect(embalagemDe('cebola')).toBeUndefined();
    expect(embalagemDe('peito de frango')).toBeUndefined();
  });
});

describe('arredondarLinha', () => {
  it('sobe para a embalagem e informa a sobra', () => {
    const r = arredondarLinha('farinha de trigo', [{ unidade: 'g', quantidade: 700 }]);
    expect(r.quantidades).toEqual([{ unidade: 'kg', quantidade: 1 }]);
    expect(r.rotulo).toBe('1 kg');
    expect(r.detalhe).toContain('sobram 300 g');
  });

  it('não mexe em item vendido a granel', () => {
    const r = arredondarLinha('cenoura', [{ unidade: 'g', quantidade: 320 }]);
    expect(r.quantidades).toEqual([{ unidade: 'g', quantidade: 320 }]);
    expect(r.detalhe).toBe('');
  });

  it('arredonda item contado para cima', () => {
    const r = arredondarLinha('ovo', [{ unidade: null, quantidade: 2.5 }]);
    expect(r.quantidades).toEqual([{ unidade: null, quantidade: 3 }]);
  });

  it('preserva "a gosto"', () => {
    const r = arredondarLinha('sal', [{ unidade: null, quantidade: null }]);
    expect(r.rotulo).toBe('a gosto');
  });

  it('deixa quieto o tempero usado em pouca quantidade', () => {
    // 5 g de sal não justificam mandar comprar 1 kg e anotar 995 g de sobra.
    const r = arredondarLinha('sal', [{ unidade: 'g', quantidade: 5 }]);
    expect(r.quantidades).toEqual([{ unidade: 'g', quantidade: 5 }]);
    expect(r.detalhe).toBe('');
  });

  it('arredonda quando a receita consome parte relevante da embalagem', () => {
    const r = arredondarLinha('azeite', [{ unidade: 'ml', quantidade: 300 }]);
    expect(r.rotulo).toBe('500 ml');
    expect(r.detalhe).toContain('sobram 200 ml');
  });

  it('não inventa sobra quando a quantidade já bate com a embalagem', () => {
    const r = arredondarLinha('arroz', [{ unidade: 'kg', quantidade: 2 }]);
    expect(r.detalhe).toBe('');
    expect(r.quantidades).toEqual([{ unidade: 'kg', quantidade: 2 }]);
  });
});
