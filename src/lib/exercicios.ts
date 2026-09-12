// Exercício do dia: o outro lado do balanço que o anel do painel mostra.
//
// O registro é manual (nome + kcal, minutos opcionais) porque o app não tem sensor nem
// integração com relógio. A meta de calorias NÃO cresce com o que foi queimado: a meta
// vem do perfil, que já embute o fator de atividade — somar de novo contaria o mesmo
// gasto duas vezes. O queimado aparece como número próprio, ao lado do consumido.

import type { RegistroExercicio } from '../types';

/** Total de kcal queimadas em um dia ('AAAA-MM-DD'). */
export function kcalQueimadaNoDia(registros: RegistroExercicio[], dia: string): number {
  return registros.filter((r) => r.dia === dia).reduce((s, r) => s + (r.kcal || 0), 0);
}

/** Total de kcal queimadas por dia, para cruzar com a série de consumo do gráfico. */
export function kcalQueimadaPorDia(registros: RegistroExercicio[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of registros) mapa.set(r.dia, (mapa.get(r.dia) ?? 0) + (r.kcal || 0));
  return mapa;
}
