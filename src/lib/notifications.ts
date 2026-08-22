// Lembretes locais: itens da geladeira perto de vencer e lembrete semanal de compras.
//
// No app nativo (Android via Capacitor) isso agenda notificações de verdade pelo
// plugin @capacitor/local-notifications. No PWA/web não há infraestrutura de push
// confiável para "tocar depois com o app fechado" — por isso essas funções são
// no-op fora do nativo, e o equivalente web é o aviso in-app (ver lib/lembretes.ts
// + App.tsx), que confere o estado a cada abertura do app.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { GeladeiraItem } from '../types';

export function notificacoesNativasDisponiveis(): boolean {
  return Capacitor.isNativePlatform();
}

export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  if (!notificacoesNativasDisponiveis()) return false;
  const atual = await LocalNotifications.checkPermissions();
  if (atual.display === 'granted') return true;
  const pedido = await LocalNotifications.requestPermissions();
  return pedido.display === 'granted';
}

const ID_LEMBRETE_SEMANAL = 1;
// Ids de notificação de validade ficam numa faixa fixa, pra dar pra limpar todas de
// uma vez (reagendar do zero) sem mexer no lembrete semanal, que usa o id 1.
const BASE_ID_VALIDADE = 1000;
const FAIXA_ID_VALIDADE = 9000;

/** Deriva um id numérico estável a partir da chave do item, pra reagendar sem duplicar. */
function idDeValidade(itemKey: string): number {
  let h = 0;
  for (let i = 0; i < itemKey.length; i++) h = (h * 31 + itemKey.charCodeAt(i)) >>> 0;
  return BASE_ID_VALIDADE + (h % FAIXA_ID_VALIDADE);
}

/**
 * Reagenda (do zero) os avisos de validade: um por item com validade futura,
 * disparando às 9h do dia em que ele entra na janela de aviso.
 */
export async function agendarLembretesValidade(itens: GeladeiraItem[], diasAviso = 3): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;

  const pendentes = await LocalNotifications.getPending();
  const idsAntigos = pendentes.notifications
    .filter((n) => n.id >= BASE_ID_VALIDADE && n.id < BASE_ID_VALIDADE + FAIXA_ID_VALIDADE)
    .map((n) => ({ id: n.id }));
  if (idsAntigos.length > 0) await LocalNotifications.cancel({ notifications: idsAntigos });

  const agora = Date.now();
  const notifications = itens
    .filter((i): i is GeladeiraItem & { validade: number } => i.validade != null)
    .map((i) => {
      const alvo = new Date(i.validade);
      alvo.setDate(alvo.getDate() - diasAviso);
      alvo.setHours(9, 0, 0, 0);
      if (alvo.getTime() <= agora) return null;
      return {
        id: idDeValidade(i.itemKey),
        title: 'Vencendo na geladeira',
        body: `${i.nome} vence em ${diasAviso} dias — hora de usar ou repor.`,
        schedule: { at: alvo },
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

export async function cancelarLembretesValidade(): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;
  const pendentes = await LocalNotifications.getPending();
  const ids = pendentes.notifications
    .filter((n) => n.id >= BASE_ID_VALIDADE && n.id < BASE_ID_VALIDADE + FAIXA_ID_VALIDADE)
    .map((n) => ({ id: n.id }));
  if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
}

export interface LembreteComprasConfig {
  ativo: boolean;
  /** 0 = domingo .. 6 = sábado, mesma convenção de Date#getDay(). */
  diaSemana: number;
  /** "HH:MM" */
  hora: string;
}

export async function agendarLembreteSemanal(config: LembreteComprasConfig): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;
  await LocalNotifications.cancel({ notifications: [{ id: ID_LEMBRETE_SEMANAL }] });
  if (!config.ativo) return;

  const [hora, minuto] = config.hora.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID_LEMBRETE_SEMANAL,
        title: 'Lista de compras da semana',
        body: 'Bora montar o plano da semana e a lista de mercado?',
        schedule: {
          // Capacitor usa 1 = domingo .. 7 = sábado.
          on: { weekday: config.diaSemana + 1, hour: hora, minute: minuto },
          allowWhileIdle: true,
        },
      },
    ],
  });
}

// ---- Timers do modo cozinha ----
//
// O timer conta na tela enquanto o app está aberto, mas cozinhar é justamente quando o
// aparelho fica bloqueado no balcão: sem uma notificação agendada no sistema, o alarme
// simplesmente não toca. Ids em faixa própria para cancelar sem tocar nos outros avisos.
const BASE_ID_TIMER = 20_000;
const FAIXA_ID_TIMER = 100;

function idDeTimer(indice: number): number {
  return BASE_ID_TIMER + (indice % FAIXA_ID_TIMER);
}

/** Agenda o alarme do sistema para um timer de cozinha (no-op fora do app nativo). */
export async function agendarTimerCozinha(indice: number, fimEm: number, rotulo: string): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;
  const id = idDeTimer(indice);
  await LocalNotifications.cancel({ notifications: [{ id }] });
  if (fimEm <= Date.now()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: 'Timer da receita',
        body: rotulo,
        schedule: { at: new Date(fimEm), allowWhileIdle: true },
      },
    ],
  });
}

export async function cancelarTimerCozinha(indice: number): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;
  await LocalNotifications.cancel({ notifications: [{ id: idDeTimer(indice) }] });
}

/** Cancela todos os alarmes de timer (ao fechar o modo cozinha). */
export async function cancelarTimersCozinha(): Promise<void> {
  if (!notificacoesNativasDisponiveis()) return;
  const pendentes = await LocalNotifications.getPending();
  const ids = pendentes.notifications
    .filter((n) => n.id >= BASE_ID_TIMER && n.id < BASE_ID_TIMER + FAIXA_ID_TIMER)
    .map((n) => ({ id: n.id }));
  if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
}
