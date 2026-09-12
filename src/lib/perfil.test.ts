import { describe, expect, it } from 'vitest';
import { kcalSugerida, tmb, type Perfil } from './perfil';

const ALEX: Perfil = {
  sexo: 'f',
  idade: 31,
  pesoKg: 68.8,
  alturaCm: 165,
  atividade: 'sedentario',
  objetivo: 'perder',
};

describe('tmb', () => {
  it('usa Mifflin-St Jeor com o desconto feminino', () => {
    // 10*68.8 + 6.25*165 - 5*31 - 161
    expect(tmb(ALEX)).toBe(1403);
  });

  it('usa o acréscimo masculino', () => {
    expect(tmb({ ...ALEX, sexo: 'm' })).toBe(1569);
  });
});

describe('kcalSugerida', () => {
  it('aplica fator de atividade e corte de 15% para perder peso', () => {
    // 1403.25 * 1.2 = 1683.9 → * 0.85 = 1431.3
    expect(kcalSugerida(ALEX)).toBe(1431);
  });

  it('mantém o gasto estimado quando o objetivo é manter', () => {
    expect(kcalSugerida({ ...ALEX, objetivo: 'manter' })).toBe(1684);
  });

  it('acrescenta 10% para ganhar peso e respeita o fator de atividade', () => {
    expect(kcalSugerida({ ...ALEX, objetivo: 'ganhar', atividade: 'moderado' })).toBe(2393);
  });

  it('devolve null quando faltam dados do perfil', () => {
    expect(kcalSugerida({ ...ALEX, pesoKg: undefined })).toBeNull();
  });
});
