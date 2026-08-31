// Backup automático semanal: ninguém lembra de exportar toda semana, e os dados
// (receitas, plano, histórico de compras, geladeira) só existem no aparelho — perder
// o aparelho sem um backup recente é perder tudo. Reaproveita o mesmo export manual
// de Configuracoes.tsx, só que disparado sozinho ao abrir o app.
//
// O navegador não deixa sobrescrever um arquivo específico no disco sem interação do
// usuário a cada vez; o nome leva a data para não colidir com o backup manual, e o
// próprio navegador evita duplicar o download se o arquivo já existir no mesmo dia.

import { exportarJSON } from '../db/repo';

const CHAVE_ULTIMO = 'dumbfood-ultimoBackupAuto';
const INTERVALO_MS = 7 * 24 * 60 * 60 * 1000;

function baixar(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** Roda o backup semanal se já passou uma semana desde o último (silencioso, sem diálogo). */
export async function verificarBackupAutomatico(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const ultimo = Number(localStorage.getItem(CHAVE_ULTIMO) ?? '0');
  const agora = Date.now();
  if (agora - ultimo < INTERVALO_MS) return;
  try {
    const json = await exportarJSON();
    baixar(`dumbfood-backup-auto-${new Date(agora).toISOString().slice(0, 10)}.json`, json);
    localStorage.setItem(CHAVE_ULTIMO, String(agora));
  } catch {
    // Falhou uma vez: tenta de novo na próxima abertura, sem incomodar o usuário agora.
  }
}
