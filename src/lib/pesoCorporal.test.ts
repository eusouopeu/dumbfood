import { describe, expect, it } from 'vitest';
import { tendenciaPeso } from './pesoCorporal';

describe('tendenciaPeso', () => {
  it('compara o peso mais recente com o mais antigo da janela', () => {
    const registros = [
      { dia: '2026-08-01', kg: 90, criadoEm: 1 }, // fora da janela de 30 dias
      { dia: '2026-09-05', kg: 80.4, criadoEm: 2 },
      { dia: '2026-09-20', kg: 79.8, criadoEm: 3 },
      { dia: '2026-10-01', kg: 79.2, criadoEm: 4 },
    ];
    const t = tendenciaPeso(registros, '2026-10-01', 30);
    expect(t).toEqual({ atual: 79.2, variacao: -1.2, desde: '2026-09-05' });
  });

  it('devolve null com menos de dois registros na janela', () => {
    expect(tendenciaPeso([{ dia: '2026-10-01', kg: 70, criadoEm: 1 }], '2026-10-01', 30)).toBeNull();
  });
});
