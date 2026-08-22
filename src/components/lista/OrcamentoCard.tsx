// Teto de gasto da semana e o quanto a lista atual já consome dele.

import { useState } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useOrcamento, statusOrcamento } from '../../lib/orcamento';
import { formatBRL } from '../../lib/prices';
import { toast } from '../../lib/toast';

export default function OrcamentoCard({ valorEstimado }: { valorEstimado: number }) {
  const [orcamento, setOrcamento] = useOrcamento();
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);
  const status = orcamento !== null ? statusOrcamento(valorEstimado, orcamento) : null;

  function definir() {
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      toast('Informe um valor válido.', 'erro');
      return;
    }
    setOrcamento(n);
    setTexto('');
    setEditando(false);
  }

  return (
    <div className="card space-y-2 p-4">
      <div className="relative pr-8">
        <h3 className="section-heading text-sm">Orçamento da semana</h3>
        {orcamento !== null && !editando && (
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-1">
            <button
              onClick={() => {
                setTexto(String(orcamento));
                setEditando(true);
              }}
              aria-label="Editar orçamento"
              className="rounded-full p-1 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-stone-800"
            >
              <PencilIcon className="size-4" />
            </button>
            <button
              onClick={() => setOrcamento(null)}
              aria-label="Remover orçamento"
              className="rounded-full p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-stone-800"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {orcamento === null || editando ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            definir();
          }}
        >
          <input
            type="text"
            inputMode="decimal"
            className="input"
            placeholder="Ex.: 250 (R$)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus={editando}
          />
          <button type="submit" className="btn-outline flex-shrink-0">
            Definir
          </button>
        </form>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            <div
              className="h-full bg-brand-500"
              style={{ width: `${Math.min(100, Math.round((valorEstimado / orcamento) * 100))}%` }}
            />
          </div>
          <p
            className={`text-sm ${
              status === 'estourado'
                ? 'font-semibold text-red-600 dark:text-red-400'
                : status === 'perto'
                  ? 'font-semibold text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {formatBRL(valorEstimado)} de {formatBRL(orcamento)} ({Math.round((valorEstimado / orcamento) * 100)}%)
            {status === 'estourado' && ' — orçamento estourado'}
            {status === 'perto' && ' — perto do limite'}
          </p>
        </>
      )}
    </div>
  );
}
