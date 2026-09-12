import { describe, expect, it } from 'vitest';
import { chaveRefeicaoNova, distribuicaoRefeicoes, kcalRecomendada } from './refeicoes';

describe('chaveRefeicaoNova', () => {
  it('normaliza o rótulo e evita colidir com refeições já existentes', () => {
    expect(chaveRefeicaoNova('Ceia', ['cafe', 'almoco', 'lanche', 'jantar'])).toBe('ceia');
    expect(chaveRefeicaoNova('Café', ['cafe', 'almoco', 'lanche', 'jantar'])).toBe('cafe-2');
    expect(chaveRefeicaoNova('Pré treino', ['cafe', 'pre-treino'])).toBe('pre-treino-2');
  });

  it('nunca devolve chave vazia', () => {
    expect(chaveRefeicaoNova('   ', [])).toBe('refeicao');
  });
});

describe('distribuicaoRefeicoes', () => {
  it('mantém a divisão padrão quando só existem as quatro refeições fixas', () => {
    const d = distribuicaoRefeicoes(['cafe', 'almoco', 'lanche', 'jantar']);
    expect(d.cafe).toBeCloseTo(0.25, 5);
    expect(d.almoco).toBeCloseTo(0.35, 5);
    expect(d.lanche).toBeCloseTo(0.1, 5);
    expect(d.jantar).toBeCloseTo(0.3, 5);
  });

  it('renormaliza para 100% quando entra uma refeição personalizada', () => {
    const chaves = ['cafe', 'almoco', 'lanche', 'jantar', 'ceia'];
    const d = distribuicaoRefeicoes(chaves);
    const soma = chaves.reduce((s, c) => s + d[c], 0);
    expect(soma).toBeCloseTo(1, 5);
    expect(d.ceia).toBeGreaterThan(0);
    // A ordem relativa das fixas não muda: almoço continua sendo a maior.
    expect(d.almoco).toBeGreaterThan(d.jantar);
  });

  it('as kcal recomendadas das refeições somam a meta do dia', () => {
    const chaves = ['cafe', 'almoco', 'lanche', 'jantar', 'ceia'];
    const soma = chaves.reduce((s, c) => s + kcalRecomendada(2200, c, chaves), 0);
    expect(Math.abs(soma - 2200)).toBeLessThanOrEqual(3);
  });
});
