import { describe, it, expect } from 'vitest';
import { extrairCandidatos, candidatosParaPrecos } from './ocrNota';

describe('extrairCandidatos', () => {
  it('extrai item e preço de linhas de cupom', () => {
    const texto = [
      'CUPOM FISCAL ELETRONICO',
      '001 7891234567890 ARROZ TIPO 1 5KG            1 UN x    22,90',
      '002 7899876543210 FEIJAO CARIOCA 1KG            2 UN x    8,50',
      'VALOR TOTAL R$                                  31,40',
      'FORMA DE PAGAMENTO: CARTAO DE CREDITO',
    ].join('\n');

    const candidatos = extrairCandidatos(texto);
    expect(candidatos).toHaveLength(2);
    expect(candidatos[0].preco).toBe(22.9);
    expect(candidatos[0].item.toLowerCase()).toContain('arroz');
    expect(candidatos[1].preco).toBe(8.5);
    expect(candidatos[1].item.toLowerCase()).toContain('feijao');
  });

  it('ignora linhas de ruído sem item', () => {
    const texto = 'CNPJ: 12.345.678/0001-90\nCHAVE DE ACESSO 1234 5678\nTROCO 5,00';
    expect(extrairCandidatos(texto)).toHaveLength(0);
  });

  it('ignora linhas sem preço reconhecível', () => {
    expect(extrairCandidatos('BANANA PRATA')).toHaveLength(0);
  });

  it('descarta preços absurdos (ruído de OCR)', () => {
    const texto = 'ALGUM CODIGO ESTRANHO 12.345,99';
    expect(extrairCandidatos(texto)).toHaveLength(0);
  });
});

describe('candidatosParaPrecos', () => {
  it('converte candidatos em PrecoItem com chave normalizada', () => {
    const precos = candidatosParaPrecos([{ linhaOriginal: '', item: 'Arroz Tipo 1', preco: 22.9 }]);
    expect(precos[0]).toMatchObject({ item: 'Arroz Tipo 1', itemKey: 'arroz tipo 1', precoUnitario: 22.9, unidade: 'unidade' });
  });
});
