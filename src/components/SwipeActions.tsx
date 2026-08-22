// Linha de lista com ação por arraste, no padrão de app de mensagens:
// arrastar para a esquerda remove, arrastar para a direita edita.
//
// Substitui o toque sobre o item para editar quantidade: com a lista aberta no mercado,
// o toque é para marcar o que já foi pego — editar por toque fazia a edição abrir sem
// querer o tempo todo.

import { useRef, useState, type ReactNode } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { hapticMedio } from '../lib/haptics';

/** Distância a partir da qual soltar dispara a ação. */
const LIMIAR = 72;
const MAXIMO = 120;

export default function SwipeActions({
  onRemover,
  onEditar,
  children,
}: {
  onRemover?: () => void;
  onEditar?: () => void;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  // O início do arraste fica em ref, e não em estado: eventos de ponteiro podem chegar
  // no mesmo tick (flick rápido), e aí um `useState` ainda não commitado faria o
  // primeiro movimento ser ignorado.
  const inicio = useRef<{ x: number; y: number } | null>(null);
  // Mesmo motivo para o deslocamento: quem decide a ação ao soltar é a ref, não o estado.
  const dxAtual = useRef(0);
  const arrastando = inicio.current !== null;

  function mover(valor: number) {
    dxAtual.current = valor;
    setDx(valor);
  }

  function onPointerDown(e: React.PointerEvent) {
    inicio.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!inicio.current) return;
    const deltaX = e.clientX - inicio.current.x;
    // Movimento predominantemente vertical é rolagem da lista, não arraste da linha.
    if (Math.abs(e.clientY - inicio.current.y) > Math.abs(deltaX)) return;
    const limitado = Math.max(-MAXIMO, Math.min(MAXIMO, deltaX));
    mover(limitado > 0 && !onEditar ? 0 : limitado < 0 && !onRemover ? 0 : limitado);
  }

  function soltar() {
    if (!inicio.current) return;
    inicio.current = null;
    const deslocamento = dxAtual.current;
    mover(0);
    if (deslocamento <= -LIMIAR && onRemover) {
      hapticMedio();
      onRemover();
    } else if (deslocamento >= LIMIAR && onEditar) {
      hapticMedio();
      onEditar();
    }
  }

  return (
    <div className="relative overflow-hidden">
      {onEditar && (
        <div className="absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-brand-500 text-white">
          <PencilIcon className="size-5" />
        </div>
      )}
      {onRemover && (
        <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600 text-white">
          <TrashIcon className="size-5" />
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        style={{ transform: `translateX(${dx}px)`, transition: arrastando ? 'none' : 'transform 150ms ease' }}
        className="relative touch-pan-y bg-inherit"
      >
        {children}
      </div>
    </div>
  );
}
