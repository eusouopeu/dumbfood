import { describe, expect, it } from 'vitest';
import { distribuicao, picosDeFome, resumoFome, rotuloMinuto, sinaisDeFome, type RegistroFome } from './fome';
import type { RegistroConsumo } from '../types';

const N = { kcal: 0, gorduraTotal: 0, gorduraSaturada: 0, colesterolMg: 0, carboidrato: 0, acucares: 0, proteina: 0, fibra: 0 };
const em = (dia: string, h: number, m = 0) => {
  const [a, mes, d] = dia.split('-').map(Number);
  return new Date(a, mes - 1, d, h, m).getTime();
};
const consumo = (dia: string, h: number, m = 0, criadoNoutroDia = false): RegistroConsumo => ({
  id: `${dia}-${h}-${m}`,
  dia,
  refeicao: 'almoco',
  nome: 'x',
  porcoes: 1,
  nutrientes: N,
  criadoEm: criadoNoutroDia ? em('2026-10-09', 23) : em(dia, h, m),
});
const fome = (dia: string, h: number, m = 0): RegistroFome => ({
  id: `f${dia}${h}${m}`,
  dia,
  hora: em(dia, h, m),
  intensidade: 2,
  criadoEm: em(dia, h, m),
});

describe('sinaisDeFome', () => {
  it('usa o horário do registro só quando lançado no mesmo dia', () => {
    const s = sinaisDeFome([], [consumo('2026-10-10', 12, 30), consumo('2026-10-08', 20, 0, true)], '2026-10-10');
    expect(s).toHaveLength(1);
    expect(s[0].minuto).toBe(12 * 60 + 30);
  });

  it('itens da mesma refeição e o comer logo depois da fome não viram sinais extras', () => {
    const s = sinaisDeFome(
      [fome('2026-10-10', 11, 50)],
      [consumo('2026-10-10', 12, 30), consumo('2026-10-10', 12, 40), consumo('2026-10-10', 16)],
      '2026-10-10',
    );
    expect(s.map((x) => [x.fonte, x.minuto])).toEqual([
      ['explicito', 11 * 60 + 50],
      ['implicito', 16 * 60],
    ]);
  });

  it('pode ignorar os implícitos', () => {
    expect(sinaisDeFome([fome('2026-10-10', 9)], [consumo('2026-10-10', 15)], '2026-10-10', 30, false)).toHaveLength(1);
  });
});

describe('picosDeFome', () => {
  it('acha os horários que se repetem', () => {
    const dias = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const consumoRegs = dias.flatMap((d, i) => [consumo(d, 12, 20 + i * 5), consumo(d, 20, i * 10)]);
    const extras = dias.map((d) => fome(d, 15, 30));
    const picos = picosDeFome(sinaisDeFome(extras, consumoRegs, '2026-10-10'));
    expect(picos.map((p) => Math.round(p.minuto / 60))).toEqual([12, 16, 20]);
    expect(picos[1].frequencia).toBe(1);
  });

  it('vazio sem dados', () => {
    expect(picosDeFome([])).toEqual([]);
  });
});

describe('resumo e rótulos', () => {
  it('conta fontes e mediana da primeira fome', () => {
    const s = sinaisDeFome([fome('2026-10-09', 9)], [consumo('2026-10-09', 13), consumo('2026-10-10', 10)], '2026-10-10');
    const r = resumoFome(s);
    expect(r).toMatchObject({ explicitos: 1, implicitos: 2, dias: 2, primeiraFome: (9 * 60 + 10 * 60) / 2 });
    expect(r.intervaloMedio).toBe(240);
    expect(distribuicao(s).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('formata horário', () => {
    expect(rotuloMinuto(9 * 60)).toBe('9h');
    expect(rotuloMinuto(15 * 60 + 5)).toBe('15h05');
  });
});
