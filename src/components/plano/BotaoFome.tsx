// "Estou com fome": um toque grava o horário (lib/fome.ts). Fica na barra flutuante do dia,
// ao lado de "inserir refeição…", porque a fome aparece justamente antes de comer — e o
// atalho do ícone (dumbfood://fome → /?fome=1) grava sem nem abrir a tela.

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClockIcon } from '@heroicons/react/24/outline';
import { registrarFome, removerFome } from '../../db/repo';
import { rotuloMinuto } from '../../lib/fome';
import { toast } from '../../lib/toast';
import { hapticLeve } from '../../lib/haptics';

async function gravar() {
  const f = await registrarFome();
  hapticLeve();
  const d = new Date(f.hora);
  toast(`Fome às ${rotuloMinuto(d.getHours() * 60 + d.getMinutes())} anotada.`, 'sucesso', {
    rotulo: 'Desfazer',
    onClick: () => removerFome(f.id),
  });
}

export default function BotaoFome() {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!params.has('fome')) return;
    setParams({}, { replace: true });
    void gravar();
  }, [params, setParams]);

  return (
    <button
      type="button"
      onClick={gravar}
      aria-label="Estou com fome"
      title="Estou com fome"
      className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-stone-700 dark:text-stone-200"
    >
      <ClockIcon className="size-5" />
    </button>
  );
}
