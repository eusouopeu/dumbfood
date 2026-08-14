// Teto de gasto semanal, persistido localmente — mesmo padrão de diet.ts/theme.ts:
// preferência de interface, não dado do usuário, então fora do Dexie/backup JSON.

import { useEffect, useState } from 'react';

const KEY = 'dumbfood:orcamentoSemanal';

function loadOrcamento(): number | null {
  const v = localStorage.getItem(KEY);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Orçamento semanal em reais, ou null quando o usuário não definiu um teto. */
export function useOrcamento(): [number | null, (v: number | null) => void] {
  const [orcamento, setOrcamento] = useState<number | null>(() => loadOrcamento());
  useEffect(() => {
    if (orcamento === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(orcamento));
  }, [orcamento]);
  return [orcamento, setOrcamento];
}

export type StatusOrcamento = 'dentro' | 'perto' | 'estourado';

/** `perto` cobre os 80% finais do teto — dá tempo de reagir antes de estourar. */
export function statusOrcamento(valorEstimado: number, orcamento: number): StatusOrcamento {
  const proporcao = valorEstimado / orcamento;
  if (proporcao > 1) return 'estourado';
  if (proporcao >= 0.8) return 'perto';
  return 'dentro';
}
