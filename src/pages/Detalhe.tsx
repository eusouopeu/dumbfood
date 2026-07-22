import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import {
  definirNoPlano,
  removerDoPlano,
  removerReceita,
  redefinirRendimentoPadrao,
  definirTags,
  adicionarTags,
} from '../db/repo';
import { scaleIngredients, fatorParaRendimento, formatQuantidade } from '../lib/scale';
import { formatQtdUnidadeAbrev } from '../lib/displayQty';
import { padronizarMedida, type MedidaModo } from '../lib/measures';
import { detectPreheat } from '../lib/preheat';
import { unitDefByCanonical } from '../lib/units';
import { capitalizar, rotuloRendimento, formatTempo } from '../lib/format';
import type { YieldType } from '../types';

type Modo = 'rendimento' | 'grama';

export default function Detalhe() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const plano = usePlano();

  const [modo, setModo] = useState<Modo>('rendimento');
  const [alvoRend, setAlvoRend] = useState<number | null>(null);
  const [tipoRend, setTipoRend] = useState<YieldType | null>(null);
  const [refIngIdx, setRefIngIdx] = useState<number>(-1);
  const [alvoGramas, setAlvoGramas] = useState<number>(0);
  const [medidaModo, setMedidaModo] = useState<MedidaModo>('original');
  const [novaTag, setNovaTag] = useState('');

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

  const preheat = useMemo(() => (recipe ? detectPreheat(recipe.modoPreparo) : null), [recipe]);

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
  const noPlano = plano.itens.find((i) => i.recipeId === recipe.id);
  const tempo = formatTempo(recipe.tempoPreparoMin);

  async function salvarComoPadrao() {
    if (!recipe) return;
    await redefinirRendimentoPadrao(recipe, alvo, tipo);
    setAlvoRend(null);
    setTipoRend(null);
    setModo('rendimento');
  }

  async function addTag() {
    const t = novaTag.trim();
    if (!recipe || !t) return;
    await adicionarTags(recipe, [t]);
    setNovaTag('');
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-brand-600">
        ← Receitas
      </Link>

      {recipe.imagem && <img src={recipe.imagem} alt="" className="h-44 w-full rounded-2xl object-cover" />}

      <div>
        <h2 className="text-2xl font-bold">{capitalizar(recipe.titulo)}</h2>
        <p className="text-sm text-stone-500">
          Rende {base.valor} {rotuloRendimento(base.tipo, base.valor)}
          {tempo ? ` · ${tempo}` : ''}
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

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {recipe.tags.map((t) => (
          <span key={t} className="chip gap-1 bg-brand-100 text-brand-700">
            {t}
            <button
              onClick={() => definirTags(recipe, recipe.tags.filter((x) => x !== t))}
              className="text-brand-500 hover:text-brand-700"
              aria-label={`remover ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="input h-7 w-28 py-0 text-xs"
          placeholder="+ tag"
          value={novaTag}
          onChange={(e) => setNovaTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
        />
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
            <select className="input flex-1" value={tipo} onChange={(e) => setTipoRend(e.target.value as YieldType)}>
              <option value="porcoes">porções</option>
              <option value="pessoas">pessoas</option>
              <option value="unidades">unidades</option>
            </select>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-stone-500">Ingrediente de referência</label>
              <select className="input" value={refIngIdx} onChange={(e) => setRefIngIdx(Number(e.target.value))}>
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
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500">Fator aplicado: {formatQuantidade(fator)}×</p>
          {Math.abs(fator - 1) > 0.001 && (
            <button onClick={salvarComoPadrao} className="btn-ghost h-7 py-0 text-xs">
              Salvar como padrão
            </button>
          )}
        </div>
      </div>

      {/* Passo de pré-aquecimento em destaque */}
      {preheat && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-100 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <h3 className="font-bold">Faça antes de começar: pré-aqueça o forno</h3>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {preheat.temperatura && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-sm font-bold">{preheat.temperatura}</span>
            )}
            {preheat.duracao && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-sm font-bold">{preheat.duracao}</span>
            )}
          </div>
          <p className="mt-2 text-sm">{preheat.texto}</p>
        </div>
      )}

      {/* Ingredientes escalados */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Ingredientes</h3>
          <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs">
            {(['original', 'metrico', 'recipiente'] as MedidaModo[]).map((m) => (
              <button
                key={m}
                onClick={() => setMedidaModo(m)}
                className={`rounded-md px-2 py-1 font-semibold ${medidaModo === m ? 'bg-white shadow-sm' : 'text-stone-500'}`}
              >
                {m === 'original' ? 'Original' : m === 'metrico' ? 'g / L' : 'Recip.'}
              </button>
            ))}
          </div>
        </div>
        <ul className="space-y-1.5">
          {escalados.map((ing, i) => {
            const med = padronizarMedida(ing.item, ing.quantidade, ing.unidade, medidaModo);
            return (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="w-24 flex-shrink-0 text-right font-semibold tabular-nums text-brand-700">
                  {formatQtdUnidadeAbrev(med.quantidade, med.unidade)}
                </span>
                <span>{capitalizar(ing.item)}</span>
              </li>
            );
          })}
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
