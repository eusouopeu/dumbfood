// Agenda da semana: o que está marcado em cada dia, com o resumo nutricional do dia.
// Na visão "pelos dias" da aba Semana é também onde se monta a semana: o "+" de cada dia
// põe uma receita numa refeição, e tocar numa receita a tira daquele lugar.

import { CalendarDaysIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { capitalizar } from '../../lib/format';
import { DIAS_CURTOS, rotuloRefeicao } from '../../lib/agenda';
import type { Nutrientes100g } from '../../lib/nutrition';
import type { agruparPorDia } from '../../lib/agenda';
import type { Agendamento } from '../../types';

type Agenda = ReturnType<typeof agruparPorDia>;

export default function AgendaSemana({
  agenda,
  hoje,
  nutriPorDia,
  onAdicionar,
  onRemover,
}: {
  agenda: Agenda;
  hoje: number;
  nutriPorDia: Map<number, Nutrientes100g>;
  onAdicionar?: (dia: number) => void;
  onRemover?: (recipeId: string, agendamento: Agendamento) => void;
}) {
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center gap-2">
        <CalendarDaysIcon className="size-4 text-brand-500" />
        <h3 className="section-heading text-sm">Agenda da semana</h3>
        {agenda.semDia.length > 0 && (
          <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{agenda.semDia.length} sem dia</span>
        )}
      </div>
      <ul className="divide-y divide-stone-100 dark:divide-stone-700">
        {agenda.dias.map(({ dia, itens }) => (
          <li key={dia} className="flex items-start gap-3 py-1.5 text-sm">
            <span
              className={`w-16 flex-shrink-0 pt-0.5 font-semibold ${
                dia === hoje ? 'text-brand-600 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {DIAS_CURTOS[dia]}
              {dia === hoje && <span className="ml-1 text-[10px] uppercase">hoje</span>}
            </span>
            {itens.length === 0 ? (
              <span className="min-w-0 flex-1 pt-0.5 text-stone-300 dark:text-stone-600">—</span>
            ) : (
              <span className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                {itens.map(({ recipe, refeicao }) => (
                  <span key={`${recipe.id}-${refeicao ?? 'sem'}`} className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate">
                      {refeicao && (
                        <span className="mr-1 text-xs text-stone-400 dark:text-stone-500">{rotuloRefeicao(refeicao)}:</span>
                      )}
                      {capitalizar(recipe.titulo)}
                    </span>
                    {onRemover && (
                      <button
                        onClick={() => onRemover(recipe.id, { dia, ...(refeicao ? { refeicao } : {}) })}
                        aria-label={`Tirar ${recipe.titulo} deste dia`}
                        className="flex-shrink-0 rounded-full p-0.5 text-stone-400 dark:text-stone-500"
                      >
                        <XMarkIcon className="size-3.5" />
                      </button>
                    )}
                  </span>
                ))}
                <NutricaoDoDia nutri={nutriPorDia.get(dia)} />
              </span>
            )}
            {onAdicionar && (
              <button
                onClick={() => onAdicionar(dia)}
                aria-label={`Adicionar receita em ${DIAS_CURTOS[dia]}`}
                title="Adicionar receita"
                className="flex-shrink-0 rounded-full p-1 text-stone-700 active:scale-95 dark:text-stone-200"
              >
                <PlusIcon className="size-5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {agenda.semDia.length > 0 && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Sem dia definido: {agenda.semDia.map(({ recipe }) => capitalizar(recipe.titulo)).join(', ')}.
        </p>
      )}
    </div>
  );
}

/**
 * Resumo nutricional de um dia da agenda: energia e os três macros em grama. Estimado
 * a partir da mesma base de ingredientes da tabela nutricional da receita — serve para
 * enxergar o dia desequilibrado, não para prescrição.
 */
function NutricaoDoDia({ nutri }: { nutri: Nutrientes100g | undefined }) {
  if (!nutri || nutri.kcal <= 0) return null;
  return (
    <span className="block text-xs text-stone-400 dark:text-stone-500">
      ≈ {Math.round(nutri.kcal).toLocaleString('pt-BR')} kcal · P {Math.round(nutri.proteina)} g · C{' '}
      {Math.round(nutri.carboidrato)} g · G {Math.round(nutri.gorduraTotal)} g
    </span>
  );
}
