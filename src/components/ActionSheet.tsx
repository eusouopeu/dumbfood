// Menu de ações no rodapé (bottom sheet), aberto por toque longo num card.

import type { ComponentType } from 'react';

export interface AcaoSheet {
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  onClick: () => void;
  destrutiva?: boolean;
}

export default function ActionSheet({
  titulo,
  acoes,
  onFechar,
}: {
  titulo: string;
  acoes: AcaoSheet[];
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="truncate px-4 pb-2 pt-4 text-sm font-semibold text-stone-500 dark:text-stone-400">{titulo}</p>
        <ul>
          {acoes.map((a) => (
            <li key={a.rotulo}>
              <button
                onClick={() => {
                  onFechar();
                  a.onClick();
                }}
                className={`flex w-full items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-sm font-medium dark:border-stone-700 ${
                  a.destrutiva ? 'text-red-600 dark:text-red-400' : 'text-stone-800 dark:text-stone-100'
                }`}
              >
                <a.icone className="size-5" />
                {a.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
