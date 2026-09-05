// Um card da lista de receitas da aba Semana: marca/desmarca a receita no plano,
// ajusta para quantas porções fazer e, quando marcada, abre o seletor de dia/refeição.

import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { definirNoPlano } from '../../db/repo';
import { round } from '../../lib/scale';
import { capitalizar, rotuloRendimento } from '../../lib/format';
import SeletorAgendamento from './SeletorAgendamento';
import type { PlanItem, Recipe } from '../../types';

export default function CardReceitaPlano({
  recipe: r,
  item,
  onAlternar,
}: {
  recipe: Recipe;
  item: PlanItem | undefined;
  onAlternar: (marcado: boolean) => void;
}) {
  const ativo = item !== undefined;
  const alvo = Math.max(1, Math.round(r.rendimentoBase.valor * (item?.fator ?? 1)));

  function setAlvo(v: number) {
    definirNoPlano(r.id, round(Math.max(1, v) / r.rendimentoBase.valor));
  }

  return (
    <li
      role="checkbox"
      aria-checked={ativo}
      tabIndex={0}
      onClick={() => onAlternar(!ativo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAlternar(!ativo);
        }
      }}
      className={`card cursor-pointer p-3 ${ativo ? 'ring-2 ring-brand-300 dark:ring-brand-700' : ''}`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          className="pointer-events-none h-5 w-5 accent-brand-500"
          checked={ativo}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{capitalizar(r.titulo)}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            base: {r.rendimentoBase.valor} {rotuloRendimento(r.rendimentoBase.tipo, r.rendimentoBase.valor)}
          </p>
        </div>
      </div>

      {ativo && (
        <div className="mt-2 flex items-center gap-2 pl-8" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-stone-500 dark:text-stone-400">fazer para:</span>
          <button
            className="btn-outline h-7 w-7 !px-0 text-xs"
            onClick={() => setAlvo(alvo - 1)}
            aria-label={`Diminuir quantidade de ${capitalizar(r.titulo)}`}
          >
            <MinusIcon className="mx-auto size-3.5" />
          </button>
          <input
            type="number"
            min={1}
            className="input w-14 py-1 text-center text-sm"
            value={alvo}
            onChange={(e) => setAlvo(Number(e.target.value))}
            aria-label={`Quantidade de ${capitalizar(r.titulo)}`}
          />
          <button
            className="btn-outline h-7 w-7 !px-0 text-xs"
            onClick={() => setAlvo(alvo + 1)}
            aria-label={`Aumentar quantidade de ${capitalizar(r.titulo)}`}
          >
            <PlusIcon className="mx-auto size-3.5" />
          </button>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {rotuloRendimento(r.rendimentoBase.tipo, alvo)}
          </span>
        </div>
      )}

      {ativo && <SeletorAgendamento recipeId={r.id} item={item} />}
    </li>
  );
}
