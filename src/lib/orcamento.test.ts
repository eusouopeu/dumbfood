import { describe, expect, it } from 'vitest';
import { statusOrcamento } from './orcamento';

describe('statusOrcamento', () => {
  it('dentro do orçamento', () => {
    expect(statusOrcamento(50, 100)).toBe('dentro');
    expect(statusOrcamento(79, 100)).toBe('dentro');
  });

  it('perto do limite (80% a 100%)', () => {
    expect(statusOrcamento(80, 100)).toBe('perto');
    expect(statusOrcamento(100, 100)).toBe('perto');
  });

  it('estourado', () => {
    expect(statusOrcamento(100.01, 100)).toBe('estourado');
    expect(statusOrcamento(150, 100)).toBe('estourado');
  });
});
