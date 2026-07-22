import { describe, it, expect } from 'vitest';
import { gerarTags, mesclarTags } from './tags';
import { parseIngredientLines } from './ingredientParser';

describe('gerarTags', () => {
  it('detecta Bolos pelo título', () => {
    expect(gerarTags('Bolo de cenoura', [])).toContain('Bolos');
  });

  it('detecta Carnes pelo título', () => {
    expect(gerarTags('Frango ao curry', [])).toContain('Carnes');
  });

  it('detecta Carnes pelos ingredientes', () => {
    const ings = parseIngredientLines(['600 g de peito de frango', '1 cebola']);
    expect(gerarTags('Receita da vovó', ings)).toContain('Carnes');
  });

  it('detecta Biscoitos', () => {
    expect(gerarTags('Biscoito amanteigado', [])).toContain('Biscoitos');
  });
});

describe('mesclarTags', () => {
  it('não duplica (case-insensitive)', () => {
    expect(mesclarTags(['Bolos'], ['bolos', 'Doces'])).toEqual(['Bolos', 'Doces']);
  });
});
