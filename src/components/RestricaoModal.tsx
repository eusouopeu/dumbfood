// Modal de ajuste de receita em lote para uma restrição alimentar: escolhe a
// restrição e mostra de uma vez todas as trocas propostas (com opção de desmarcar
// alguma). O ajuste é reversível — troca os ingredientes da própria receita, guardando
// os originais para poder voltar a eles depois, em vez de criar uma cópia nova.

import { useMemo, useState } from 'react';
import { ArrowRightIcon, ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { aplicarRestricao, reverterRestricao } from '../db/repo';
import { RESTRICOES, encontrarTrocas, aplicarTrocas, type Restricao } from '../lib/dietRestrictions';
import { nomeItem } from '../lib/format';
import type { Recipe } from '../types';

export default function RestricaoModal({
  recipe,
  onClose,
  onAplicar,
}: {
  recipe: Recipe;
  onClose: () => void;
  onAplicar: (receita: Recipe) => void;
}) {
  const [restricao, setRestricao] = useState<Restricao | null>(null);
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const jaAjustada = recipe.restricaoAplicada;
  const base = jaAjustada ? (recipe.ingredientesOriginais ?? recipe.ingredientes) : recipe.ingredientes;
  const trocas = useMemo(() => (restricao ? encontrarTrocas(base, restricao) : []), [base, restricao]);
  const trocasAtivas = trocas.filter((t) => !excluidas.has(t.idx));
  const meta = RESTRICOES.find((r) => r.valor === restricao);

  function toggleExcluida(idx: number) {
    setExcluidas((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function aplicar() {
    if (!restricao || !meta || trocasAtivas.length === 0) return;
    setSalvando(true);
    const ajustados = aplicarTrocas(base, trocasAtivas);
    const atualizada = await aplicarRestricao(recipe, ajustados, { tag: meta.tag, label: meta.label });
    setSalvando(false);
    onAplicar(atualizada);
  }

  async function reverter() {
    setSalvando(true);
    const original = await reverterRestricao(recipe);
    setSalvando(false);
    onAplicar(original);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-stone-800 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Ajustar para restrição</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">
            <XMarkIcon className="size-5" />
          </button>
        </div>

        {jaAjustada && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Ajustada para <span className="font-semibold">{jaAjustada.label}</span>.
            </p>
            <button onClick={reverter} disabled={salvando} className="btn-outline flex-shrink-0 text-xs">
              <ArrowUturnLeftIcon className="size-4" /> {salvando ? 'Revertendo…' : 'Reverter'}
            </button>
          </div>
        )}

        {!jaAjustada && (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {RESTRICOES.map((r) => (
                <button
                  key={r.valor}
                  onClick={() => {
                    setRestricao(r.valor);
                    setExcluidas(new Set());
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    restricao === r.valor ? 'bg-brand-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {restricao && trocas.length === 0 && (
              <p className="rounded-xl bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-700 dark:text-green-300">
                Nenhum ingrediente desta receita entra em conflito com "{meta?.label}" — nada pra trocar.
              </p>
            )}

            {restricao && trocas.length > 0 && (
              <>
                <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
                  Desmarque o que não quiser trocar. Dá para reverter depois, a qualquer momento.
                </p>
                <ul className="mb-4 space-y-2">
                  {trocas.map((t) => {
                    const ativa = !excluidas.has(t.idx);
                    return (
                      <li key={t.idx} className="flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-900/40 p-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 flex-shrink-0 accent-brand-500"
                          checked={ativa}
                          onChange={() => toggleExcluida(t.idx)}
                        />
                        <span className={`min-w-0 flex-1 text-sm ${ativa ? '' : 'text-stone-400 line-through dark:text-stone-600'}`}>
                          <span className="font-medium">{nomeItem(t.original.item)}</span>
                          <ArrowRightIcon className="mx-1.5 inline size-3 text-stone-400" />
                          {t.substituto}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button onClick={aplicar} disabled={trocasAtivas.length === 0 || salvando} className="btn-primary w-full">
                  {salvando ? 'Salvando…' : `Ajustar para ${meta?.label.toLowerCase()} (${trocasAtivas.length} troca${trocasAtivas.length === 1 ? '' : 's'})`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
