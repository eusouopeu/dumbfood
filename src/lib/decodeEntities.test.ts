import { describe, it, expect } from 'vitest';
import { decodeEntities } from './decodeEntities';

describe('decodeEntities', () => {
  it('decodifica entidades nomeadas', () => {
    expect(decodeEntities('a&ccedil;&uacute;car')).toBe('açúcar');
    expect(decodeEntities('180&deg; C')).toBe('180° C');
    expect(decodeEntities('consist&ecirc;ncia')).toBe('consistência');
  });

  it('lida com escape duplo (&amp;oacute;)', () => {
    expect(decodeEntities('&amp;oacute;leo')).toBe('óleo');
    expect(decodeEntities('at&amp;eacute;')).toBe('até');
  });

  it('decodifica numéricas', () => {
    expect(decodeEntities('caf&#233;')).toBe('café');
    expect(decodeEntities('caf&#xe9;')).toBe('café');
  });

  it('não altera texto sem entidades', () => {
    expect(decodeEntities('bolo de cenoura')).toBe('bolo de cenoura');
  });
});
