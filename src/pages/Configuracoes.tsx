import { useRef } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, BellAlertIcon, CubeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { exportarJSON, importarJSON } from '../db/repo';
import { useLembreteValidade } from '../lib/lembretes';
import { useArredondarEmbalagem, useDescontarGeladeira } from '../lib/preferencias';
import {
  cancelarLembretesValidade,
  notificacoesNativasDisponiveis,
  pedirPermissaoNotificacoes,
} from '../lib/notifications';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';

export default function Configuracoes() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lembreteValidade, setLembreteValidade] = useLembreteValidade();
  const [descontarGeladeira, setDescontarGeladeira] = useDescontarGeladeira();
  const [arredondarEmbalagem, setArredondarEmbalagem] = useArredondarEmbalagem();

  async function alternarLembreteValidade(ligar: boolean) {
    if (ligar && notificacoesNativasDisponiveis()) {
      const concedida = await pedirPermissaoNotificacoes();
      if (!concedida) {
        toast('Permissão de notificação negada.', 'erro');
        return;
      }
    }
    if (!ligar) await cancelarLembretesValidade();
    setLembreteValidade(ligar);
    hapticLeve();
  }

  async function baixarBackup() {
    const json = await exportarJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dumbfood-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restaurarBackup(file: File) {
    const texto = await file.text();
    try {
      const { recipes: n } = await importarJSON(texto);
      toast(`Backup importado: ${n} receita(s).`);
    } catch (e) {
      toast(`Erro ao importar: ${(e as Error).message}`, 'erro');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Configurações</h2>

      <div className="card space-y-3 p-4">
        <h3 className="section-heading text-sm">Backup</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={baixarBackup} className="btn-outline">
            <ArrowDownTrayIcon className="size-4" /> Exportar
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-outline">
            <ArrowUpTrayIcon className="size-4" /> Importar backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && restaurarBackup(e.target.files[0])}
          />
        </div>
      </div>

      <div className="card space-y-3 p-3 text-sm">
        <h3 className="section-heading text-sm">Lista de mercado</h3>
        <label className="flex items-center gap-3">
          <CubeIcon className="size-5 flex-shrink-0 text-brand-500" />
          <span className="flex-1">
            <span className="block font-medium">Descontar o que já tenho</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              Itens que estão na geladeira saem da lista e das somas.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 flex-shrink-0 accent-brand-500"
            checked={descontarGeladeira}
            onChange={(e) => {
              setDescontarGeladeira(e.target.checked);
              hapticLeve();
            }}
          />
        </label>
        <label className="flex items-center gap-3">
          <ShoppingCartIcon className="size-5 flex-shrink-0 text-brand-500" />
          <span className="flex-1">
            <span className="block font-medium">Arredondar para embalagens</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              Mostra o que dá pra comprar de fato (1 kg em vez de 700 g) e quanto sobra.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 flex-shrink-0 accent-brand-500"
            checked={arredondarEmbalagem}
            onChange={(e) => {
              setArredondarEmbalagem(e.target.checked);
              hapticLeve();
            }}
          />
        </label>
      </div>

      <label className="card flex items-center gap-3 p-3 text-sm">
        <BellAlertIcon className="size-5 flex-shrink-0 text-brand-500" />
        <span className="flex-1">
          <span className="block font-medium">Avisar quando algo estiver vencendo</span>
          <span className="block text-xs text-stone-500 dark:text-stone-400">
            {notificacoesNativasDisponiveis()
              ? 'Notificação 3 dias antes da validade.'
              : 'Aviso ao abrir o app (sem notificação do sistema no navegador).'}
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 flex-shrink-0 accent-brand-500"
          checked={lembreteValidade}
          onChange={(e) => alternarLembreteValidade(e.target.checked)}
        />
      </label>
    </div>
  );
}
