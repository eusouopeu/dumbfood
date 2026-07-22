import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreatePlanoAtual } from '../db/db';
import { definirNoPlano, removerDoPlano, removerReceita } from '../db/repo';
import { scaleIngredients, fatorParaRendimento, formatQuantidade } from '../lib/scale';
import { formatQtdUnidade } from '../lib/displayQty';
import { unitDefByCanonical } from '../lib/units';
import { capitalizar, rotuloRendimento } from '../lib/format';
import type { YieldType } from '../types';

type Modo = 'rendimento' | 'grama';

export default function Detalhe() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const plano = useLiveQuery(() => getOrCreatePlanoAtual(), []);

  const [modo, setModo] = useState<Modo>('rendimento');
  const [alvoRend, setAlvoRend] = useState<number | null>(null);
  const [tipoRend, setTipoRend] = useState<YieldType | null>(null);
  const [refIngIdx, setRefIngIdx] = useState<number>(-1);
  const [alvoGramas, setAlvoGramas] = useState<number>(0);

  // Ingredientes com unidade de massa, candidatos a âncora do modo "grama".
  const massIngredientes = useMemo(() => {
    if (!recipe) return [] as { idx: number; label: string; baseG: number }[];
    return recipe.ingredientes
      .map((ing, idx) => {
        const def = ing.unidade ? unitDefByCanonical(ing.unidade) : undefined;
        if (def?.dimension === 'massa' && ing.quantidade) {
          return { idx, label: ing.item, baseG: ing.quantidade * def.toBase };
        }
        return null;
      })
      .filter((x): x is { idx: number; label: string; baseG: number } => x !== null);
  }, [recipe]);

  if (recipe === undefined) return <p className="text-stone-500">Carregando…</p>;
  if (recipe === null)
    return (
      <div className="space-y-3">
        <p>Receita não encontrada.</p>
        <Link to="/" className="btn-ghost">
          Voltar
        </Link>
      </div>
    );

  const base = recipe.rendimentoBase;
  const alvo = alvoRend ?? base.valor;
  const tipo = tipoRend ?? base.tipo;

  let fator = 1;
  if (modo === 'rendimento') {
    fator = fatorParaRendimento(base, alvo);
  } else if (modo === 'grama' && refIngIdx >= 0 && alvoGramas > 0) {
    const ref = massIngredientes.find((m) => m.idx === refIngIdx);
    if (ref && ref.baseG > 0) fator = alvoGramas / ref.baseG;
  }

  const escalados = scaleIngredients(recipe.ingredientes, fator);
  const noPlano = plano?.itens.find((i) => i.recipeId === recipe.id);

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-brand-600">
        ← Receitas
      </Link>

      {recipe.imagem && (
        <img src={recipe.imagem} alt="" className="h-44 w-full rounded-2xl object-cover" />
      )}

      <div>
        <h2 className="text-2xl font-bold">{capitalizar(recipe.titulo)}</h2>
        <p className="text-sm text-stone-500">
          Rende {base.valor} {rotuloRendimento(base.tipo, base.valor)}
          {recipe.fonteUrl && (
            <>
              {' · '}
              <a href={recipe.fonteUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                fonte
              </a>
            </>
          )}
        </p>
      </div>

      {/* Controle de reescala */}
      <div className="card space-y-3 p-4">
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          <button
            onClick={() => setModo('rendimento')}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${modo === 'rendimento' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
          >
            Por porção/pessoa
          </button>
          <button
            onClick={() => setModo('grama')}
            disabled={massIngredientes.length === 0}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold disabled:opacity-40 ${modo === 'grama' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
          >
            Por grama
          </button>
        </div>

        {modo === 'rendimento' ? (
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <button className="btn-outline h-9 w-9 !px-0" onClick={() => setAlvoRend(Math.max(1, alvo - 1))}>
                −
              </button>
              <input
                type="number"
                min={1}
                className="input w-16 text-center"
                value={alvo}
                onChange={(e) => setAlvoRend(Math.max(1, Number(e.target.value)))}
              />
              <button className="btn-outline h-9 w-9 !px-0" onClick={() => setAlvoRend(alvo + 1)}>
                +
              </button>
            </div>
            <select
              className="input flex-1"
              value={tipo}
              onChange={(e) => setTipoRend(e.target.value as YieldType)}
            >
              <option value="porcoes">porções</option>
              <option value="pessoas">pessoas</option>
              <option value="unidades">unidades</option>
            </select>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-stone-500">Ingrediente de referência</label>
              <select
                className="input"
                value={refIngIdx}
                onChange={(e) => setRefIngIdx(Number(e.target.value))}
              >
                <option value={-1}>escolha…</option>
                {massIngredientes.map((m) => (
                  <option key={m.idx} value={m.idx}>
                    {capitalizar(m.label)} ({m.baseG} g)
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-stone-500">Tenho (g)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={alvoGramas || ''}
                onChange={(e) => setAlvoGramas(Number(e.target.value))}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-stone-500">Fator aplicado: {formatQuantidade(fator)}×</p>
      </div>

      {/* Ingredientes escalados */}
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Ingredientes</h3>
        <ul className="space-y-1.5">
          {escalados.map((ing, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-[64px] font-semibold text-brand-700">
                {formatQtdUnidade(ing.quantidade, ing.unidade)}
              </span>
              <span>{capitalizar(ing.item)}</span>
            </li>
          ))}
        </ul>
      </div>

      {recipe.modoPreparo.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Modo de preparo</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {recipe.modoPreparo.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {noPlano ? (
          <button onClick={() => removerDoPlano(recipe.id)} className="btn-outline">
            ✓ Na semana (remover)
          </button>
        ) : (
          <button onClick={() => definirNoPlano(recipe.id, fator)} className="btn-primary">
            + Adicionar à semana
          </button>
        )}
        {noPlano && (
          <button onClick={() => definirNoPlano(recipe.id, fator)} className="btn-ghost">
            Atualizar quantidade na semana
          </button>
        )}
        <button
          onClick={async () => {
            if (confirm('Excluir esta receita?')) {
              await removerReceita(recipe.id);
              navigate('/');
            }
          }}
          className="btn-outline ml-auto text-red-600"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
