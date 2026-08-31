// Temporizadores flutuantes: fica montado uma vez em App.tsx (como o Toaster) e
// mostra os temporizadores ativos em qualquer tela, tocando quando algum zera.

import { useEffect, useState } from 'react';
import { PauseIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import {
  formatMMSS,
  msRestantes,
  onTimers,
  pausarTimer,
  removerTimer,
  retomarTimer,
  sincronizarAlarmeSonoro,
  type TimerAtivo,
} from '../lib/timers';
import { hapticLeve } from '../lib/haptics';

export default function TimersOverlay() {
  const [timers, setTimers] = useState<TimerAtivo[]>([]);

  useEffect(() => onTimers(setTimers), []);

  useEffect(() => {
    sincronizarAlarmeSonoro(timers.some((t) => t.tocando));
  }, [timers]);

  if (timers.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-3 z-30 flex flex-col gap-2">
      {timers.map((t) => (
        <TimerPill key={t.id} timer={t} />
      ))}
    </div>
  );
}

function TimerPill({ timer: t }: { timer: TimerAtivo }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (t.tocando) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t.tocando]);

  const restante = msRestantes(t);
  const pausado = t.terminaEm === null && !t.tocando;

  if (t.tocando) {
    return (
      <div className="flex animate-pulse items-center gap-2 rounded-full bg-red-500 py-2 pl-3 pr-2 text-white shadow-lg">
        <BellAlertIcon className="size-5 flex-shrink-0" />
        <span className="max-w-32 truncate text-sm font-bold">{t.rotulo}</span>
        <button
          onClick={() => {
            hapticLeve();
            removerTimer(t.id);
          }}
          aria-label={`Dispensar alarme de ${t.rotulo}`}
          className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-stone-800 py-2 pl-3 pr-2 text-white shadow-lg dark:bg-stone-700">
      <span className="max-w-24 truncate text-xs text-stone-300">{t.rotulo}</span>
      <span className="text-sm font-bold tabular-nums">{formatMMSS(restante)}</span>
      <button
        onClick={() => {
          hapticLeve();
          pausado ? retomarTimer(t.id) : pausarTimer(t.id);
        }}
        aria-label={pausado ? `Retomar ${t.rotulo}` : `Pausar ${t.rotulo}`}
        className="rounded-full p-1.5 hover:bg-white/10"
      >
        {pausado ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
      </button>
      <button
        onClick={() => {
          hapticLeve();
          removerTimer(t.id);
        }}
        aria-label={`Cancelar ${t.rotulo}`}
        className="rounded-full p-1.5 hover:bg-white/10"
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  );
}
