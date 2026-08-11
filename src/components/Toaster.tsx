import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { onToasts, dispensarToast, type ToastMsg } from '../lib/toast';

const ESTILO: Record<ToastMsg['tipo'], { caixa: string; icone: typeof CheckCircleIcon }> = {
  sucesso: { caixa: 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900', icone: CheckCircleIcon },
  erro: { caixa: 'bg-red-600 text-white', icone: ExclamationCircleIcon },
  info: { caixa: 'bg-brand-600 text-white', icone: InformationCircleIcon },
};

export default function Toaster() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);

  useEffect(() => onToasts(setMsgs), []);

  if (msgs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-2xl flex-col items-center gap-2 px-4">
      {msgs.map((m) => {
        const { caixa, icone: Icone } = ESTILO[m.tipo];
        return (
          <div
            key={m.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${caixa}`}
          >
            <button onClick={() => dispensarToast(m.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Icone className="size-5 flex-shrink-0" />
              <span>{m.texto}</span>
            </button>
            {m.acao && (
              <button
                onClick={() => {
                  m.acao?.onClick();
                  dispensarToast(m.id);
                }}
                className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-bold underline underline-offset-2"
              >
                {m.acao.rotulo}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
