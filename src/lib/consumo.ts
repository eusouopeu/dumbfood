// Registro do que foi comido: fecha o ciclo plano → execução → histórico.
//
// O plano da semana sempre respondeu "o que é para comer". Sem um registro do que foi
// de fato comido, o app nunca sabe quanto ainda cabe no dia — e é essa a pergunta que o
// painel do dia responde. Aqui ficam as funções puras (chave do dia, somas, recentes);
// a escrita no banco está em db/repo.ts, como o resto.

import type { Nutrientes100g } from './nutrition';
import { somarNutrientes } from './nutrition';
import type { Refeicao, RegistroConsumo } from '../types';
import { REFEICOES } from './agenda';

/** Chave do dia no fuso local ('AAAA-MM-DD'), usada como índice do consumo. */
export function chaveDia(d: Date = new Date()): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Data (meia-noite local) a partir da chave — o caminho de volta de `chaveDia`. */
export function dataDaChave(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1);
}

/** Desloca uma chave de dia em `n` dias (negativo volta no tempo). */
export function somarDias(chave: string, n: number): string {
  const d = dataDaChave(chave);
  d.setDate(d.getDate() + n);
  return chaveDia(d);
}

/** Rótulo curto do dia para o cabeçalho navegável: "HOJE, 17 SET" / "SEX, 19 SET". */
export function rotuloDia(chave: string): string {
  const d = dataDaChave(chave);
  const hoje = chaveDia();
  const data = d
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    .replace('.', '')
    .toUpperCase();
  if (chave === hoje) return `HOJE, ${data}`;
  if (chave === somarDias(hoje, -1)) return `ONTEM, ${data}`;
  if (chave === somarDias(hoje, 1)) return `AMANHÃ, ${data}`;
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
  return `${semana}, ${data}`;
}

/**
 * Rótulo do cabeçalho navegável no formato do dia a dia: "Sexta, 12/09". O dia da
 * semana vem antes porque é ele que localiza a pessoa; a data confirma.
 */
export function rotuloDiaCurto(chave: string): string {
  const d = dataDaChave(chave);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/-feira$/, '');
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${data}`;
}

export function totaisDoDia(registros: RegistroConsumo[]): Nutrientes100g {
  return somarNutrientes(registros.map((r) => r.nutrientes));
}

/**
 * Agrupa os registros de um dia por refeição, na ordem em que o dia acontece. Registros
 * de refeições que não estão mais na lista (uma personalizada apagada depois) continuam
 * aparecendo: o que foi comido não some porque o slot deixou de existir.
 */
export function porRefeicao(
  registros: RegistroConsumo[],
  chaves: Refeicao[] = REFEICOES.map((r) => r.chave),
): Map<Refeicao, RegistroConsumo[]> {
  const mapa = new Map<Refeicao, RegistroConsumo[]>();
  for (const chave of chaves) mapa.set(chave, []);
  for (const r of registros) {
    const atual = mapa.get(r.refeicao);
    if (atual) atual.push(r);
    else mapa.set(r.refeicao, [r]);
  }
  return mapa;
}

/**
 * Últimos alimentos registrados, sem repetir o mesmo nome — é a aba "Recentes" do
 * seletor de registro, que é como quase todo registro acontece na prática (ninguém
 * come coisas novas todo dia).
 */
export function recentes(registros: RegistroConsumo[], limite = 12): RegistroConsumo[] {
  const vistos = new Set<string>();
  const out: RegistroConsumo[] = [];
  for (const r of [...registros].sort((a, b) => b.criadoEm - a.criadoEm)) {
    const chave = r.recipeId ?? r.nome.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(r);
    if (out.length >= limite) break;
  }
  return out;
}

/** Série dos últimos `n` dias (do mais antigo para o mais novo), com o total de kcal de cada. */
export function kcalPorDia(registros: RegistroConsumo[], ateChave: string, n = 7): { dia: string; kcal: number }[] {
  const porDia = new Map<string, number>();
  for (const r of registros) porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.nutrientes.kcal);
  const out: { dia: string; kcal: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dia = somarDias(ateChave, -i);
    out.push({ dia, kcal: Math.round(porDia.get(dia) ?? 0) });
  }
  return out;
}
