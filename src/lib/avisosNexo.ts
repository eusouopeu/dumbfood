// Nexo → dumbfood: o que o diário de saúde pede para evitar — alergias da ficha de emergência
// e o alimento de um teste de eliminação em andamento. O dumbfood marca as receitas e pratos
// que contêm o termo, na hora de registrar ou planejar.
//
// Dado de saúde: o pacote fica fora do prefixo `dumbfood:` (não entra no backup) e só é lido
// do Nexo instalado e assinado pela chave do Pedro (CompartilharPlugin.lerNexo).

import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { normalizeItemKey } from './ingredientParser';

export interface AvisoNexo {
  /** "leite", "amendoim". */
  termo: string;
  /** "alergia" ou "teste de eliminação até 20/10". */
  motivo: string;
}

export interface PacoteNexoParaDumbfood {
  app: 'nexo';
  versao: 1;
  gerado: number;
  evitar: AvisoNexo[];
}

export function lerPacoteNexo(json: string): PacoteNexoParaDumbfood | null {
  try {
    const p = JSON.parse(json) as Partial<PacoteNexoParaDumbfood>;
    if (p?.app !== 'nexo' || p.versao !== 1 || !Array.isArray(p.evitar)) return null;
    return { app: 'nexo', versao: 1, gerado: p.gerado ?? 0, evitar: p.evitar.filter((a) => a && typeof a.termo === 'string' && a.termo.trim()) };
  } catch {
    return null;
  }
}

/** Avisos que batem com algum ingrediente (por palavra inteira, sem acento e no singular). */
export function avisosDosIngredientes(ingredientes: string[], evitar: AvisoNexo[]): AvisoNexo[] {
  if (evitar.length === 0) return [];
  const chaves = ingredientes.map((i) => ` ${normalizeItemKey(i)} `);
  return evitar.filter((a) => {
    const t = normalizeItemKey(a.termo);
    return t && chaves.some((c) => c.includes(` ${t} `));
  });
}

const KEY = 'dumbfoodNexo:evitar'; // fora do prefixo `dumbfood:` → fora do backup
const EVENTO = 'dumbfood-nexo-avisos';

export function avisosGuardados(): AvisoNexo[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as PacoteNexoParaDumbfood | null)?.evitar ?? [];
  } catch {
    return [];
  }
}

export function useAvisosNexo(): AvisoNexo[] {
  const [avisos, setAvisos] = useState(avisosGuardados);
  useEffect(() => {
    const atualizar = () => setAvisos(avisosGuardados());
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);
  return avisos;
}

export type ErroNexo = 'nao-instalado' | 'assinatura' | 'desligado' | 'recusado' | 'indisponivel';

export const TEXTO_ERRO_NEXO: Record<ErroNexo, string> = {
  'nao-instalado': 'Nexo não instalado',
  assinatura: 'o Nexo instalado não é o seu (assinatura diferente)',
  desligado: 'no Nexo, ligue Ajustes › Integrações › Enviar ao dumbfood',
  recusado: 'o Nexo recusou a leitura',
  indisponivel: 'só no app Android',
};

interface PluginCompartilhar {
  lerNexo(): Promise<{ json?: string; erro?: ErroNexo }>;
}

const Compartilhar = registerPlugin<PluginCompartilhar>('Compartilhar');

/** Lê do Nexo e guarda; com `receber` desligado, apaga o que havia. */
export async function sincronizarAvisosNexo(receber: boolean): Promise<{ avisos: AvisoNexo[]; erro?: ErroNexo }> {
  const gravar = (p: PacoteNexoParaDumbfood | null) => {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENTO));
  };
  if (!receber) {
    gravar(null);
    return { avisos: [] };
  }
  if (!Capacitor.isNativePlatform()) return { avisos: [], erro: 'indisponivel' };
  const r = await Compartilhar.lerNexo();
  const pacote = r.json ? lerPacoteNexo(r.json) : null;
  if (!pacote) {
    // "desligado" do lado do Nexo também apaga o que estava guardado aqui.
    if (r.erro === 'desligado' || (!r.erro && !pacote)) gravar(null);
    return { avisos: avisosGuardados(), erro: r.erro ?? 'desligado' };
  }
  gravar(pacote);
  return { avisos: pacote.evitar };
}
