import { describe, expect, it } from 'vitest';
import { aplicarCorrecoes } from './correcaoLista';
import type { ListaEstado } from '../types';

const estado: ListaEstado = {
  id: 'atual',
  comprados: [],
  extras: [{ id: 'x1', raw: '1l leite morno', quantidade: 1, unidade: 'l', item: 'leite morno', gondola: 'Laticínios' }],
  overrides: {},
  ocultos: [],
};

describe('aplicarCorrecoes', () => {
  it('corrige quantidade, junta duplicada e remove água', () => {
    const r = aplicarCorrecoes(estado, [
      { id: 'Laticínios:leite', quantidade: 2000, unidade: 'ml', juntarEm: null, motivo: 'soma com leite morno' },
      { id: 'extra:x1', quantidade: null, unidade: null, juntarEm: 'Laticínios:leite', motivo: 'mesmo produto' },
      { id: 'Bebidas:agua', quantidade: null, unidade: null, juntarEm: null, motivo: 'remover: água da torneira' },
    ]);
    expect(r.patch.overrides['Laticínios:leite']).toEqual({ quantidade: 2000, unidade: 'ml' });
    expect(r.patch.extras).toHaveLength(0);
    expect(r.patch.ocultos).toEqual(['Bebidas:agua']);
    expect(r.corrigidas).toBe(1);
    expect(r.removidas).toBe(2);
  });

  it('não mexe no estado original', () => {
    aplicarCorrecoes(estado, [{ id: 'a:b', quantidade: 1, unidade: 'g', juntarEm: null, motivo: '' }]);
    expect(estado.overrides).toEqual({});
  });
});
