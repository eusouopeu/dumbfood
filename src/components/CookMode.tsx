// Modo cozinha: um passo por tela, fonte grande, navegação por toque — pensado
// para ler a receita a distância, com as mãos ocupadas/sujas no fogão. Mantém a
// tela acesa via Screen Wake Lock enquanto estiver aberto (quando suportado).

import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { hapticLeve } from '../lib/haptics';

function useWakeLock(ativo: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!ativo || !('wakeLock' in navigator)) return;
    let cancelado = false;
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (cancelado) sentinel.release();
        else lock.current = sentinel;
      })
      .catch(() => {
        // Navegador recusou (ex.: aba em segundo plano) — sem tela acesa, sem drama.
      });
    return () => {
      cancelado = true;
      lock.current?.release();
      lock.current = null;
    };
  }, [ativo]);
}

export default function CookMode({ titulo, passos, onClose }: { titulo: string; passos: string[]; onClose: () => void }) {
  const [passo, setPasso] = useState(0);
  useWakeLock(true);

  function irPara(i: number) {
    hapticLeve();
    setPasso(Math.min(Math.max(i, 0), passos.length - 1));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') irPara(passo + 1);
      if (e.key === 'ArrowLeft') irPara(passo - 1);
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-stone-900 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="truncate text-sm font-semibold text-stone-300">{titulo}</p>
        <button onClick={onClose} aria-label="Fechar modo cozinha" className="rounded-full p-2 hover:bg-white/10">
          <XMarkIcon className="size-6" />
        </button>
      </div>

      <button
        onClick={() => irPara(passo + 1)}
        className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 text-center"
      >
        <span className="text-sm font-bold uppercase tracking-widest text-brand-400">
          Passo {passo + 1} de {passos.length}
        </span>
        <p className="max-w-xl text-3xl font-semibold leading-snug">{passos[passo]}</p>
      </button>

      <div className="flex items-center justify-center gap-1.5 pb-2">
        {passos.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === passo ? 'w-6 bg-brand-400' : 'w-1.5 bg-white/25'}`} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 pb-8 pt-2">
        <button
          onClick={() => irPara(passo - 1)}
          disabled={passo === 0}
          className="flex size-14 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
          aria-label="Passo anterior"
        >
          <ChevronLeftIcon className="size-7" />
        </button>
        {passo === passos.length - 1 ? (
          <button onClick={onClose} className="btn-primary flex-1 py-3 text-base">
            Concluir
          </button>
        ) : (
          <button
            onClick={() => irPara(passo + 1)}
            className="flex size-14 items-center justify-center rounded-full bg-brand-500"
            aria-label="Próximo passo"
          >
            <ChevronRightIcon className="size-7" />
          </button>
        )}
      </div>
    </div>
  );
}
