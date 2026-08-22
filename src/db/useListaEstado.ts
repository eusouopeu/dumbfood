// Hook de leitura do estado da lista de mercado (o que está marcado, itens manuais,
// quantidades corrigidas e linhas escondidas).
// IMPORTANTE: useLiveQuery roda em transação somente-leitura — nunca escreva aqui.
// A criação do registro acontece nas ações de escrita (repo.ts).

import { useLiveQuery } from 'dexie-react-hooks';
import { db, listaEstadoVazio } from './db';
import type { ListaEstado } from '../types';

/** Retorna sempre um estado válido (vazio enquanto carrega ou se ainda não existe). */
export function useListaEstado(): ListaEstado {
  const row = useLiveQuery(() => db.listaEstado.get('atual'), []);
  return row ?? listaEstadoVazio();
}
