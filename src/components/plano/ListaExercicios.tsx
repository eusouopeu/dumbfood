// Exercícios do dia, só informativos: não mudam a meta de calorias (lib/exercicios.ts).

import { TrashIcon } from '@heroicons/react/24/outline';
import { removerExercicio } from '../../db/repo';
import { capitalizar } from '../../lib/format';
import { toast } from '../../lib/toast';
import type { RegistroExercicio } from '../../types';

export default function ListaExercicios({ exercicios }: { exercicios: RegistroExercicio[] }) {
  return (
    <>
    {exercicios.length > 0 && (
      <ul className="space-y-0.5">
        {exercicios.map((e) => (
          <li key={e.id} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="min-w-0 flex-1 truncate">
              {capitalizar(e.nome)}
              {e.minutos ? ` · ${e.minutos} min` : ''}
            </span>
            <span className="tabular-nums">−{Math.round(e.kcal).toLocaleString('pt-BR')} kcal</span>
            <button
              onClick={async () => {
                await removerExercicio(e.id);
                toast('Exercício removido.');
              }}
              aria-label={`Remover ${e.nome}`}
              className="text-red-500 dark:text-red-400"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    )}
    </>
  );
}
