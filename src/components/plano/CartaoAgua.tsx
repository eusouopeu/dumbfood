// Água do dia em copos. Tocar num copo vazio soma um copo; tocar num cheio desfaz.
// Tamanho do copo e meta vêm do Perfil.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { definirAgua } from '../../db/repo';
import { coposCheios, coposNaTela, tocarCopo, useCopoAgua, useMetaAgua } from '../../lib/agua';
import { hapticLeve } from '../../lib/haptics';

export default function CartaoAgua({ dia }: { dia: string }) {
  const [copo] = useCopoAgua();
  const [meta] = useMetaAgua();
  const ml = useLiveQuery(() => db.agua.get(dia), [dia])?.ml ?? 0;
  const cheios = coposCheios(ml, copo);
  const total = coposNaTela(ml, copo, meta);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-300">Água</span>
        <span className={`tabular-nums font-semibold ${ml >= meta ? 'text-sky-600 dark:text-sky-400' : 'text-stone-500 dark:text-stone-400'}`}>
          {ml.toLocaleString('pt-BR')} / {meta.toLocaleString('pt-BR')} ml
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const cheio = i < cheios;
          return (
            <button
              key={i}
              onClick={async () => {
                await definirAgua(dia, tocarCopo(ml, copo, i));
                hapticLeve();
              }}
              aria-label={cheio ? `Desfazer copo ${i + 1}` : `Beber um copo de ${copo} ml`}
              title={cheio ? 'Desfazer' : `+${copo} ml`}
              className={`h-8 w-6 rounded-b-lg rounded-t-sm border-2 transition active:scale-95 ${
                cheio
                  ? 'border-sky-500 bg-sky-400 dark:border-sky-400 dark:bg-sky-500'
                  : 'border-stone-300 bg-transparent dark:border-stone-600'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
