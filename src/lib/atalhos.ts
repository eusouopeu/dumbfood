// Ponte com o plugin nativo Android `Atalhos` (ver android/.../AtalhosPlugin.java): atalhos
// do ícone e widget do dia. No PWA não há implementação — tudo aqui vira no-op.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Destinos que atalhos e widget abrem (o host de dumbfood://<destino>). */
export type DestinoAtalho = 'registrar' | 'lista' | 'importar';

interface AtalhosPlugin {
  addListener(eventName: 'abrir', listenerFunc: (data: { destino: string }) => void): Promise<PluginListenerHandle>;
  atualizarWidget(dados: { kcal: number; meta: number; dia: string }): Promise<void>;
}

export const Atalhos = registerPlugin<AtalhosPlugin>('Atalhos');

/** Rota do app para cada destino; desconhecido cai na tela inicial. */
export function rotaDoAtalho(destino: string): string {
  if (destino === 'registrar') return '/?registrar=1';
  if (destino === 'lista') return '/lista';
  if (destino === 'importar') return '/importar';
  return '/';
}

/** Manda as kcal de hoje e a meta para o widget. Falha silenciosa: o widget é extra. */
export function atualizarWidget(kcal: number, meta: number, dia: string): void {
  if (!Capacitor.isNativePlatform()) return;
  Atalhos.atualizarWidget({ kcal: Math.round(kcal), meta: Math.round(meta), dia }).catch(() => {});
}
