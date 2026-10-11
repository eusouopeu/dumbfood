// Aplica na lista de mercado as correções sugeridas pela IA (lib/ia.ts → corrigirLista).
//
// Nada da soma das receitas é reescrito: a correção entra pelos mesmos caminhos que o
// usuário já usa à mão — quantidade corrigida (`overrides`), linha escondida (`ocultos`)
// e item manual apagado (`extras`). Por isso "Desfazer" é só voltar ao estado anterior.

import type { ListaEstado } from '../types';
import type { CorrecaoLinha } from './ia';

export interface ResultadoCorrecao {
  patch: Pick<ListaEstado, 'overrides' | 'ocultos' | 'extras'>;
  corrigidas: number;
  removidas: number;
}

const PREFIXO_EXTRA = 'extra:';

export function aplicarCorrecoes(estado: ListaEstado, correcoes: CorrecaoLinha[]): ResultadoCorrecao {
  const overrides = { ...estado.overrides };
  const ocultos = new Set(estado.ocultos);
  const extrasRemovidos = new Set<string>();
  let corrigidas = 0;
  let removidas = 0;

  for (const c of correcoes) {
    const sai = c.juntarEm !== null || c.motivo.trim().toLowerCase().startsWith('remover');
    if (sai) {
      if (c.id.startsWith(PREFIXO_EXTRA)) extrasRemovidos.add(c.id.slice(PREFIXO_EXTRA.length));
      else ocultos.add(c.id);
      delete overrides[c.id];
      removidas += 1;
      continue;
    }
    overrides[c.id] = { quantidade: c.quantidade, unidade: c.unidade === 'unidade' ? 'unidade' : c.unidade };
    corrigidas += 1;
  }

  return {
    patch: {
      overrides,
      ocultos: [...ocultos],
      extras: estado.extras.filter((e) => !extrasRemovidos.has(e.id)),
    },
    corrigidas,
    removidas,
  };
}
