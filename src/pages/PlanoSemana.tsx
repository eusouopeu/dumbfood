import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { definirNoPlano, removerDoPlano, limparPlano } from '../db/repo';
import { round } from '../lib/scale';
import { scaleIngredients } from '../lib/scale';
import { capitalizar, rotuloRendimento } from '../lib/format';
import { calcularNutricaoTotal } from '../lib/nutrition';
import { useDieta, DIETAS } from '../lib/diet';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import type { Ingredient } from '../types';

export default function PlanoSemana() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const plano = usePlano();
  const [dieta, setDieta] = useDieta();

  const nutriTotal = useMemo(() => {
    if (!recipes) return calcularNutricaoTotal([]);
    const porId = new Map(recipes.map((r) => [r.id, r]));
    const todos: Ingredient[] = plano.itens.flatMap((item) => {
      const r = porId.get(item.recipeId);
      return r ? scaleIngredients(r.ingredientes, item.fator) : [];
    });
    return calcularNutricaoTotal(todos);
  }, [recipes, plano]);

  if (!recipes) return <p className="text-stone-500">Carregando…</p>;

  const fatorDe = (id: string) => plano.itens.find((i) => i.recipeId === id)?.fator;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Semana</h2>
        <span className="chip">{plano.itens.length} selecionada(s)</span>
      </div>
      <p className="text-sm text-stone-500">
        Marque as receitas da semana e ajuste a quantidade. Depois gere a lista de mercado.
      </p>

      {plano.itens.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="section-heading text-sm">Macros do plano</h3>
            <SeletorDieta dieta={dieta} onChange={setDieta} />
          </div>
          <MacroResumoCard titulo="" real={nutriTotal} ideal={DIETAS[dieta]} />
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="card p-6 text-center text-stone-500">
          Nenhuma receita.{' '}
          <Link to="/importar" className="text-brand-600 underline">
            Importe uma
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => {
            const fator = fatorDe(r.id);
            const ativo = fator !== undefined;
            return (
              <li key={r.id} className={`card p-3 ${ativo ? 'ring-2 ring-brand-300' : ''}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-500"
                    checked={ativo}
                    onChange={(e) =>
                      e.target.checked ? definirNoPlano(r.id, 1) : removerDoPlano(r.id)
                    }
                  />
                  <Link to={`/receita/${r.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{capitalizar(r.titulo)}</p>
                    <p className="text-xs text-stone-500">
                      base: {r.rendimentoBase.valor}{' '}
                      {rotuloRendimento(r.rendimentoBase.tipo, r.rendimentoBase.valor)}
                    </p>
                  </Link>
                </div>

                {ativo && (
                  <div className="mt-2 flex items-center gap-2 pl-8">
                    <span className="text-xs text-stone-500">fazer para:</span>
                    {(() => {
                      const alvo = Math.max(1, Math.round(r.rendimentoBase.valor * (fator ?? 1)));
                      const setAlvo = (v: number) => {
                        const n = Math.max(1, v);
                        definirNoPlano(r.id, round(n / r.rendimentoBase.valor));
                      };
                      return (
                        <>
                          <button
                            className="btn-outline h-7 w-7 !px-0 text-xs"
                            onClick={() => setAlvo(alvo - 1)}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="input w-14 py-1 text-center text-sm"
                            value={alvo}
                            onChange={(e) => setAlvo(Number(e.target.value))}
                          />
                          <button
                            className="btn-outline h-7 w-7 !px-0 text-xs"
                            onClick={() => setAlvo(alvo + 1)}
                          >
                            +
                          </button>
                          <span className="text-xs text-stone-500">
                            {rotuloRendimento(r.rendimentoBase.tipo, alvo)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Link to="/lista" className="btn-primary flex-1">
          🛒 Gerar lista de mercado
        </Link>
        {plano.itens.length > 0 && (
          <button onClick={() => limparPlano()} className="btn-outline">
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
