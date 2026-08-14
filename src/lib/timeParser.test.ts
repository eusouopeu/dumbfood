import { describe, expect, it } from 'vitest';
import { extrairMinutos } from './timeParser';

describe('extrairMinutos', () => {
  it('minutos simples', () => {
    expect(extrairMinutos('Asse por 20 minutos')).toBe(20);
    expect(extrairMinutos('Deixe por 5 min')).toBe(5);
    expect(extrairMinutos('Bata por 3 minuto')).toBe(3);
  });

  it('horas, com e sem minutos', () => {
    expect(extrairMinutos('Cozinhe por 1 hora')).toBe(60);
    expect(extrairMinutos('Leve ao forno por 2 horas')).toBe(120);
    expect(extrairMinutos('Deixe descansar por 1 hora e 30 minutos')).toBe(90);
    expect(extrairMinutos('Marine por 1h30')).toBe(90);
  });

  it('meia hora', () => {
    expect(extrairMinutos('Deixe descansar meia hora')).toBe(30);
  });

  it('intervalo de minutos usa a média', () => {
    expect(extrairMinutos('Asse por 20 a 30 minutos')).toBe(25);
    expect(extrairMinutos('Cozinhe 10-20 minutos')).toBe(15);
  });

  it('ignora quantidades que não são duração', () => {
    expect(extrairMinutos('Adicione 2 ovos e misture')).toBeNull();
    expect(extrairMinutos('Unte a forma com manteiga')).toBeNull();
    expect(extrairMinutos('Adicione 200g de farinha')).toBeNull();
  });

  it('retorna null quando não há menção de tempo', () => {
    expect(extrairMinutos('Sirva em seguida')).toBeNull();
  });
});
