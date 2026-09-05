// Controle de reescala da receita: por rendimento (porções/pessoas/unidades) ou por
// grama de um ingrediente de referência ("tenho 700 g de frango, quanto vai do resto?").
//
// Onde a quantidade é escolhida é também onde se decide o que fazer com ela: mandar
// para a semana ou virar o rendimento padrão da receita.

import { MinusIcon, PlusIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { nomeItem } from '../../lib/format';
import type { YieldType } from '../../types';

export type Modo = 'rendimento' | 'grama';

export interface IngredienteDeMassa {
  idx: number;
  label: string;
  baseG: number;
}

export default function ControleReescala({
  modo,
  onModo,
  alvo,
  onAlvo,
  tipo,
  onTipo,
  massIngredientes,
  refIngIdx,
  onRefIng,
  alvoGramas,
  onAlvoGramas,
  fator,
  noPlano,
  onAtualizarNaSemana,
  onSalvarComoPadrao,
}: {
  modo: Modo;
  onModo: (m: Modo) => void;
  alvo: number;
  onAlvo: (v: number) => void;
  tipo: YieldType;
  onTipo: (t: YieldType) => void;
  massIngredientes: IngredienteDeMassa[];
  refIngIdx: number;
  onRefIng: (i: number) => void;
  alvoGramas: number;
  onAlvoGramas: (g: number) => void;
  fator: number;
  noPlano: boolean;
  onAtualizarNaSemana: () => void;
  onSalvarComoPadrao: () => void;
}) {
  const reescalada = Math.abs(fator - 1) > 0.001;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
        <button
          onClick={() => onModo('rendimento')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${modo === 'rendimento' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          Por porção/pessoa
        </button>
        <button
          onClick={() => onModo('grama')}
          disabled={massIngredientes.length === 0}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold disabled:opacity-40 ${modo === 'grama' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          Por grama
        </button>
      </div>

      {modo === 'rendimento' ? (
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              className="btn-outline h-9 w-9 !px-0"
              onClick={() => onAlvo(Math.max(1, alvo - 1))}
              aria-label="Diminuir rendimento"
            >
              <MinusIcon className="mx-auto size-4" />
            </button>
            <input
              type="number"
              min={1}
              className="input w-16 text-center"
              value={alvo}
              onChange={(e) => onAlvo(Math.max(1, Number(e.target.value)))}
              aria-label="Rendimento desejado"
            />
            <button className="btn-outline h-9 w-9 !px-0" onClick={() => onAlvo(alvo + 1)} aria-label="Aumentar rendimento">
              <PlusIcon className="mx-auto size-4" />
            </button>
          </div>
          <select className="input flex-1" value={tipo} onChange={(e) => onTipo(e.target.value as YieldType)}>
            <option value="porcoes">porções</option>
            <option value="pessoas">pessoas</option>
            <option value="unidades">unidades</option>
          </select>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 dark:text-stone-400">Ingrediente de referência</label>
            <select className="input" value={refIngIdx} onChange={(e) => onRefIng(Number(e.target.value))}>
              <option value={-1}>escolha…</option>
              {massIngredientes.map((m) => (
                <option key={m.idx} value={m.idx}>
                  {nomeItem(m.label)} ({m.baseG} g)
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-xs text-stone-500 dark:text-stone-400">Tenho (g)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={alvoGramas || ''}
              onChange={(e) => onAlvoGramas(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {(noPlano || reescalada) && (
        <div className="flex flex-wrap justify-end gap-2">
          {noPlano && (
            <button onClick={onAtualizarNaSemana} className="btn-ghost h-7 py-0 text-xs">
              <CalendarDaysIcon className="size-3.5" /> Atualizar na semana
            </button>
          )}
          {reescalada && (
            <button onClick={onSalvarComoPadrao} className="btn-ghost h-7 py-0 text-xs">
              Salvar como padrão
            </button>
          )}
        </div>
      )}
    </div>
  );
}
