import { describe, expect, it } from 'vitest';
import { sugerirSubstitutos, sugerirSubstitutosParaItem } from './substitutions';
import { normalizeItemKey } from './ingredientParser';

describe('sugerirSubstitutos', () => {
  it('encontra substitutos por chave normalizada', () => {
    expect(sugerirSubstitutos(normalizeItemKey('creme de leite'))).toContain('iogurte natural');
    expect(sugerirSubstitutos(normalizeItemKey('manteiga')).length).toBeGreaterThan(0);
  });

  it('retorna vazio para ingrediente sem substituto cadastrado', () => {
    expect(sugerirSubstitutos(normalizeItemKey('camarao'))).toEqual([]);
  });
});

describe('sugerirSubstitutosParaItem', () => {
  it('ignora preposição solta do parser antes de buscar', () => {
    expect(sugerirSubstitutosParaItem('de manteiga')).toEqual(sugerirSubstitutos(normalizeItemKey('manteiga')));
  });

  it('funciona com plural', () => {
    expect(sugerirSubstitutosParaItem('ovos').length).toBeGreaterThan(0);
  });
});
