// Cache e limite de requisições do endpoint de importação por link.
// Receita publicada não muda: repetir o fetch a cada tentativa só gasta tempo, banda e
// aumenta a chance de o site bloquear o servidor. O estado vive na memória do processo —
// numa função serverless isso significa "por instância quente", que já cobre o caso
// comum (o usuário tentando o mesmo link duas ou três vezes seguidas).

import type { NewRecipe } from '../types';

/** Quanto tempo uma receita fica em cache. */
export const TTL_MS = 24 * 60 * 60 * 1000;
/** Teto de entradas em memória, para o cache não crescer sem limite. */
export const MAX_ENTRADAS = 200;
/** Janela e teto do limite por IP. */
export const JANELA_LIMITE_MS = 60_000;
export const MAX_REQUISICOES_JANELA = 20;

interface Entrada {
  recipe: NewRecipe;
  expiraEm: number;
}

const cache = new Map<string, Entrada>();

/** Normaliza a URL para a chave do cache: descarta fragmento e parâmetros de campanha. */
export function chaveDeCache(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of Array.from(u.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|ref$|ref_)/i.test(p)) u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function lerDoCache(url: string, agora = Date.now()): NewRecipe | null {
  const chave = chaveDeCache(url);
  const entrada = cache.get(chave);
  if (!entrada) return null;
  if (entrada.expiraEm <= agora) {
    cache.delete(chave);
    return null;
  }
  // Reinsere para manter a ordem de uso (o descarte abaixo remove sempre o mais antigo).
  cache.delete(chave);
  cache.set(chave, entrada);
  return entrada.recipe;
}

export function gravarNoCache(url: string, recipe: NewRecipe, agora = Date.now()): void {
  const chave = chaveDeCache(url);
  cache.delete(chave);
  cache.set(chave, { recipe, expiraEm: agora + TTL_MS });
  while (cache.size > MAX_ENTRADAS) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga === undefined) break;
    cache.delete(maisAntiga);
  }
}

export function limparCache(): void {
  cache.clear();
}

const janelas = new Map<string, number[]>();

export interface ResultadoLimite {
  permitido: boolean;
  /** Segundos até liberar, quando bloqueado. */
  esperarSegundos: number;
}

/**
 * Janela deslizante simples por cliente. Protege o endpoint de virar proxy de fetch
 * para terceiros, que é o risco real de uma função que busca qualquer URL.
 */
export function registrarRequisicao(cliente: string, agora = Date.now()): ResultadoLimite {
  const recentes = (janelas.get(cliente) ?? []).filter((t) => agora - t < JANELA_LIMITE_MS);
  if (recentes.length >= MAX_REQUISICOES_JANELA) {
    janelas.set(cliente, recentes);
    return { permitido: false, esperarSegundos: Math.ceil((JANELA_LIMITE_MS - (agora - recentes[0])) / 1000) };
  }
  recentes.push(agora);
  janelas.set(cliente, recentes);
  // Descarta clientes inativos para o mapa não crescer indefinidamente.
  if (janelas.size > 500) {
    for (const [k, ts] of janelas) {
      if (ts.every((t) => agora - t >= JANELA_LIMITE_MS)) janelas.delete(k);
    }
  }
  return { permitido: true, esperarSegundos: 0 };
}

export function limparLimites(): void {
  janelas.clear();
}
