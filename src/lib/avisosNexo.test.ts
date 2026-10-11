import { describe, expect, it } from 'vitest';
import { avisosDosIngredientes, lerPacoteNexo } from './avisosNexo';

describe('avisosDosIngredientes', () => {
  const evitar = [
    { termo: 'Leite', motivo: 'teste de eliminação' },
    { termo: 'amendoim', motivo: 'alergia' },
  ];
  it('casa por palavra, sem acento e plural', () => {
    expect(avisosDosIngredientes(['leite integral', 'farinha'], evitar).map((a) => a.termo)).toEqual(['Leite']);
    expect(avisosDosIngredientes(['Amendoins torrados'], evitar).map((a) => a.termo)).toEqual(['amendoim']);
  });
  it('não casa pedaço de palavra', () => {
    expect(avisosDosIngredientes(['leiteira'], evitar)).toEqual([]);
  });
});

describe('lerPacoteNexo', () => {
  it('valida o formato', () => {
    expect(lerPacoteNexo('{"app":"nexo","versao":1,"gerado":1,"evitar":[{"termo":"ovo","motivo":"alergia"},{"termo":""}]}')?.evitar).toEqual([
      { termo: 'ovo', motivo: 'alergia' },
    ]);
    expect(lerPacoteNexo('{"app":"outro"}')).toBeNull();
    expect(lerPacoteNexo('x')).toBeNull();
  });
});
