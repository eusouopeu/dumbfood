// Refeições do dia: as quatro fixas mais as que o usuário inventar.
//
// Café/almoço/lanche/jantar cobrem a maioria dos dias, mas não todos — ceia, pré-treino
// e o segundo lanche da tarde existem e, sem lugar para eles, o registro do dia mente.
// As personalizadas ficam em localStorage sob o prefixo `dumbfood:` (entram no backup
// como o resto das preferências); o que foi comido nelas continua no Dexie, em `consumo`.
//
// A divisão da meta entre refeições é renormalizada a cada mudança de lista: com uma
// refeição a mais, a soma dos "recomendados" continua sendo a meta do dia, e não 115%.

import { useEffect, useState } from 'react';
import { REFEICOES } from './agenda';
import { DISTRIBUICAO_REFEICAO } from './metas';
import type { Refeicao } from '../types';

export interface RefeicaoDef {
  chave: Refeicao;
  label: string;
  /** true nas refeições criadas pelo usuário (as únicas que podem ser removidas). */
  extra?: boolean;
}

const CHAVE_LS = 'dumbfood:refeicoesExtras';

/** Peso de uma refeição personalizada antes da renormalização (entre lanche e jantar). */
const PESO_EXTRA = 0.15;

const CHAVES_PADRAO = REFEICOES.map((r) => r.chave);

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Chave estável a partir do rótulo digitado ("Pré-treino" -> "pre-treino"), sem colidir
 * com nenhuma refeição já existente — inclusive as fixas, que são chaves reservadas.
 */
export function chaveRefeicaoNova(label: string, existentes: Refeicao[]): Refeicao {
  const base =
    semAcento(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'refeicao';
  const usadas = new Set(existentes);
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function lerRefeicoesExtras(): RefeicaoDef[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const bruto = localStorage.getItem(CHAVE_LS);
    if (!bruto) return [];
    const dados = JSON.parse(bruto) as RefeicaoDef[];
    if (!Array.isArray(dados)) return [];
    return dados
      .filter((r) => r && typeof r.chave === 'string' && typeof r.label === 'string')
      .map((r) => ({ chave: r.chave, label: r.label, extra: true }));
  } catch {
    return [];
  }
}

function salvarRefeicoesExtras(extras: RefeicaoDef[]): void {
  try {
    localStorage.setItem(CHAVE_LS, JSON.stringify(extras.map(({ chave, label }) => ({ chave, label }))));
  } catch {
    /* cota cheia ou storage bloqueado: a lista segue só em memória nesta sessão. */
  }
}

/** As quatro fixas, na ordem do dia, seguidas das personalizadas. */
export function todasRefeicoes(extras: RefeicaoDef[] = lerRefeicoesExtras()): RefeicaoDef[] {
  return [...REFEICOES.map((r) => ({ chave: r.chave, label: r.label })), ...extras];
}

/** Avisa as telas abertas que a lista mudou (o evento nativo só dispara em outra aba). */
const EVENTO = 'dumbfood:refeicoes';

export function useRefeicoes(): {
  refeicoes: RefeicaoDef[];
  adicionar: (label: string) => RefeicaoDef | null;
  remover: (chave: Refeicao) => void;
} {
  const [extras, setExtras] = useState<RefeicaoDef[]>(() => lerRefeicoesExtras());

  useEffect(() => {
    const sincronizar = () => setExtras(lerRefeicoesExtras());
    window.addEventListener(EVENTO, sincronizar);
    window.addEventListener('storage', sincronizar);
    return () => {
      window.removeEventListener(EVENTO, sincronizar);
      window.removeEventListener('storage', sincronizar);
    };
  }, []);

  function adicionar(label: string): RefeicaoDef | null {
    const limpo = label.trim();
    if (!limpo) return null;
    const atuais = lerRefeicoesExtras();
    const nova: RefeicaoDef = {
      chave: chaveRefeicaoNova(limpo, [...CHAVES_PADRAO, ...atuais.map((r) => r.chave)]),
      label: limpo,
      extra: true,
    };
    const proximas = [...atuais, nova];
    salvarRefeicoesExtras(proximas);
    setExtras(proximas);
    window.dispatchEvent(new Event(EVENTO));
    return nova;
  }

  function remover(chave: Refeicao) {
    const proximas = lerRefeicoesExtras().filter((r) => r.chave !== chave);
    salvarRefeicoesExtras(proximas);
    setExtras(proximas);
    window.dispatchEvent(new Event(EVENTO));
  }

  return { refeicoes: todasRefeicoes(extras), adicionar, remover };
}

/**
 * Como a meta do dia se reparte entre as refeições ativas. As fixas mantêm os pesos
 * de sempre, cada personalizada entra com `PESO_EXTRA`, e o conjunto é dividido pela
 * soma — assim os "recomendados" somam a meta, com quantas refeições existirem.
 */
export function distribuicaoRefeicoes(chaves: Refeicao[]): Record<string, number> {
  const pesos = chaves.map((c) => DISTRIBUICAO_REFEICAO[c as keyof typeof DISTRIBUICAO_REFEICAO] ?? PESO_EXTRA);
  const soma = pesos.reduce((s, p) => s + p, 0) || 1;
  const out: Record<string, number> = {};
  chaves.forEach((c, i) => {
    out[c] = pesos[i] / soma;
  });
  return out;
}

/** kcal recomendadas para uma refeição, dada a lista de refeições ativas do dia. */
export function kcalRecomendada(kcalDia: number, chave: Refeicao, chaves: Refeicao[]): number {
  return Math.round(kcalDia * (distribuicaoRefeicoes(chaves)[chave] ?? 0));
}

/**
 * Refeição fixa que corresponde à hora do registro, para a barra de adição rápida da
 * tela inicial não perguntar "em qual refeição?" a cada item. Madrugada conta como
 * jantar: é o registro atrasado da noite, não um café da manhã às 2h.
 */
export function refeicaoPorHorario(agora: Date = new Date()): Refeicao {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  if (minutos < 4 * 60) return 'jantar';
  if (minutos < 10 * 60 + 30) return 'cafe';
  if (minutos < 15 * 60) return 'almoco';
  if (minutos < 18 * 60 + 30) return 'lanche';
  return 'jantar';
}
