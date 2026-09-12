import { describe, expect, it } from 'vitest';
import { ajustarMacros, gramasDaMeta, kcalDoMacro, type MetaMacrosPct } from './metas';

const BASE: MetaMacrosPct = { carboidrato: 50, proteina: 20, gorduraTotal: 30 };

describe('ajustarMacros', () => {
  it('mantém a soma em 100 distribuindo a diferença nos outros macros', () => {
    const r = ajustarMacros(BASE, 'carboidrato', 60, null);
    expect(r.carboidrato).toBe(60);
    expect(r.carboidrato + r.proteina + r.gorduraTotal).toBe(100);
    // Os 10 pontos saem de proteína e gordura na proporção que tinham (20:30).
    expect(r.proteina).toBe(16);
    expect(r.gorduraTotal).toBe(24);
  });

  it('não mexe no macro travado e tira tudo do restante', () => {
    const r = ajustarMacros(BASE, 'carboidrato', 60, 'proteina');
    expect(r.proteina).toBe(20);
    expect(r.carboidrato).toBe(60);
    expect(r.gorduraTotal).toBe(20);
    expect(r.carboidrato + r.proteina + r.gorduraTotal).toBe(100);
  });

  it('limita o valor ao que sobra depois do macro travado', () => {
    const r = ajustarMacros(BASE, 'carboidrato', 95, 'proteina');
    expect(r.proteina).toBe(20);
    expect(r.carboidrato).toBe(80);
    expect(r.gorduraTotal).toBe(0);
  });

  it('ignora a edição do próprio macro travado', () => {
    expect(ajustarMacros(BASE, 'proteina', 40, 'proteina')).toEqual(BASE);
  });
});

describe('gramasDaMeta', () => {
  it('converte percentual de energia em gramas usando 4/4/9 kcal por grama', () => {
    const g = gramasDaMeta(2000, { carboidrato: 50, proteina: 20, gorduraTotal: 30 });
    expect(g.carboidrato).toBe(250); // 1000 kcal / 4
    expect(g.proteina).toBe(100); // 400 kcal / 4
    expect(g.gorduraTotal).toBe(67); // 600 kcal / 9
  });

  it('kcalDoMacro devolve a energia da fatia', () => {
    expect(kcalDoMacro(1727, 27)).toBe(466);
  });
});
