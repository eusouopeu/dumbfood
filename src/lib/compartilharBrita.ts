// dumbfood → Brita (rotinas e agenda do Pedro, no mesmo celular e sem internet).
//
// O Brita mostra na agenda de cada dia uma linha do dumbfood: kcal comidas contra a meta e o
// cardápio que o plano da semana marcou para aquele dia; e, para a ida ao mercado, o que está
// acabando na despensa e os dias de hortifrúti. Mesmo caminho do pacote do Nexo: o plugin
// `Compartilhar` grava na área privada e o CompartilharProvider só entrega ao Brita assinado
// pela chave dele.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { dataDaChave, somarDias } from './consumo';
import { receitasDoDia } from './agenda';
import type { PlanItem, Recipe, RegistroConsumo } from '../types';

export interface DiaParaBrita {
  dia: string;
  kcal: number;
  refeicoes: number;
  /** O que o plano marcou para o dia da semana: "Almoço" → ["Frango assado"]. */
  cardapio: { refeicao: string; receitas: string[] }[];
}

export interface PacoteBrita {
  app: 'dumbfood';
  versao: 1;
  gerado: number;
  metaKcal: number;
  dias: DiaParaBrita[];
  acabando: string[];
  hortifruti: { dias: number[]; mercado: string } | null;
}

export function pacoteParaBrita(
  consumo: RegistroConsumo[],
  receitas: Recipe[],
  plano: PlanItem[],
  rotulos: Record<string, string>,
  metaKcal: number,
  acabando: string[],
  hortifruti: PacoteBrita['hortifruti'],
  hoje: string,
): PacoteBrita {
  const porId = new Map(receitas.map((r) => [r.id, r]));
  const dias: DiaParaBrita[] = [];
  // Uma semana para trás (o que foi comido) e uma para a frente (o que está planejado).
  for (let i = -6; i <= 6; i++) {
    const dia = somarDias(hoje, i);
    const doDia = consumo.filter((r) => r.dia === dia);
    const porRefeicao = new Map<string, string[]>();
    for (const item of receitasDoDia(plano, porId, dataDaChave(dia).getDay())) {
      const rotulo = item.refeicao ? (rotulos[item.refeicao] ?? item.refeicao) : 'Sem refeição';
      porRefeicao.set(rotulo, [...(porRefeicao.get(rotulo) ?? []), item.recipe.titulo]);
    }
    dias.push({
      dia,
      kcal: Math.round(doDia.reduce((s, r) => s + r.nutrientes.kcal, 0)),
      refeicoes: doDia.length,
      cardapio: [...porRefeicao].map(([refeicao, nomes]) => ({ refeicao, receitas: nomes })),
    });
  }
  return { app: 'dumbfood', versao: 1, gerado: Date.now(), metaKcal: Math.round(metaKcal), dias, acabando, hortifruti };
}

interface PluginCompartilhar {
  publicarBrita(o: { json: string | null }): Promise<void>;
}

const Compartilhar = registerPlugin<PluginCompartilhar>('Compartilhar');

/** Publica (ou apaga, com null). Falha silenciosa: é um extra. */
export function publicarParaBrita(p: PacoteBrita | null): void {
  if (!Capacitor.isNativePlatform()) return;
  Compartilhar.publicarBrita({ json: p ? JSON.stringify(p) : null }).catch(() => {});
}
