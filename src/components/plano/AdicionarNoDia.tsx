// Folha de montar a semana pelo dia: escolher a refeição e a receita que entra nela.
// Se a receita ainda não estava no plano, entra junto (com a quantidade base).

import { useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DIAS_SEMANA, REFEICOES } from '../../lib/agenda';
import { capitalizar } from '../../lib/format';
import type { Recipe, RefeicaoPadrao } from '../../types';

export default function AdicionarNoDia({
  dia,
  recipes,
  onAdicionar,
  onFechar,
}: {
  dia: number;
  recipes: Recipe[];
  onAdicionar: (recipeId: string, refeicao: RefeicaoPadrao) => void;
  onFechar: () => void;
}) {
  const [refeicao, setRefeicao] = useState<RefeicaoPadrao>('almoco');

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h3 className="section-heading flex-1 text-sm">{DIAS_SEMANA[dia]}</h3>
          <button onClick={onFechar} aria-label="Fechar" className="rounded-full p-2 text-stone-500 dark:text-stone-400">
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <div className="mx-4 flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-700">
          {REFEICOES.map((r) => (
            <button
              key={r.chave}
              onClick={() => setRefeicao(r.chave)}
              className={`flex-1 rounded-md px-2 py-1 font-semibold ${
                refeicao === r.chave ? 'bg-white shadow-sm dark:bg-stone-800' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <ul className="mt-2 flex-1 divide-y divide-stone-100 overflow-y-auto px-4 pb-4 dark:divide-stone-700">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{capitalizar(r.titulo)}</span>
              <button
                onClick={() => onAdicionar(r.id, refeicao)}
                aria-label={`Adicionar ${r.titulo}`}
                className="rounded-full p-2 text-stone-700 active:scale-95 dark:text-stone-200"
              >
                <PlusIcon className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
