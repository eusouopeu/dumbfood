// Card de uma receita na biblioteca. Arrastar para a esquerda exclui (com confirmação),
// no mesmo gesto que a lista de mercado já usa; toque longo abre o menu de ações.

import { Link } from 'react-router-dom';
import { CakeIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { capitalizar, formatTempo } from '../../lib/format';
import { useLongPress } from '../../lib/useLongPress';
import Highlight from '../Highlight';
import SwipeActions from '../SwipeActions';
import type { Recipe } from '../../types';

export default function CardReceita({
  recipe: r,
  naSemana,
  busca,
  cobertura,
  onAbrirMenu,
  onToggleFavorito,
  onExcluir,
}: {
  recipe: Recipe;
  naSemana: boolean;
  busca: string;
  /** Fração dos ingredientes já disponíveis na geladeira (0 a 1), quando há geladeira. */
  cobertura?: number;
  onAbrirMenu: () => void;
  onToggleFavorito: () => void;
  onExcluir: () => void;
}) {
  const tempo = formatTempo(r.tempoPreparoMin);
  const longPress = useLongPress(onAbrirMenu);

  const card = (
    <Link
      to={`/receita/${r.id}`}
      onClick={(e) => longPress.onClickCapture(e)}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      className="card relative flex gap-3 bg-white p-3 dark:bg-stone-800"
    >
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 dark:bg-brand-900/40">
        {r.imagem ? (
          <img src={r.imagem} alt="" className="h-full w-full object-cover" />
        ) : (
          <CakeIcon className="size-8 text-brand-500 dark:text-brand-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate pr-6 font-semibold">
          <Highlight texto={capitalizar(r.titulo)} termo={busca} />
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <span className="font-bold text-brand-600 dark:text-brand-400">{r.ingredientes.length} ingredientes</span>
          {tempo ? ` · ${tempo}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {naSemana && <span className="chip bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">na semana</span>}
          {cobertura !== undefined && cobertura > 0 && (
            <span
              className={`chip ${
                cobertura >= 1
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
              }`}
              title="Ingredientes que você já tem em casa"
            >
              {Math.round(cobertura * 100)}% em casa
            </span>
          )}
          {(r.tags ?? []).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorito();
        }}
        aria-label={r.favorito ? `Remover ${capitalizar(r.titulo)} dos favoritos` : `Favoritar ${capitalizar(r.titulo)}`}
        className="absolute right-2 top-2 rounded-full p-1 text-amber-400 hover:bg-amber-50 dark:hover:bg-stone-700"
      >
        {r.favorito ? <StarSolidIcon className="size-5" /> : <StarOutlineIcon className="size-5 text-stone-300 dark:text-stone-600" />}
      </button>
    </Link>
  );

  return (
    <div className="overflow-hidden rounded-2xl">
      <SwipeActions onRemover={onExcluir}>{card}</SwipeActions>
    </div>
  );
}
