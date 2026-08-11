// Detecta toque longo (long-press) num elemento, sem interferir no clique normal:
// se o ponteiro se move ou solta antes do prazo, é tratado como toque comum.

import { useRef } from 'react';

const PRAZO_MS = 480;
const TOLERANCIA_PX = 10;

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const disparou = useRef(false);

  function limpar() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function onPointerDown(e: React.PointerEvent) {
    inicio.current = { x: e.clientX, y: e.clientY };
    disparou.current = false;
    limpar();
    timer.current = setTimeout(() => {
      disparou.current = true;
      onLongPress();
    }, PRAZO_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!inicio.current) return;
    const dx = e.clientX - inicio.current.x;
    const dy = e.clientY - inicio.current.y;
    if (Math.hypot(dx, dy) > TOLERANCIA_PX) limpar();
  }

  function onPointerUp() {
    limpar();
  }

  /** Cancela o clique normal quando o long-press já disparou. */
  function onClickCapture(e: React.MouseEvent) {
    if (disparou.current) {
      e.preventDefault();
      e.stopPropagation();
      disparou.current = false;
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
    onClickCapture,
  };
}
