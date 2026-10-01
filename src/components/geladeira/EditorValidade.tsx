// Folha para definir (ou remover) a validade de um item da despensa.

import { useState } from 'react';
import { nomeItem } from '../../lib/format';
import type { GeladeiraItem } from '../../types';

export default function EditorValidade({
  item,
  onSalvar,
  onFechar,
}: {
  item: GeladeiraItem;
  onSalvar: (valor: string) => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(() => (item.validade ? new Date(item.validade).toISOString().slice(0, 10) : ''));

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="w-full max-w-2xl space-y-3 rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">Validade de {nomeItem(item.nome)}</p>
        <input
          type="date"
          className="input w-full"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => onSalvar(valor)} className="btn-primary flex-1">
            Salvar
          </button>
          {item.validade && (
            <button onClick={() => onSalvar('')} className="btn-outline">
              Remover validade
            </button>
          )}
          <button onClick={onFechar} className="btn-outline">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

