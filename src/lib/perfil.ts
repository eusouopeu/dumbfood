// Perfil de quem come: os dados mínimos para estimar um gasto energético diário.
//
// Até aqui o app só sabia a *proporção* de macros desejada (diet.ts). Proporção responde
// "esse plano está equilibrado?", mas não "cabe no meu dia?" — para isso é preciso um
// número absoluto de kcal, e ele depende de peso, altura, idade e objetivo.
//
// Fica em localStorage, como diet.ts e orcamento.ts: é preferência do aparelho, e o
// backup JSON continua carregando só receitas, compras, preços e geladeira.

import { useEffect, useState } from 'react';

export type Sexo = 'f' | 'm';
export type Objetivo = 'perder' | 'manter' | 'ganhar';
export type Atividade = 'sedentario' | 'leve' | 'moderado' | 'intenso';

export interface Perfil {
  nome?: string;
  sexo: Sexo;
  /** Idade em anos; ausente enquanto o usuário não preenche. */
  idade?: number;
  pesoKg?: number;
  alturaCm?: number;
  atividade: Atividade;
  objetivo: Objetivo;
}

export const PERFIL_PADRAO: Perfil = { sexo: 'f', atividade: 'sedentario', objetivo: 'manter' };

export const OBJETIVOS: { chave: Objetivo; label: string }[] = [
  { chave: 'perder', label: 'Perder peso' },
  { chave: 'manter', label: 'Manter peso' },
  { chave: 'ganhar', label: 'Ganhar peso' },
];

export const ATIVIDADES: { chave: Atividade; label: string; fator: number }[] = [
  { chave: 'sedentario', label: 'Sedentário', fator: 1.2 },
  { chave: 'leve', label: 'Leve', fator: 1.375 },
  { chave: 'moderado', label: 'Moderado', fator: 1.55 },
  { chave: 'intenso', label: 'Intenso', fator: 1.725 },
];

export const SEXOS: { chave: Sexo; label: string }[] = [
  { chave: 'f', label: 'Feminino' },
  { chave: 'm', label: 'Masculino' },
];

/** Ajuste sobre o gasto estimado, por objetivo: déficit de 15% ou superávit de 10%. */
const AJUSTE_OBJETIVO: Record<Objetivo, number> = { perder: 0.85, manter: 1, ganhar: 1.1 };

function tmbBruta(p: Perfil): number | null {
  if (!p.pesoKg || !p.alturaCm || !p.idade) return null;
  // Mifflin-St Jeor: mais próxima da realidade que Harris-Benedict para quem não é atleta.
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.idade;
  return p.sexo === 'm' ? base + 5 : base - 161;
}

/** Taxa metabólica basal estimada (kcal/dia), ou null quando faltam dados. */
export function tmb(p: Perfil): number | null {
  const bruta = tmbBruta(p);
  return bruta === null ? null : Math.round(bruta);
}

export function fatorAtividade(a: Atividade): number {
  return ATIVIDADES.find((x) => x.chave === a)?.fator ?? 1.2;
}

/**
 * Meta calórica sugerida: basal × fator de atividade, corrigida pelo objetivo.
 * É sugestão — a tela de calorias deixa sobrescrever o número à mão.
 */
export function kcalSugerida(p: Perfil): number | null {
  const bruta = tmbBruta(p);
  if (bruta === null) return null;
  return Math.round(bruta * fatorAtividade(p.atividade) * AJUSTE_OBJETIVO[p.objetivo]);
}

const KEY = 'dumbfood:perfil';

function carregar(): Perfil {
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return PERFIL_PADRAO;
    return { ...PERFIL_PADRAO, ...(JSON.parse(bruto) as Partial<Perfil>) };
  } catch {
    return PERFIL_PADRAO;
  }
}

export function lerPerfil(): Perfil {
  return carregar();
}

export function usePerfil(): [Perfil, (p: Perfil) => void] {
  const [perfil, setPerfil] = useState<Perfil>(() => carregar());
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(perfil));
  }, [perfil]);
  return [perfil, setPerfil];
}
