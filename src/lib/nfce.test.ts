import { describe, it, expect } from 'vitest';
import { parseQrNfce, parseNfceHtml, totalDaNfce, itensNfceParaPrecos } from './nfce';

describe('parseQrNfce', () => {
  it('aceita a URL de consulta da SEFAZ e extrai a chave de acesso', () => {
    const chave = '35200114200166000187650010000000181123456789'.padEnd(44, '0').slice(0, 44);
    const qr = parseQrNfce(`https://www.fazenda.sp.gov.br/nfce/qrcode?p=${chave}|2|1|1|abcdef`);
    expect(qr?.chave).toBe(chave);
    expect(qr?.url).toContain('fazenda.sp.gov.br');
  });

  it('aceita só a chave de acesso digitada', () => {
    const chave = '4'.repeat(44);
    expect(parseQrNfce(chave)).toEqual({ url: '', chave });
  });

  it('recusa QR de outro assunto e sites fora da rede da Fazenda', () => {
    expect(parseQrNfce('https://exemplo.com/nfce?p=123')).toBeNull();
    expect(parseQrNfce('bora almoçar?')).toBeNull();
    expect(parseQrNfce('')).toBeNull();
  });
});

// Estrutura do portal de consulta da NFC-e (mesmo modelo na maioria dos estados).
const paginaNfce = `
<table id="tabResult">
  <tr id="Item + 1">
    <td><span class="txtTit">ARROZ TIPO 1 5KG</span>
      <span class="RCod">(Código: 000123)</span>
      <span class="Rqtd"><strong>Qtde.:</strong>1</span>
      <span class="RUN"><strong>UN: </strong>UN</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;24,90</span></td>
    <td class="txtTit"><span class="valor">24,90</span></td>
  </tr>
  <tr id="Item + 2">
    <td><span class="txtTit">TOMATE ITALIANO</span>
      <span class="Rqtd"><strong>Qtde.:</strong>0,850</span>
      <span class="RUN"><strong>UN: </strong>KG</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;8,99</span></td>
  </tr>
  <tr><td>Valor total R$</td><td><span class="txtMax">32,54</span></td></tr>
</table>`;

describe('parseNfceHtml', () => {
  it('lê item, quantidade, unidade e valor unitário de cada linha', () => {
    const itens = parseNfceHtml(paginaNfce);
    expect(itens).toHaveLength(2);
    expect(itens[0]).toEqual({ item: 'ARROZ TIPO 1 5KG', quantidade: 1, unidade: 'UN', valorUnitario: 24.9 });
    expect(itens[1]).toEqual({ item: 'TOMATE ITALIANO', quantidade: 0.85, unidade: 'KG', valorUnitario: 8.99 });
  });

  it('ignora linhas de rodapé sem item/preço', () => {
    expect(parseNfceHtml(paginaNfce).some((i) => i.item.includes('Valor total'))).toBe(false);
  });

  it('lê o total da nota para conferência', () => {
    expect(totalDaNfce(paginaNfce)).toBe(32.54);
  });
});

describe('itensNfceParaPrecos', () => {
  it('mapeia a unidade do cupom para a unidade de preço do app', () => {
    const precos = itensNfceParaPrecos(parseNfceHtml(paginaNfce), 0);
    expect(precos[0].unidade).toBe('unidade');
    expect(precos[1]).toMatchObject({ unidade: 'kg', precoUnitario: 8.99, itemKey: 'tomate italiano' });
  });

  it('converte preço por grama para preço por quilo', () => {
    const [preco] = itensNfceParaPrecos([{ item: 'Fermento', quantidade: 100, unidade: 'G', valorUnitario: 0.05 }], 0);
    expect(preco.precoUnitario).toBe(50);
    expect(preco.unidade).toBe('kg');
  });
});
