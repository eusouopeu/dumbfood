// Puxar-para-atualizar: gesto nativo esperado em mobile. Como os dados vêm de
// consultas ao vivo do Dexie (sempre atualizados), o "refresh" serve como
// confirmação tátil de que o app está em dia — não busca nada remoto.

import { useRef, useState, type ReactNode } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const LIMIAR_PX = 64;

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const inicioY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    if ((containerRef.current?.scrollTop ?? 0) > 0 || atualizando) return;
    inicioY.current = e.clientY;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (inicioY.current === null) return;
    const delta = e.clientY - inicioY.current;
    if (delta > 0) setPuxado(Math.min(delta, 100));
  }

  async function onPointerUp() {
    inicioY.current = null;
    if (puxado > LIMIAR_PX) {
      setAtualizando(true);
      setPuxado(LIMIAR_PX);
      await onRefresh();
      setAtualizando(false);
    }
    setPuxado(0);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-brand-500 dark:text-brand-400"
        style={{ height: puxado, transition: inicioY.current ? 'none' : 'height 200ms ease' }}
      >
        <ArrowPathIcon className={`size-5 ${atualizando ? 'animate-spin' : ''}`} style={{ opacity: puxado / LIMIAR_PX }} />
      </div>
      {children}
    </div>
  );
}
