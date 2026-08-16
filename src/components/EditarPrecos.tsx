// Edição manual de preços direto no app — mesmo destino de "Escanear nota" (db.precos),
// mas sem precisar de foto nem arquivo: lista os itens da compra atual para o usuário
// preencher o preço por kg/L/unidade que sabe de cabeça ou de memória do mercado.

import { useState } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { importarPrecos } from '../db/repo';
import { buscarPreco } from '../lib/prices';
import { normalizeItemKey } from '../lib/ingredientParser';
import { nomeItem } from '../lib/format';
import { toast } from '../lib/toast';
import type { PrecoItem } from '../types';

interface LinhaPreco {
  item: string;
  itemKey: string;
  precoTexto: string;
  unidade: PrecoItem['unidade'];
}

export default function EditarPrecos({
  itens,
  precos,
  onClose,
}: {
  itens: string[];
  precos: PrecoItem[];
  onClose: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaPreco[]>(() =>
    itens.map((item) => {
      const key = normalizeItemKey(item);
      const atual = buscarPreco(key, precos);
      return {
        item,
        itemKey: key,
        precoTexto: atual && !atual.estimado ? String(atual.precoUnitario).replace('.', ',') : '',
        unidade: atual?.unidade ?? 'kg',
      };
    }),
  );

  function setPreco(idx: number, valor: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, precoTexto: valor } : l)));
  }

  function setUnidade(idx: number, valor: PrecoItem['unidade']) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, unidade: valor } : l)));
  }

  async function salvar() {
    const agora = Date.now();
    const itensValidos: PrecoItem[] = linhas
      .map((l) => ({ ...l, preco: Number(l.precoTexto.replace(',', '.')) }))
      .filter((l) => Number.isFinite(l.preco) && l.preco > 0)
      .map((l) => ({ item: l.item, itemKey: l.itemKey, precoUnitario: l.preco, unidade: l.unidade, atualizadoEm: agora }));
    if (itensValidos.length === 0) {
      toast('Informe ao menos um preço.', 'erro');
      return;
    }
    const n = await importarPrecos(itensValidos);
    toast(`${n} preço(s) atualizado(s).`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-stone-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-700">
        <h3 className="text-lg font-bold">Atualizar preços</h3>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">
          <XMarkIcon className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
          Informe o preço por kg, litro ou unidade de cada item da lista — só o que você preencher é salvo.
        </p>
        <ul className="space-y-2">
          {linhas.map((l, idx) => (
            <li key={l.itemKey} className="flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 p-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{nomeItem(l.item)}</span>
              <div className="flex flex-shrink-0 items-center gap-1">
                <span className="text-xs text-stone-400">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input w-20 py-1.5 text-right text-sm"
                  placeholder="0,00"
                  value={l.precoTexto}
                  onChange={(e) => setPreco(idx, e.target.value)}
                />
              </div>
              <select
                className="input w-20 flex-shrink-0 py-1.5 text-xs"
                value={l.unidade}
                onChange={(e) => setUnidade(idx, e.target.value as PrecoItem['unidade'])}
              >
                <option value="kg">/ kg</option>
                <option value="l">/ L</option>
                <option value="unidade">/ un</option>
              </select>
            </li>
          ))}
        </ul>
        {linhas.length === 0 && (
          <p className="card p-4 text-center text-sm text-stone-500 dark:text-stone-400">Sua lista de mercado está vazia.</p>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="flex-shrink-0 border-t border-stone-100 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-stone-700">
          <button onClick={salvar} className="btn-primary w-full">
            <CheckIcon className="size-4" /> Salvar preços
          </button>
        </div>
      )}
    </div>
  );
}
