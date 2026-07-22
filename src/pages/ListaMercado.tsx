import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { buildShoppingList } from '../lib/shoppingList';
import { capitalizar } from '../lib/format';
import type { Recipe } from '../types';

const CHECK_KEY = 'dumbfood:comprados';

function loadChecked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export default function ListaMercado() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const plano = usePlano();
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked());

  useEffect(() => {
    localStorage.setItem(CHECK_KEY, JSON.stringify(Array.from(checked)));
  }, [checked]);

  const sections = useMemo(() => {
    if (!recipes) return [];
    const map = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
    return buildShoppingList(plano, map);
  }, [recipes, plano]);

  if (!recipes) return <p className="text-stone-500">Carregando…</p>;

  const total = sections.reduce((n, s) => n + s.linhas.length, 0);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function copiar() {
    const texto = sections
      .map(
        (s) =>
          `## ${s.gondola}\n` +
          s.linhas.map((l) => `- ${l.rotulo} ${capitalizar(l.item)}`).join('\n'),
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(texto);
      alert('Lista copiada!');
    } catch {
      alert('Não foi possível copiar.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Lista de mercado</h2>
        <span className="chip">{total} itens</span>
      </div>

      {plano.itens.length === 0 || total === 0 ? (
        <div className="card p-6 text-center text-stone-500">
          Nenhuma receita na semana.{' '}
          <Link to="/plano" className="text-brand-600 underline">
            Selecionar receitas
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={copiar} className="btn-outline">
              ⧉ Copiar
            </button>
            {checked.size > 0 && (
              <button onClick={() => setChecked(new Set())} className="btn-outline">
                Desmarcar tudo
              </button>
            )}
          </div>

          {sections.map((s) => (
            <div key={s.gondola} className="card overflow-hidden">
              <div className="bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700">{s.gondola}</div>
              <ul>
                {s.linhas.map((l) => {
                  const key = `${s.gondola}:${l.item}`;
                  const isChecked = checked.has(key);
                  return (
                    <li key={key} className="flex items-center gap-3 border-t border-stone-100 px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-brand-500"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                      />
                      <div className={`min-w-0 flex-1 ${isChecked ? 'text-stone-400 line-through' : ''}`}>
                        <span className="font-semibold">{l.rotulo}</span>{' '}
                        <span>{capitalizar(l.item)}</span>
                        {l.origens.length > 1 && (
                          <span className="ml-1 text-xs text-stone-400">({l.origens.length} receitas)</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
