// Hook de leitura do plano da semana.
// IMPORTANTE: useLiveQuery roda em transação somente-leitura — nunca escreva aqui.
// A criação do registro acontece nas ações de escrita (repo.ts).

import { useLiveQuery } from 'dexie-react-hooks';
import { db, PLANO_ATUAL_ID } from './db';
import type { WeekPlan } from '../types';

const PLANO_VAZIO: WeekPlan = { id: PLANO_ATUAL_ID, itens: [] };

/** Retorna sempre um WeekPlan (vazio enquanto carrega ou se ainda não existe). */
export function usePlano(): WeekPlan {
  const row = useLiveQuery(() => db.plans.get(PLANO_ATUAL_ID), []);
  return row ?? PLANO_VAZIO;
}
