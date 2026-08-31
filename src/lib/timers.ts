// Temporizadores flutuantes: criados na receita, mas seguem visíveis (e tocam) em
// qualquer tela do app — a mão suja de cozinhar não deveria prender o usuário na
// tela do preparo. Estado num store global (mesmo padrão de toast.ts), persistido
// em localStorage por tempo absoluto (terminaEm), pra sobreviver a um reload e
// continuar certo mesmo com a aba em segundo plano.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { hapticForte } from './haptics';

export interface TimerAtivo {
  id: string;
  rotulo: string;
  duracaoMs: number;
  /** Timestamp em que termina, enquanto rodando; null enquanto pausado. */
  terminaEm: number | null;
  /** Quanto falta, em ms; só é a fonte da verdade enquanto pausado. */
  restanteMs: number;
  /** true a partir do momento em que chega a zero, até o usuário dispensar o alarme. */
  tocando: boolean;
}

const CHAVE = 'dumbfood-timers-ativos';
const BASE_ID_NOTIF = 5000;
const FAIXA_ID_NOTIF = 4000;

type Listener = (timers: TimerAtivo[]) => void;
const listeners = new Set<Listener>();
let timers: TimerAtivo[] = carregar();
let intervalo: ReturnType<typeof setInterval> | null = null;

function carregar(): TimerAtivo[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
  } catch {
    return [];
  }
}

function persistir() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CHAVE, JSON.stringify(timers));
}

function emitir() {
  persistir();
  for (const l of listeners) l(timers);
}

export function onTimers(listener: Listener): () => void {
  listeners.add(listener);
  listener(timers);
  garantirTicker();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
  };
}

/** Um único intervalo global cuida de detectar quando cada temporizador zera. */
function garantirTicker() {
  if (intervalo) return;
  intervalo = setInterval(() => {
    const agora = Date.now();
    let mudou = false;
    timers = timers.map((t) => {
      if (t.terminaEm !== null && !t.tocando && t.terminaEm <= agora) {
        mudou = true;
        hapticForte();
        return { ...t, tocando: true };
      }
      return t;
    });
    if (mudou) emitir();
    else if (timers.length > 0) for (const l of listeners) l(timers); // reflete a contagem regressiva
  }, 250);
}

function idDeNotificacao(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BASE_ID_NOTIF + (h % FAIXA_ID_NOTIF);
}

async function agendarNotificacao(t: TimerAtivo) {
  if (!Capacitor.isNativePlatform() || t.terminaEm === null) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idDeNotificacao(t.id),
          title: 'Temporizador terminou',
          body: t.rotulo,
          schedule: { at: new Date(t.terminaEm) },
        },
      ],
    });
  } catch {
    // Sem permissão ou plataforma sem suporte: o alarme na tela ainda funciona.
  }
}

async function cancelarNotificacao(id: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: idDeNotificacao(id) }] });
  } catch {
    // Nada agendado — ignora.
  }
}

export function criarTimer(rotulo: string, duracaoMs: number): TimerAtivo {
  const t: TimerAtivo = {
    id: (globalThis.crypto?.randomUUID?.() as string | undefined) ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rotulo,
    duracaoMs,
    terminaEm: Date.now() + duracaoMs,
    restanteMs: duracaoMs,
    tocando: false,
  };
  timers = [...timers, t];
  emitir();
  void agendarNotificacao(t);
  return t;
}

export function pausarTimer(id: string): void {
  const agora = Date.now();
  timers = timers.map((t) =>
    t.id === id && t.terminaEm !== null ? { ...t, restanteMs: Math.max(0, t.terminaEm - agora), terminaEm: null } : t,
  );
  emitir();
  void cancelarNotificacao(id);
}

export function retomarTimer(id: string): void {
  const agora = Date.now();
  const alvo = timers.find((t) => t.id === id);
  timers = timers.map((t) => (t.id === id ? { ...t, terminaEm: agora + t.restanteMs } : t));
  emitir();
  if (alvo) void agendarNotificacao({ ...alvo, terminaEm: agora + alvo.restanteMs });
}

/** Dispensa o alarme (temporizador zerado) ou cancela o que ainda está rodando. */
export function removerTimer(id: string): void {
  timers = timers.filter((t) => t.id !== id);
  emitir();
  void cancelarNotificacao(id);
}

/** Quanto falta agora, em ms (negativo depois de zerar). */
export function msRestantes(t: TimerAtivo, agora = Date.now()): number {
  return t.terminaEm !== null ? t.terminaEm - agora : t.restanteMs;
}

export function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

// ---- Som do alarme: bipe curto em loop enquanto houver temporizador tocando ----

let audioCtx: AudioContext | null = null;
let alarmeIntervalo: ReturnType<typeof setInterval> | null = null;

/** Precisa ser chamada a partir de um gesto do usuário (criar/interagir com o timer). */
export function prepararAudio(): void {
  if (audioCtx) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor) audioCtx = new Ctor();
}

function bipe() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.15;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.18);
}

/** Liga/desliga o bipe repetido conforme existir algum temporizador tocando. */
export function sincronizarAlarmeSonoro(algumTocando: boolean): void {
  if (algumTocando && !alarmeIntervalo) {
    bipe();
    alarmeIntervalo = setInterval(bipe, 700);
  } else if (!algumTocando && alarmeIntervalo) {
    clearInterval(alarmeIntervalo);
    alarmeIntervalo = null;
  }
}
