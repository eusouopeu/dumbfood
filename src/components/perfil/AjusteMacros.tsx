// Ajuste da divisão de macros da meta diária.
//
// Cada macro tem um cadeado: travar proteína e mexer no carboidrato é o gesto de quem
// já sabe quanta proteína quer comer e está negociando o resto. Sem o cadeado, mexer em
// um macro mexe nos outros dois e a pessoa persegue o próprio rabo.
//
// A soma é normalizada a cada movimento — não existe estado inválido para "salvar", o
// que dispensa o botão de salvar e o aviso de "ajuste para 100%".

import { LockClosedIcon, LockOpenIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  MACROS_ORDEM,
  MACRO_LABEL,
  ajustarMacros,
  gramasDaMeta,
  kcalDoMacro,
  type ChaveMacro,
  type MetaMacrosPct,
} from '../../lib/metas';
import { CORES_MACRO } from '../MacroResumo';
import RoscaMacro from '../RoscaMacro';

const COR: Record<ChaveMacro, string> = {
  carboidrato: CORES_MACRO.carboidrato,
  proteina: CORES_MACRO.proteina,
  gorduraTotal: CORES_MACRO.gordura,
};

export default function AjusteMacros({
  kcal,
  macros,
  travado,
  onMacros,
  onTravado,
}: {
  kcal: number;
  macros: MetaMacrosPct;
  travado: ChaveMacro | null;
  onMacros: (m: MetaMacrosPct) => void;
  onTravado: (t: ChaveMacro | null) => void;
}) {
  const gramas = gramasDaMeta(kcal, macros);

  function mexer(campo: ChaveMacro, valor: number) {
    onMacros(ajustarMacros(macros, campo, valor, travado));
  }

  return (
    <div className="space-y-3">
      <RoscaMacro titulo="Divisão da meta diária" fatias={macros} />

      <ul className="space-y-3">
        {MACROS_ORDEM.map((campo) => {
          const estaTravado = travado === campo;
          return (
            <li key={campo}>
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => onTravado(estaTravado ? null : campo)}
                  aria-label={estaTravado ? `Destravar ${MACRO_LABEL[campo]}` : `Travar ${MACRO_LABEL[campo]}`}
                  aria-pressed={estaTravado}
                  title={estaTravado ? 'Destravar' : 'Travar este macro'}
                  className={`flex-shrink-0 rounded-full p-1 ${
                    estaTravado ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' : 'text-stone-400'
                  }`}
                >
                  {estaTravado ? <LockClosedIcon className="size-4" /> : <LockOpenIcon className="size-4" />}
                </button>
                {/* Nome, gramas e kcal numa linha só: o percentual já está na rosca e no slider. */}
                <span className="min-w-0 flex-1 truncate font-semibold">{MACRO_LABEL[campo]}</span>
                <span className="flex-shrink-0 tabular-nums">
                  <span className="font-semibold">{gramas[campo]} g</span>
                  <span className="mx-1.5 text-stone-300 dark:text-stone-600">|</span>
                  <span className="text-stone-500 dark:text-stone-400">
                    {kcalDoMacro(kcal, macros[campo]).toLocaleString('pt-BR')} kcal
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => mexer(campo, macros[campo] - 1)}
                  disabled={estaTravado}
                  aria-label={`Diminuir ${MACRO_LABEL[campo]}`}
                  className="btn-icon flex-shrink-0 p-1.5"
                >
                  <MinusIcon className="size-4" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={macros[campo]}
                  disabled={estaTravado}
                  onChange={(e) => mexer(campo, Number(e.target.value))}
                  aria-label={`${MACRO_LABEL[campo]} em percentual das calorias`}
                  className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-stone-200 disabled:opacity-50 dark:bg-stone-700"
                  style={{ accentColor: COR[campo] }}
                />
                <button
                  onClick={() => mexer(campo, macros[campo] + 1)}
                  disabled={estaTravado}
                  aria-label={`Aumentar ${MACRO_LABEL[campo]}`}
                  className="btn-icon flex-shrink-0 p-1.5"
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
