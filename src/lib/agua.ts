// Água do dia em copos: quanto já foi bebido contra a meta.
//
// O consumo fica no Dexie (tabela `agua`, um registro por dia com o total em ml); o
// tamanho do copo e a meta são preferência (`dumbfood:`, entram no backup). Guardar ml,
// e não copos, deixa trocar o tamanho do copo sem reescrever o histórico.

import { useEffect, useState } from 'react';

export const COPO_PADRAO_ML = 250;
export const META_AGUA_PADRAO_ML = 2000;

const KEY_COPO = 'dumbfood:aguaCopoMl';
const KEY_META = 'dumbfood:aguaMetaMl';

/** Copos inteiros já bebidos. */
export function coposCheios(ml: number, copo: number): number {
  return copo > 0 ? Math.floor(Math.max(0, ml) / copo) : 0;
}

/** Copos desenhados: os da meta, e sempre um vazio a mais quando a meta já foi batida. */
export function coposNaTela(ml: number, copo: number, meta: number): number {
  if (copo <= 0) return 0;
  return Math.max(Math.ceil(meta / copo), coposCheios(ml, copo) + 1);
}

/**
 * Novo total depois de tocar no copo `indice` (0 = primeiro). Copo vazio soma um copo;
 * copo cheio desfaz — ele e os que vêm depois esvaziam.
 */
export function tocarCopo(ml: number, copo: number, indice: number): number {
  if (indice < coposCheios(ml, copo)) return indice * copo;
  return Math.max(0, ml) + copo;
}

function lerNumero(chave: string, padrao: number): number {
  try {
    const n = Number(localStorage.getItem(chave));
    return Number.isFinite(n) && n > 0 ? n : padrao;
  } catch {
    return padrao;
  }
}

function useNumero(chave: string, padrao: number): [number, (n: number) => void] {
  const [valor, setValor] = useState(() => lerNumero(chave, padrao));
  useEffect(() => {
    localStorage.setItem(chave, String(valor));
  }, [chave, valor]);
  return [valor, (n) => n > 0 && setValor(Math.round(n))];
}

export function useCopoAgua(): [number, (ml: number) => void] {
  return useNumero(KEY_COPO, COPO_PADRAO_ML);
}

export function useMetaAgua(): [number, (ml: number) => void] {
  return useNumero(KEY_META, META_AGUA_PADRAO_ML);
}
