// Receita cruzada com a despensa: quanto ela aproveita do que se tem e o que falta comprar.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CakeIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { sugerirSubstitutosParaItem } from '../../lib/substitutions';
import { capitalizar, nomeItem } from '../../lib/format';
import type { ReceitaCombinada } from '../../lib/geladeira';

export default function CardCombinada({ combinada: c, totalGeladeira }: { combinada: ReceitaCombinada; totalGeladeira: number }) {
  const [aberto, setAberto] = useState(false);
  const completa = c.falta.length === 0;

  return (
    <div className="card overflow-hidden">
      <Link to={`/receita/${c.recipe.id}`} className="flex gap-3 p-3">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 dark:bg-brand-900/40">
          {c.recipe.imagem ? (
            <img src={c.recipe.imagem} alt="" className="h-full w-full object-cover" />
          ) : (
            <CakeIcon className="size-8 text-brand-500 dark:text-brand-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{capitalizar(c.recipe.titulo)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="chip bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              usa {c.usados.length} de {totalGeladeira} que você tem
            </span>
            {completa ? (
              <span className="chip bg-green-600 dark:bg-green-700 text-white">dá pra fazer agora</span>
            ) : (
              <span className="chip bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                faltam {c.falta.length} {c.falta.length === 1 ? 'ingrediente' : 'ingredientes'}
              </span>
            )}
          </div>
        </div>
      </Link>

      {!completa && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            className="inline-flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium text-brand-600 dark:text-brand-400"
          >
            {aberto ? (
              <>
                <ChevronDownIcon className="size-3.5" /> ocultar o que falta
              </>
            ) : (
              <>
                <ChevronRightIcon className="size-3.5" /> ver o que falta comprar
              </>
            )}
          </button>
          {aberto && (
            <div className="space-y-2 px-3 pb-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Falta comprar</p>
                <ul className="space-y-0.5 text-stone-600 dark:text-stone-300">
                  {c.falta.map((i) => {
                    const substitutos = sugerirSubstitutosParaItem(i.item);
                    return (
                      <li key={i.item}>
                        {nomeItem(i.item)}
                        {substitutos.length > 0 && (
                          <span className="text-stone-400 dark:text-stone-500"> — ou use {substitutos.join(', ')}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">Você já tem</p>
                <p className="text-stone-600 dark:text-stone-300">{c.tem.map((i) => nomeItem(i.item)).join(', ')}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

