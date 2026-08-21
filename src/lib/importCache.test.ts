import { beforeEach, describe, expect, it } from 'vitest';
import {
  JANELA_LIMITE_MS,
  MAX_REQUISICOES_JANELA,
  TTL_MS,
  chaveDeCache,
  gravarNoCache,
  lerDoCache,
  limparCache,
  limparLimites,
  registrarRequisicao,
} from './importCache';
import type { NewRecipe } from '../types';

const receita: NewRecipe = {
  titulo: 'bolo',
  rendimentoBase: { valor: 8, tipo: 'porcoes' },
  ingredientes: [],
  modoPreparo: [],
  tags: [],
};

beforeEach(() => {
  limparCache();
  limparLimites();
});

describe('chaveDeCache', () => {
  it('ignora fragmento e parâmetros de campanha', () => {
    expect(chaveDeCache('https://site.com/bolo?utm_source=x#ingredientes')).toBe('https://site.com/bolo');
  });

  it('preserva parâmetros que identificam a receita', () => {
    expect(chaveDeCache('https://site.com/r?id=42')).toBe('https://site.com/r?id=42');
  });
});

describe('cache', () => {
  it('devolve a receita gravada e expira depois do TTL', () => {
    gravarNoCache('https://site.com/bolo', receita, 0);
    expect(lerDoCache('https://site.com/bolo#topo', 1000)).toEqual(receita);
    expect(lerDoCache('https://site.com/bolo', TTL_MS + 1)).toBeNull();
  });

  it('devolve null para url nunca vista', () => {
    expect(lerDoCache('https://site.com/outra')).toBeNull();
  });
});

describe('registrarRequisicao', () => {
  it('libera até o teto e bloqueia o excedente', () => {
    for (let i = 0; i < MAX_REQUISICOES_JANELA; i++) {
      expect(registrarRequisicao('1.2.3.4', 0).permitido).toBe(true);
    }
    const bloqueado = registrarRequisicao('1.2.3.4', 0);
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.esperarSegundos).toBeGreaterThan(0);
  });

  it('libera de novo quando a janela passa', () => {
    for (let i = 0; i < MAX_REQUISICOES_JANELA; i++) registrarRequisicao('1.2.3.4', 0);
    expect(registrarRequisicao('1.2.3.4', JANELA_LIMITE_MS + 1).permitido).toBe(true);
  });

  it('conta cada cliente separadamente', () => {
    for (let i = 0; i < MAX_REQUISICOES_JANELA; i++) registrarRequisicao('1.2.3.4', 0);
    expect(registrarRequisicao('5.6.7.8', 0).permitido).toBe(true);
  });
});
