// Status de validade de um item da geladeira/despensa, para destacar o que está
// perto de vencer ou já venceu.

export type StatusValidade = 'vencido' | 'vence_hoje' | 'proximo' | 'ok';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Início do dia (00:00) de um timestamp, para comparar datas sem hora atrapalhar. */
function inicioDoDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Dias até a validade (negativo = já venceu), contando por dia de calendário. */
export function diasParaVencer(validade: number, agora = Date.now()): number {
  return Math.round((inicioDoDia(validade) - inicioDoDia(agora)) / DIA_MS);
}

/**
 * Classifica a validade em relação a hoje. `proximo` cobre os itens que vencem
 * dentro da janela de aviso (padrão 3 dias) — perto o bastante para priorizar
 * na hora de escolher o que cozinhar.
 */
export function statusValidade(validade: number, agora = Date.now(), diasAviso = 3): StatusValidade {
  const dias = diasParaVencer(validade, agora);
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'vence_hoje';
  if (dias <= diasAviso) return 'proximo';
  return 'ok';
}

export function rotuloValidade(validade: number, agora = Date.now()): string {
  const dias = diasParaVencer(validade, agora);
  if (dias < 0) return `venceu há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}
