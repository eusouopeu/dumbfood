// Preferências de lembretes, persistidas em localStorage — mesmo padrão de diet.ts e
// theme.ts: são preferências de interface, não dados do usuário, então não entram no
// Dexie nem no backup JSON.

import { useEffect, useState } from 'react';

export interface LembreteComprasConfig {
  ativo: boolean;
  /** 0 = domingo .. 6 = sábado, mesma convenção de Date#getDay(). */
  diaSemana: number;
  /** "HH:MM" */
  hora: string;
}

const KEY_VALIDADE = 'dumbfood:lembreteValidade';
const KEY_COMPRAS = 'dumbfood:lembreteCompras';
const KEY_ULTIMO_AVISO = 'dumbfood:ultimoAvisoValidade';

const COMPRAS_PADRAO: LembreteComprasConfig = { ativo: false, diaSemana: 0, hora: '10:00' };

export function useLembreteValidade(): [boolean, (v: boolean) => void] {
  const [ativo, setAtivo] = useState(() => localStorage.getItem(KEY_VALIDADE) === '1');
  useEffect(() => {
    localStorage.setItem(KEY_VALIDADE, ativo ? '1' : '0');
  }, [ativo]);
  return [ativo, setAtivo];
}

export function useLembreteCompras(): [LembreteComprasConfig, (c: LembreteComprasConfig) => void] {
  const [config, setConfig] = useState<LembreteComprasConfig>(() => {
    try {
      return { ...COMPRAS_PADRAO, ...JSON.parse(localStorage.getItem(KEY_COMPRAS) ?? '{}') };
    } catch {
      return COMPRAS_PADRAO;
    }
  });
  useEffect(() => {
    localStorage.setItem(KEY_COMPRAS, JSON.stringify(config));
  }, [config]);
  return [config, setConfig];
}

/** true no máximo uma vez por dia — evita repetir o aviso toda vez que o app reabre. */
export function podeAvisarHoje(): boolean {
  return localStorage.getItem(KEY_ULTIMO_AVISO) !== new Date().toDateString();
}

export function marcarAvisadoHoje(): void {
  localStorage.setItem(KEY_ULTIMO_AVISO, new Date().toDateString());
}
