// Envolve uma linha de lista e permite removê-la arrastando para a esquerda
// (padrão mobile), sem esconder a ação equivalente por toque/clique que
// permanece disponível dentro de `children`.

import { useRef, useState, type ReactNode } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { hapticMedio } from '../lib/haptics';

const LIMIAR_REMOCAO = 72;

export default function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const inicioX = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    inicioX.current = e.clientX;
    setArrastando(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!arrastando) return;
    const delta = e.clientX - inicioX.current;
    setDx(Math.min(0, Math.max(delta, -120)));
  }
  function soltar() {
    setArrastando(false);
    if (dx < -LIMIAR_REMOCAO) {
      hapticMedio();
      onDelete();
    }
    setDx(0);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600 text-white">
        <TrashIcon className="size-5" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={soltar}
        onPointerLeave={() => arrastando && soltar()}
        style={{ transform: `translateX(${dx}px)`, transition: arrastando ? 'none' : 'transform 150ms ease' }}
        className="relative touch-pan-y bg-inherit"
      >
        {children}
      </div>
    </div>
  );
}
