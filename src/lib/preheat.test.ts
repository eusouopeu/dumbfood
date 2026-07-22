import { describe, it, expect } from 'vitest';
import { detectPreheat } from './preheat';

describe('detectPreheat', () => {
  it('detecta pré-aquecimento e extrai temperatura e duração', () => {
    const p = detectPreheat([
      'Bata os ovos.',
      'Pré-aqueça o forno a 180 °C por 10 minutos.',
      'Asse.',
    ]);
    expect(p).not.toBeNull();
    expect(p!.temperatura).toBe('180 °C');
    expect(p!.duracao).toBe('10 min');
  });

  it('detecta "forno preaquecido a 200º C"', () => {
    const p = detectPreheat(['Asse em forno preaquecido a 200º C.']);
    expect(p).not.toBeNull();
    expect(p!.temperatura).toBe('200 °C');
  });

  it('retorna null quando não há pré-aquecimento', () => {
    expect(detectPreheat(['Misture tudo.', 'Sirva gelado.'])).toBeNull();
  });
});
