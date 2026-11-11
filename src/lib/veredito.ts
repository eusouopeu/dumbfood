// Veredito do produto lido pelo código de barras: kcal e quatro anéis por porção.
//
// A nota não é calculada aqui: continua sendo a de rating.ts, sempre por 100 g (é a base
// dos limites). Os anéis mostram quanto uma porção ocupa da meta do dia (metas.ts).

import type { Nutrientes100g } from './nutrition';

/** Sem porção no rótulo, a leitura é por 100 g. */
export const PORCAO_PADRAO_G = 100;

export type ChaveAnel = 'gorduraTotal' | 'proteina' | 'carboidrato' | 'fibra';

export interface AnelVeredito {
  chave: ChaveAnel;
  rotulo: string;
  /** Gramas na porção. */
  gramas: number;
  /** Meta do dia em gramas. */
  meta: number;
  /** Fração da meta do dia (0–1, sem teto: pode passar de 1). */
  fracao: number;
}

export interface Veredito {
  porcaoG: number;
  kcal: number;
  aneis: AnelVeredito[];
}

const ANEIS: { chave: ChaveAnel; rotulo: string }[] = [
  { chave: 'gorduraTotal', rotulo: 'Gordura' },
  { chave: 'proteina', rotulo: 'Proteína' },
  { chave: 'carboidrato', rotulo: 'Carboidrato' },
  { chave: 'fibra', rotulo: 'Fibra' },
];

export function vereditoProduto(
  por100g: Nutrientes100g,
  porcaoG: number | undefined,
  metaDia: { gramas: { carboidrato: number; proteina: number; gorduraTotal: number }; fibra: number },
): Veredito {
  const porcao = porcaoG && porcaoG > 0 ? porcaoG : PORCAO_PADRAO_G;
  const fator = porcao / 100;
  const metaDe = (c: ChaveAnel) => (c === 'fibra' ? metaDia.fibra : metaDia.gramas[c]);
  return {
    porcaoG: porcao,
    kcal: por100g.kcal * fator,
    aneis: ANEIS.map(({ chave, rotulo }) => {
      const gramas = por100g[chave] * fator;
      const meta = metaDe(chave);
      return { chave, rotulo, gramas, meta, fracao: meta > 0 ? gramas / meta : 0 };
    }),
  };
}
