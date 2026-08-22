// Quanto a lista atual sairia em cada mercado já registrado no histórico.

import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { formatBRL } from '../../lib/prices';
import type { compararMercados } from '../../lib/mercados';

export default function ComparativoMercados({ comparacao }: { comparacao: ReturnType<typeof compararMercados> }) {
  if (comparacao.length === 0) return null;
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center gap-2">
        <BuildingStorefrontIcon className="size-4 text-brand-500" />
        <h3 className="section-heading text-sm">Quanto sairia em cada mercado</h3>
      </div>
      <ul className="space-y-1.5">
        {comparacao.map((c, i) => (
          <li key={c.mercado} className="flex items-baseline gap-2 text-sm">
            <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'font-semibold' : ''}`}>{c.mercado}</span>
            <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
              {c.itensCobertos}/{c.itensTotal} itens
            </span>
            <span className={`flex-shrink-0 tabular-nums ${i === 0 ? 'font-bold text-brand-700 dark:text-brand-300' : ''}`}>
              {formatBRL(c.total)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        A partir do último preço pago em cada mercado. Cada um cobre um conjunto diferente de
        itens — compare também a coluna de cobertura, não só o total.
      </p>
    </div>
  );
}
