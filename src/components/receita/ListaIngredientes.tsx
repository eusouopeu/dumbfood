// Lista de ingredientes da receita, já reescalada, com a troca de ingrediente na hora
// do preparo: acabou o leite, o botão ao lado do item sugere o que usar no lugar.
//
// A troca vale só para esta visita à receita (não reescreve a receita salva) e vale para
// tudo que deriva dos ingredientes — a tabela nutricional e o custo se refazem sozinhos,
// porque a tela calcula ambos a partir da mesma lista já trocada.

import { useState } from 'react';
import { ArrowsRightLeftIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { nomeItem } from '../../lib/format';
import { formatQtdUnidadeAbrev } from '../../lib/displayQty';
import { padronizarMedida, type MedidaModo } from '../../lib/measures';
import { sugerirSubstitutosParaItem } from '../../lib/substitutions';
import type { Ingredient } from '../../types';

export default function ListaIngredientes({
  ingredientes,
  medidaModo,
  tamanhoFonte,
  trocas,
  onTrocar,
}: {
  /** Ingredientes já reescalados e com as trocas aplicadas. */
  ingredientes: Ingredient[];
  medidaModo: MedidaModo;
  tamanhoFonte: number;
  /** Índice do ingrediente -> nome escolhido no lugar do original. */
  trocas: Record<number, string>;
  onTrocar: (indice: number, substituto: string | null) => void;
}) {
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <ul className="space-y-3.5">
      {ingredientes.map((ing, i) => {
        const med = padronizarMedida(ing.item, ing.quantidade, ing.unidade, medidaModo);
        const trocado = trocas[i] !== undefined;
        // Quando já houve troca, as opções continuam sendo as do ingrediente original.
        const substitutos = sugerirSubstitutosParaItem(trocado ? trocas[i] : ing.item);
        const podeTrocar = substitutos.length > 0 || trocado;

        return (
          <li key={i} style={{ fontSize: tamanhoFonte }}>
            <div className="flex items-baseline gap-3 leading-relaxed">
              <span className="w-24 flex-shrink-0 text-right font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                {formatQtdUnidadeAbrev(med.quantidade, med.unidade)}
              </span>
              <span className={`min-w-0 flex-1 ${trocado ? 'text-brand-700 dark:text-brand-300' : ''}`}>
                {nomeItem(ing.item)}
                {trocado && <span className="ml-1 text-xs font-medium">(trocado)</span>}
              </span>
              {podeTrocar && (
                <button
                  onClick={() => setAberto((a) => (a === i ? null : i))}
                  aria-label={`Substituir ${nomeItem(ing.item)}`}
                  aria-expanded={aberto === i}
                  title="Substituir"
                  className="flex-shrink-0 rounded-full p-1 text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-700"
                >
                  <ArrowsRightLeftIcon className="size-4" />
                </button>
              )}
            </div>

            {aberto === i && (
              <div className="ml-[6.75rem] mt-1.5 flex flex-wrap gap-1.5">
                {substitutos.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onTrocar(i, s);
                      setAberto(null);
                    }}
                    className="chip bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300"
                  >
                    {nomeItem(s)}
                  </button>
                ))}
                {trocado && (
                  <button
                    onClick={() => {
                      onTrocar(i, null);
                      setAberto(null);
                    }}
                    className="chip gap-1"
                  >
                    <ArrowUturnLeftIcon className="size-3" /> voltar ao original
                  </button>
                )}
                {substitutos.length === 0 && !trocado && (
                  <span className="text-xs text-stone-400 dark:text-stone-500">Sem substituto conhecido.</span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
