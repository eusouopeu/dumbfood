// Botão de criar temporizador na tela da receita. O temporizador em si não mora
// aqui — depois de criado ele aparece flutuando (TimersOverlay, montado uma vez em
// App.tsx) e continua contando em qualquer aba do app.

import { useState } from 'react';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { criarTimer, prepararAudio } from '../lib/timers';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';

const PRESETS_MIN = [5, 10, 15, 20, 30, 45];

export default function TimerFab({ tituloSugerido }: { tituloSugerido: string }) {
  const [aberto, setAberto] = useState(false);
  const [minutos, setMinutos] = useState(10);
  const [rotulo, setRotulo] = useState(tituloSugerido);

  function iniciar() {
    if (minutos <= 0) return;
    prepararAudio();
    criarTimer(rotulo.trim() || tituloSugerido, minutos * 60_000);
    hapticLeve();
    toast(`Temporizador de ${minutos} min iniciado.`);
    setAberto(false);
  }

  return (
    <>
      <button
        onClick={() => {
          setRotulo(tituloSugerido);
          setAberto(true);
        }}
        aria-label="Novo temporizador"
        title="Novo temporizador"
        className="fixed bottom-[4.9rem] right-4 z-20 flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition hover:bg-brand-600 active:scale-95"
      >
        <ClockIcon className="size-7" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={() => setAberto(false)}>
          <div
            className="w-full max-w-2xl space-y-4 rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-stone-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Novo temporizador</h3>
              <button onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <input
              className="input"
              placeholder="Nome do temporizador"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
            />

            <div className="flex flex-wrap gap-1.5">
              {PRESETS_MIN.map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutos(m)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    minutos === m ? 'bg-brand-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-500 dark:text-stone-400">ou</span>
              <input
                type="number"
                min={1}
                className="input w-20 text-center"
                value={minutos}
                onChange={(e) => setMinutos(Math.max(1, Number(e.target.value)))}
              />
              <span className="text-sm text-stone-500 dark:text-stone-400">minutos</span>
            </div>

            <button onClick={iniciar} className="btn-primary w-full">
              <ClockIcon className="size-4" /> Iniciar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
