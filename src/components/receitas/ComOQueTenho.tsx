// "O que dá pra fazer com o que eu tenho": as receitas mais cobertas pela geladeira,
// com o que ainda falta comprar. Responde à pergunta que abre a geladeira antes de abrir
// o app — e coloca na frente a receita que aproveita o que está prestes a vencer.

import { Link } from 'react-router-dom';
import { CubeIcon } from '@heroicons/react/24/outline';
import { capitalizar, nomeItem } from '../../lib/format';
import type { ReceitaPorCobertura } from '../../lib/geladeira';

export default function ComOQueTenho({ receitas }: { receitas: ReceitaPorCobertura[] }) {
  if (receitas.length === 0) return null;

  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center gap-2">
        <CubeIcon className="size-4 text-brand-500" />
        <h3 className="section-heading text-sm">Com o que você tem</h3>
      </div>
      <ul className="space-y-2">
        {receitas.map(({ recipe, tem, total, cobertura, falta, vencendo }) => (
          <li key={recipe.id}>
            <Link to={`/receita/${recipe.id}`} className="block">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{capitalizar(recipe.titulo)}</span>
                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-brand-600 dark:text-brand-400">
                  {Math.round(cobertura * 100)}%
                </span>
              </div>
              {/* Barra de cobertura: dá para varrer a lista com o olho sem ler número. */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
                <div
                  className={`h-full rounded-full ${cobertura >= 1 ? 'bg-green-500' : 'bg-brand-500'}`}
                  style={{ width: `${Math.round(cobertura * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                {tem.length} de {total} ingredientes em casa
                {falta.length > 0 && ` · falta ${falta.slice(0, 3).map((f) => nomeItem(f.item)).join(', ')}`}
                {falta.length > 3 && ` e mais ${falta.length - 3}`}
              </p>
              {vencendo.length > 0 && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  aproveita {vencendo.map((g) => nomeItem(g.nome)).join(', ')} antes de vencer
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
