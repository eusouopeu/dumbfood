// Barra fixa no topo da receita: voltar e as ações (favoritar, restrição, vídeo, dar
// baixa na despensa, semana, excluir). A barra geral do app some nesta tela.

import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  HomeIcon,
  StarIcon as StarOutlineIcon,
  VideoCameraIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { CalendarDaysIcon as CalendarSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { db } from '../../db/db';
import { alternarFavorito, baixarDaGeladeira, definirNoPlano, removerDoPlano, removerReceita } from '../../db/repo';
import { combinarReceita } from '../../lib/geladeira';
import { nomeItem } from '../../lib/format';
import { toast } from '../../lib/toast';
import { confirmar } from '../../lib/confirm';
import { hapticForte, hapticLeve } from '../../lib/haptics';
import type { Recipe } from '../../types';

/** Estilo comum dos botões da barra da receita: todos em laranja, menos o de excluir. */
const ICONE_BARRA =
  'rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800';

export default function BarraReceita({
  recipe,
  noPlano,
  fator,
  onRestricao,
  onVideo,
}: {
  recipe: Recipe;
  noPlano: boolean;
  /** Fator de reescala atual, usado ao adicionar a receita à semana. */
  fator: number;
  onRestricao: () => void;
  onVideo: () => void;
}) {
  const navigate = useNavigate();

  /**
   * Fecha o ciclo geladeira -> receita: os ingredientes que estavam na geladeira e foram
   * usados nesta receita deixam de estar disponíveis. Fica na barra do topo, para registrar
   * a qualquer momento depois de cozinhar.
   */
  async function darBaixaNaGeladeira() {
    const geladeira = await db.geladeira.toArray();
    const { usados } = combinarReceita(recipe, geladeira);
    if (usados.length === 0) {
      toast('Nenhum ingrediente desta receita está na despensa.', 'info');
      return;
    }
    const nomes = geladeira.filter((g) => usados.includes(g.itemKey)).map((g) => nomeItem(g.nome));
    const ok = await confirmar(
      `Dar baixa na despensa dos ingredientes usados? (${nomes.join(', ')})`,
      { textoConfirmar: 'Dar baixa' },
    );
    if (!ok) return;
    const n = await baixarDaGeladeira(usados);
    hapticLeve();
    toast(`${n} ${n === 1 ? 'item removido' : 'itens removidos'} da despensa.`);
  }

  return (
      <div className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-1 border-b border-stone-200 bg-brand-50/90 px-4 py-2.5 backdrop-blur dark:border-stone-700 dark:bg-stone-900/90">
        <Link to="/receitas" className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400">
          <ArrowLeftIcon className="size-4" /> Receitas
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => {
              hapticLeve();
              alternarFavorito(recipe);
            }}
            aria-label={recipe.favorito ? 'Remover dos favoritos' : 'Favoritar receita'}
            title={recipe.favorito ? 'Remover dos favoritos' : 'Favoritar'}
            className={ICONE_BARRA}
          >
            {recipe.favorito ? <StarSolidIcon className="size-6" /> : <StarOutlineIcon className="size-6" />}
          </button>
          <button
            onClick={onRestricao}
            aria-label={recipe.restricaoAplicada ? `Ajustada para ${recipe.restricaoAplicada.label}` : 'Ajustar para restrição alimentar'}
            title={recipe.restricaoAplicada ? `Ajustada para ${recipe.restricaoAplicada.label}` : 'Ajustar para restrição alimentar'}
            className={recipe.restricaoAplicada ? 'rounded-full bg-brand-500 p-1.5 text-white' : ICONE_BARRA}
          >
            <ArrowsRightLeftIcon className="size-6" />
          </button>
          <button
            onClick={onVideo}
            aria-label={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            title={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            className={ICONE_BARRA}
          >
            <VideoCameraIcon className="size-6" />
          </button>
          <button
            onClick={darBaixaNaGeladeira}
            aria-label="Dar baixa na despensa dos ingredientes usados"
            title="Dar baixa na despensa"
            className={ICONE_BARRA}
          >
            <HomeIcon className="size-6" />
          </button>
          {noPlano ? (
            <button
              onClick={async () => {
                await removerDoPlano(recipe.id);
                toast('Removida da semana.');
              }}
              aria-label="Remover da semana"
              title="Remover da semana"
              className={ICONE_BARRA}
            >
              <CalendarSolidIcon className="size-6" />
            </button>
          ) : (
            <button
              onClick={async () => {
                await definirNoPlano(recipe.id, fator);
                toast('Adicionada à semana!');
              }}
              aria-label="Adicionar à semana"
              title="Adicionar à semana"
              className={ICONE_BARRA}
            >
              <CalendarDaysIcon className="size-6" />
            </button>
          )}
          <button
            onClick={async () => {
              const ok = await confirmar('Excluir esta receita? Essa ação não pode ser desfeita.', {
                textoConfirmar: 'Excluir',
                perigo: true,
              });
              if (ok) {
                await removerReceita(recipe.id);
                hapticForte();
                toast('Receita excluída.');
                navigate('/receitas');
              }
            }}
            aria-label="Excluir receita"
            title="Excluir receita"
            className="rounded-full p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-stone-800"
          >
            <XCircleIcon className="size-6" />
          </button>
        </div>
      </div>
  );
}
