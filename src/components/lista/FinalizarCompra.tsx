// Fechamento da compra: resumo do que foi marcado, valor real pago e em qual mercado.

import { useState } from 'react';
import { formatBRL } from '../../lib/prices';

export default function FinalizarCompra({
  total,
  marcados,
  pesoTotal,
  valorEstimado,
  mercadosConhecidos,
  onSalvar,
}: {
  total: number;
  marcados: number;
  pesoTotal: number;
  valorEstimado: number;
  mercadosConhecidos: string[];
  onSalvar: (valorReal: number | null, mercado: string) => void;
}) {
  const [valorReal, setValorReal] = useState('');
  const [mercado, setMercado] = useState('');

  function salvar() {
    const informado = Number(valorReal.replace(',', '.'));
    onSalvar(Number.isFinite(informado) && informado > 0 ? informado : null, mercado.trim());
    setValorReal('');
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <p className="text-lg font-bold">{total}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">ingredientes</p>
        </div>
        <div>
          <p className="text-lg font-bold">{pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">peso total</p>
        </div>
        <div>
          <p className="text-lg font-bold">{formatBRL(valorEstimado)}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">valor estimado</p>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-stone-500 dark:text-stone-400" htmlFor="valor-real">
            Valor real da compra (R$)
          </label>
          <input
            id="valor-real"
            type="text"
            inputMode="decimal"
            className="input"
            placeholder={valorEstimado.toFixed(2)}
            value={valorReal}
            onChange={(e) => setValorReal(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-stone-500 dark:text-stone-400" htmlFor="mercado">
            Mercado
          </label>
          <input
            id="mercado"
            type="text"
            className="input"
            list="mercados-conhecidos"
            placeholder="onde você comprou"
            value={mercado}
            onChange={(e) => setMercado(e.target.value)}
          />
          <datalist id="mercados-conhecidos">
            {mercadosConhecidos.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>
      <button onClick={salvar} className="btn-primary w-full">
        Salvar no histórico
      </button>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        Considera apenas os itens marcados na checklist ({marcados} de {total}). Valores em
        itálico são estimativas do app; use “Atualizar preços” para valer os da sua nota fiscal.
      </p>
    </div>
  );
}
