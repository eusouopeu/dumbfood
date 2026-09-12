// Uma refeição do painel do dia: rótulo, quanto já entrou contra o recomendado, e os
// itens comidos como chips.
//
// Chip, e não linha de lista: o que foi comido numa refeição são dois ou três nomes
// curtos, e em chips eles cabem lado a lado — a lista empilhada empurrava o jantar
// para fora da tela já no café.

import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { capitalizar } from '../../lib/format';
import type { Recipe, RegistroConsumo } from '../../types';
import type { RefeicaoDef } from '../../lib/refeicoes';

export default function LinhaRefeicao({
  def,
  registros,
  agendadas,
  recomendada,
  onRegistrar,
  onRemoverRegistro,
  onRemoverRefeicao,
}: {
  def: RefeicaoDef;
  registros: RegistroConsumo[];
  agendadas: Recipe[];
  recomendada: number;
  onRegistrar: () => void;
  onRemoverRegistro: (id: string) => void;
  /** Só nas refeições criadas pelo usuário, e só enquanto estiverem vazias. */
  onRemoverRefeicao?: () => void;
}) {
  const kcal = registros.reduce((s, r) => s + r.nutrientes.kcal, 0);
  const estourou = recomendada > 0 && kcal > recomendada;

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{def.label}</p>
          <p className="truncate text-xs text-stone-400 dark:text-stone-500">
            <span className={estourou ? 'font-semibold text-red-500 dark:text-red-400' : ''}>
              {Math.round(kcal).toLocaleString('pt-BR')}
            </span>
            {' / '}
            {recomendada.toLocaleString('pt-BR')}kcal
            {registros.length === 0 && agendadas.length > 0 && (
              <> · planejado: {agendadas.map((r) => capitalizar(r.titulo)).join(', ')}</>
            )}
          </p>
        </div>
        {onRemoverRefeicao && registros.length === 0 && (
          <button
            onClick={onRemoverRefeicao}
            aria-label={`Remover refeição ${def.label}`}
            title="Remover refeição"
            className="btn-icon flex-shrink-0 p-2 text-stone-400 dark:text-stone-500"
          >
            <XMarkIcon className="size-4" />
          </button>
        )}
        <button
          onClick={onRegistrar}
          aria-label={`Registrar ${def.label}`}
          title={`Registrar ${def.label}`}
          className="btn-icon flex-shrink-0 p-2"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {registros.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {registros.map((r) => (
            <button
              key={r.id}
              onClick={() => onRemoverRegistro(r.id)}
              title={`${Math.round(r.nutrientes.kcal).toLocaleString('pt-BR')} kcal · toque para remover`}
              aria-label={`Remover ${r.nome}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
            >
              {r.porcoes !== 1 && <span className="opacity-70">{r.porcoes} und ·</span>}
              <span className="max-w-[12rem] truncate">{capitalizar(r.nome)}</span>
              <XMarkIcon className="size-3.5 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
