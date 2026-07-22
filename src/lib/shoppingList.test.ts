import { describe, it, expect } from 'vitest';
import { buildShoppingList } from './shoppingList';
import { parseIngredientLines } from './ingredientParser';
import type { Recipe, WeekPlan } from '../types';

function receita(id: string, titulo: string, linhas: string[]): Recipe {
  return {
    id,
    titulo,
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    ingredientes: parseIngredientLines(linhas),
    modoPreparo: [],
    tags: [],
    criadoEm: 0,
  };
}

describe('buildShoppingList', () => {
  it('soma ingredientes em comum e agrupa por gôndola', () => {
    const r1 = receita('1', 'Molho', ['2 cebolas', '1 kg de tomate', 'sal a gosto']);
    const r2 = receita('2', 'Sopa', ['1 cebola', '200 g de tomate']);
    const recipes = new Map([r1, r2].map((r) => [r.id, r]));
    const plan: WeekPlan = { id: 'p', itens: [{ recipeId: '1', fator: 1 }, { recipeId: '2', fator: 1 }] };

    const sections = buildShoppingList(plan, recipes);
    const hortifruti = sections.find((s) => s.gondola === 'Hortifruti')!;
    expect(hortifruti).toBeTruthy();

    const cebola = hortifruti.linhas.find((l) => l.item.includes('cebola'))!;
    // 2 (contagem) + 1 (contagem) = 3, de duas receitas
    expect(cebola.rotulo).toContain('3');
    expect(cebola.origens.length).toBe(2);
  });

  it('soma massas convertendo kg e g, promovendo para kg', () => {
    const r1 = receita('1', 'A', ['1 kg de tomate']);
    const r2 = receita('2', 'B', ['500 g de tomate']);
    const recipes = new Map([r1, r2].map((r) => [r.id, r]));
    const plan: WeekPlan = { id: 'p', itens: [{ recipeId: '1', fator: 1 }, { recipeId: '2', fator: 1 }] };

    const sections = buildShoppingList(plan, recipes);
    const linhas = sections.flatMap((s) => s.linhas);
    const tomate = linhas.find((l) => l.item.includes('tomate'))!;
    expect(tomate.rotulo).toBe('1,5 kg');
  });

  it('aplica o fator do plano', () => {
    const r1 = receita('1', 'A', ['200 g de arroz']);
    const recipes = new Map([[r1.id, r1]]);
    const plan: WeekPlan = { id: 'p', itens: [{ recipeId: '1', fator: 2 }] };

    const sections = buildShoppingList(plan, recipes);
    const arroz = sections.flatMap((s) => s.linhas).find((l) => l.item.includes('arroz'))!;
    expect(arroz.rotulo).toBe('400 g');
  });

  it('mantém unidades incompatíveis separadas', () => {
    const r1 = receita('1', 'A', ['2 xícaras de leite']);
    const r2 = receita('2', 'B', ['200 ml de leite']);
    const recipes = new Map([r1, r2].map((r) => [r.id, r]));
    const plan: WeekPlan = { id: 'p', itens: [{ recipeId: '1', fator: 1 }, { recipeId: '2', fator: 1 }] };

    const sections = buildShoppingList(plan, recipes);
    const leite = sections.flatMap((s) => s.linhas).find((l) => l.item.includes('leite'))!;
    expect(leite.rotulo).toContain('+');
    expect(leite.quantidades.length).toBe(2);
  });
});
