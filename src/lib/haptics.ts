// Vibração leve em ações rápidas (marcar item, deslizar para excluir, confirmar
// exclusão), só no app nativo — no PWA/web isso é sempre um no-op silencioso.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

async function vibrar(estilo: ImpactStyle): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: estilo });
  } catch {
    // Dispositivo sem suporte a haptics: ignora.
  }
}

/** Toque leve — marcar/desmarcar item, alternar favorito. */
export function hapticLeve(): void {
  void vibrar(ImpactStyle.Light);
}

/** Toque médio — ação concluída (deslizar para excluir, salvar). */
export function hapticMedio(): void {
  void vibrar(ImpactStyle.Medium);
}

/** Toque forte — ação destrutiva confirmada. */
export function hapticForte(): void {
  void vibrar(ImpactStyle.Heavy);
}
