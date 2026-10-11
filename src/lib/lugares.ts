// Lembretes por lugar (GPS) e por dia da semana:
// - na cozinha → lembrar de lançar o que está comendo (notificação ou alarme que só para
//   quando desligado);
// - saindo da academia → "passe no mercado", se algo da despensa está acabando ou se é dia
//   de hortifrúti;
// - dia de hortifrúti (desconto/reposição) → lembrete no horário escolhido.
//
// Quem vigia o GPS é o Android (cercas do Google Play services, LugaresPlugin.java), com o
// app fechado. Este arquivo guarda a configuração (localStorage `dumbfood:lugares`, entra no
// backup) e a entrega ao nativo. GPS não distingue cômodos: a "cozinha" é um círculo em
// volta do ponto marcado — funciona melhor quando a cozinha fica longe do resto da casa.

import { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface Ponto {
  lat: number;
  lng: number;
  /** Raio da cerca em metros. */
  raio: number;
}

export interface ConfigLugares {
  cozinha: {
    ativo: boolean;
    ponto?: Ponto;
    modo: 'notificacao' | 'alarme';
    /** Janela do dia em que avisa ("HH:MM"). */
    inicio: string;
    fim: string;
    /** Intervalo mínimo entre dois avisos, em minutos. */
    intervaloMin: number;
  };
  academia: { ativo: boolean; ponto?: Ponto };
  hortifruti: {
    ativo: boolean;
    /** 0 = domingo .. 6 = sábado. */
    dias: number[];
    hora: string;
    mercado: string;
  };
}

export const CONFIG_PADRAO: ConfigLugares = {
  cozinha: { ativo: false, modo: 'notificacao', inicio: '06:00', fim: '23:30', intervaloMin: 90 },
  academia: { ativo: false },
  hortifruti: { ativo: false, dias: [], hora: '08:00', mercado: '' },
};

export const RAIO_PADRAO = { cozinha: 25, academia: 80 };

const KEY = 'dumbfood:lugares';

export function lerConfigLugares(): ConfigLugares {
  try {
    const salvo = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ConfigLugares>;
    return {
      cozinha: { ...CONFIG_PADRAO.cozinha, ...salvo.cozinha },
      academia: { ...CONFIG_PADRAO.academia, ...salvo.academia },
      hortifruti: { ...CONFIG_PADRAO.hortifruti, ...salvo.hortifruti },
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

/** Formato que o Lugares.java lê (lat/lng/raio achatados em cada lugar). */
export function configParaNativo(c: ConfigLugares): string {
  const lugar = (ativo: boolean, p?: Ponto) => (p ? { ativo, lat: p.lat, lng: p.lng, raio: p.raio } : { ativo: false });
  return JSON.stringify({
    cozinha: {
      ...lugar(c.cozinha.ativo, c.cozinha.ponto),
      modo: c.cozinha.modo,
      inicio: c.cozinha.inicio,
      fim: c.cozinha.fim,
      intervaloMin: c.cozinha.intervaloMin,
    },
    academia: lugar(c.academia.ativo, c.academia.ponto),
    hortifruti: { ativo: c.hortifruti.ativo, dias: c.hortifruti.dias, mercado: c.hortifruti.mercado },
  });
}

export interface EstadoLugares {
  localizacao: boolean;
  segundoPlano: boolean;
  playServices: boolean;
}

interface PluginLugares {
  estado(): Promise<EstadoLugares>;
  pedirLocalizacao(): Promise<EstadoLugares>;
  pedirSegundoPlano(): Promise<void>;
  abrirAjustes(): Promise<void>;
  posicaoAtual(): Promise<{ lat: number; lng: number; precisao: number }>;
  configurar(o: { json: string }): Promise<void>;
  publicarEstado(o: { acabando: string[]; ultimoRegistro: number }): Promise<void>;
  testarAviso(o: { modo: 'notificacao' | 'alarme' | 'mercado' }): Promise<void>;
  desligarAlarme(): Promise<void>;
}

export const Lugares = registerPlugin<PluginLugares>('Lugares');

export const lugaresDisponiveis = () => Capacitor.isNativePlatform();

// Faixa de ids das notificações de hortifrúti (uma por dia da semana marcado).
const BASE_ID_HORTIFRUTI = 2000;

async function agendarHortifruti(h: ConfigLugares['hortifruti']): Promise<void> {
  const pendentes = await LocalNotifications.getPending();
  const antigos = pendentes.notifications
    .filter((n) => n.id >= BASE_ID_HORTIFRUTI && n.id < BASE_ID_HORTIFRUTI + 7)
    .map((n) => ({ id: n.id }));
  if (antigos.length) await LocalNotifications.cancel({ notifications: antigos });
  if (!h.ativo || h.dias.length === 0) return;
  const [hora, minuto] = h.hora.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: h.dias.map((dia) => ({
      id: BASE_ID_HORTIFRUTI + dia,
      title: 'Dia de hortifrúti',
      body: `Frutas e verduras com desconto ou reposição${h.mercado ? ` no ${h.mercado}` : ''} hoje.`,
      extra: { destino: 'mercado' },
      // Capacitor usa 1 = domingo .. 7 = sábado.
      schedule: { on: { weekday: dia + 1, hour: hora, minute: minuto }, allowWhileIdle: true },
    })),
  });
}

/** Entrega a configuração ao Android (cercas) e reagenda os lembretes de hortifrúti. */
export async function aplicarConfigLugares(c: ConfigLugares): Promise<void> {
  if (!lugaresDisponiveis()) return;
  await Lugares.configurar({ json: configParaNativo(c) });
  await agendarHortifruti(c.hortifruti);
}

export function useConfigLugares(): [ConfigLugares, (c: ConfigLugares) => void] {
  const [config, setConfig] = useState<ConfigLugares>(() => lerConfigLugares());
  const salvar = useCallback((c: ConfigLugares) => {
    localStorage.setItem(KEY, JSON.stringify(c));
    setConfig(c);
    void aplicarConfigLugares(c).catch(() => {});
  }, []);
  return [config, salvar];
}

/** Estado das permissões, conferido de novo sempre que o app volta à frente. */
export function useEstadoLugares(): [EstadoLugares | null, () => void] {
  const [estado, setEstado] = useState<EstadoLugares | null>(null);
  const atualizar = useCallback(() => {
    if (!lugaresDisponiveis()) return;
    Lugares.estado().then(setEstado).catch(() => {});
  }, []);
  useEffect(() => {
    atualizar();
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [atualizar]);
  return [estado, atualizar];
}

/** O que os avisos consultam com o app fechado. Falha silenciosa: é extra. */
export function publicarEstadoLugares(acabando: string[], ultimoRegistro: number): void {
  if (!lugaresDisponiveis()) return;
  Lugares.publicarEstado({ acabando, ultimoRegistro }).catch(() => {});
}
