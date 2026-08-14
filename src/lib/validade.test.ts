import { describe, expect, it } from 'vitest';
import { diasParaVencer, statusValidade, rotuloValidade } from './validade';

const HOJE = new Date(2026, 7, 13, 15, 0, 0).getTime(); // 13/ago/2026, meio da tarde

function emDias(n: number): number {
  return HOJE + n * 24 * 60 * 60 * 1000;
}

describe('diasParaVencer', () => {
  it('conta dias de calendário, ignorando a hora', () => {
    expect(diasParaVencer(emDias(3), HOJE)).toBe(3);
    expect(diasParaVencer(emDias(-2), HOJE)).toBe(-2);
    expect(diasParaVencer(HOJE, HOJE)).toBe(0);
  });
});

describe('statusValidade', () => {
  it('classifica vencido, vence hoje, próximo e ok', () => {
    expect(statusValidade(emDias(-1), HOJE)).toBe('vencido');
    expect(statusValidade(emDias(0), HOJE)).toBe('vence_hoje');
    expect(statusValidade(emDias(2), HOJE)).toBe('proximo');
    expect(statusValidade(emDias(3), HOJE)).toBe('proximo');
    expect(statusValidade(emDias(4), HOJE)).toBe('ok');
  });

  it('aceita janela de aviso customizada', () => {
    expect(statusValidade(emDias(5), HOJE, 7)).toBe('proximo');
  });
});

describe('rotuloValidade', () => {
  it('formata o texto amigável', () => {
    expect(rotuloValidade(emDias(-1), HOJE)).toBe('venceu há 1 dia');
    expect(rotuloValidade(emDias(-3), HOJE)).toBe('venceu há 3 dias');
    expect(rotuloValidade(emDias(0), HOJE)).toBe('vence hoje');
    expect(rotuloValidade(emDias(1), HOJE)).toBe('vence amanhã');
    expect(rotuloValidade(emDias(5), HOJE)).toBe('vence em 5 dias');
  });
});
