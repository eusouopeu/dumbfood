// Onde a receita entra na semana. São vários lugares, não um: uma panelada de domingo
// costuma ser o almoço de segunda e de quarta ao mesmo tempo. Cada chip é um lugar já
// marcado (o X tira só aquele) e o seletor abaixo acrescenta mais um.

import { useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adicionarAgendamento, removerAgendamento } from '../../db/repo';
import { hapticLeve } from '../../lib/haptics';
import { DIAS_SEMANA, REFEICOES, agendamentosDoItem, ordenarAgendamentos, rotuloAgendamento } from '../../lib/agenda';
import type { Agendamento, PlanItem, Refeicao } from '../../types';

export default function SeletorAgendamento({ recipeId, item }: { recipeId: string; item: PlanItem | undefined }) {
  const [dia, setDia] = useState('');
  const [refeicao, setRefeicao] = useState('');
  const agendamentos = item ? ordenarAgendamentos(agendamentosDoItem(item)) : [];

  function agendar() {
    if (dia === '') return;
    adicionarAgendamento(recipeId, Number(dia), refeicao === '' ? undefined : (refeicao as Refeicao));
    hapticLeve();
    setDia('');
    setRefeicao('');
  }

  return (
    <div className="mt-2 space-y-1.5 pl-8 pr-1" onClick={(e) => e.stopPropagation()}>
      {agendamentos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agendamentos.map((a: Agendamento) => (
            <span
              key={`${a.dia}-${a.refeicao ?? ''}`}
              className="chip gap-1 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            >
              {rotuloAgendamento(a)}
              <button
                onClick={() => {
                  removerAgendamento(recipeId, a);
                  hapticLeve();
                }}
                aria-label={`Tirar de ${rotuloAgendamento(a)}`}
                className="text-brand-500 hover:text-brand-700 dark:text-brand-400"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Sem rótulo: os próprios "— dia"/"— refeição" já dizem o que são, e numa tela de
          celular o rótulo empurrava o botão de agendar para fora do card. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input w-24 py-1 text-xs"
          aria-label="Dia da semana"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        >
          <option value="">— dia</option>
          {DIAS_SEMANA.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="input w-[5.5rem] py-1 text-xs"
          aria-label="Refeição"
          value={refeicao}
          onChange={(e) => setRefeicao(e.target.value)}
        >
          <option value="">— refeição</option>
          {REFEICOES.map((r) => (
            <option key={r.chave} value={r.chave}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={agendar}
          disabled={dia === ''}
          aria-label="Agendar neste dia"
          title="Agendar"
          className="btn-outline h-7 w-7 !px-0 disabled:opacity-40"
        >
          <PlusIcon className="mx-auto size-3.5" />
        </button>
      </div>
    </div>
  );
}
