// Preferências de comportamento da lista de mercado, persistidas em localStorage —
// mesmo padrão de orcamento.ts/diet.ts: preferência de interface, fora do Dexie/backup.

import { useEffect, useState } from 'react';

const KEY_GELADEIRA = 'dumbfood:descontarGeladeira';
const KEY_EMBALAGEM = 'dumbfood:arredondarEmbalagem';

function useFlag(chave: string, padrao: boolean): [boolean, (v: boolean) => void] {
  const [valor, setValor] = useState(() => {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v === '1';
  });
  useEffect(() => {
    localStorage.setItem(chave, valor ? '1' : '0');
  }, [chave, valor]);
  return [valor, setValor];
}

/** Separa da lista o que a geladeira já cobre, em vez de mandar comprar de novo. */
export function useDescontarGeladeira(): [boolean, (v: boolean) => void] {
  return useFlag(KEY_GELADEIRA, true);
}

/** Arredonda as quantidades para as embalagens vendidas no mercado. */
export function useArredondarEmbalagem(): [boolean, (v: boolean) => void] {
  return useFlag(KEY_EMBALAGEM, true);
}
