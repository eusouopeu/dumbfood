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
import { formatQtdUnidadeAbrev, formatDecimal } from '../lib/displayQty';
import { padronizarMedida, type MedidaModo } from '../lib/measures';
import { detectPreheat } from '../lib/preheat';
import { unitDefByCanonical } from '../lib/units';
import { capitalizar, rotuloRendimento, formatTempo } from '../lib/format';
import { calcularNutricaoTotal, dividirPorPorcoes, percentualVD } from '../lib/nutrition';
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
  // Padrão em g/L assim que a receita é aberta/importada; o usuário pode trocar para original/recipiente.
  const [medidaModo, setMedidaModo] = useState<MedidaModo>('metrico');
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
  const porcoesAtuais = Math.max(1, Math.round(base.valor * fator));
  const nutriPorcao = dividirPorPorcoes(calcularNutricaoTotal(escalados), porcoesAtuais);

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
        <h2 className="text-2xl font-bold leading-snug">{capitalizar(recipe.titulo)}</h2>
        <p className="mt-1 text-sm text-stone-500">
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

      {/* Ingredientes escalados */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="section-heading">Ingredientes</h3>
          <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs">
            {(['metrico', 'original', 'recipiente'] as MedidaModo[]).map((m) => (
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
        <ul className="space-y-3.5">
          {escalados.map((ing, i) => {
            const med = padronizarMedida(ing.item, ing.quantidade, ing.unidade, medidaModo);
            return (
              <li key={i} className="flex items-baseline gap-3 text-base leading-relaxed">
                <span className="w-24 flex-shrink-0 text-right font-semibold tabular-nums text-brand-700">
                  {formatQtdUnidadeAbrev(med.quantidade, med.unidade)}
                </span>
                <span>{capitalizar(ing.item)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Faça antes de começar: passo de pré-aquecimento, resumido (sem emoji nem citação da etapa) */}
      {preheat && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-100 p-3 text-amber-900 shadow-sm">
          <p className="text-sm font-bold">
            Antes de começar: pré-aqueça o forno
            {preheat.temperatura && (
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs">{preheat.temperatura}</span>
            )}
            {preheat.duracao && (
              <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs">{preheat.duracao}</span>
            )}
          </p>
        </div>
      )}

      {recipe.modoPreparo.length > 0 && (
        <div className="card p-4">
          <h3 className="section-heading mb-4">Modo de preparo</h3>
          <ol className="space-y-5">
            {recipe.modoPreparo.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 font-extrabold text-brand-600">{i + 1}.</span>
                <span className="text-base leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tabela nutricional estimada, a partir de ingredientes-chave */}
      {escalados.length > 0 && (
        <div className="card p-4">
          <h3 className="section-heading">Tabela nutricional</h3>
          <p className="mb-3 mt-1 text-xs text-stone-500">
            Por porção ({porcoesAtuais} {rotuloRendimento(tipo, porcoesAtuais)}) · %VD com base em uma dieta de 2.000
            kcal. Estimativa a partir de ingredientes-chave; temperos e itens sem quantidade definida não entram no
            cálculo.
          </p>
          <table className="w-full text-sm">
            <tbody>
              <NutriLinha label="Valor energético" valor={`${formatDecimal(nutriPorcao.kcal)} kcal`} vd={percentualVD('kcal', nutriPorcao.kcal)} />
              <NutriLinha label="Carboidratos" valor={`${formatDecimal(nutriPorcao.carboidrato)} g`} vd={percentualVD('carboidrato', nutriPorcao.carboidrato)} />
              <NutriLinha label="dos quais açúcares" valor={`${formatDecimal(nutriPorcao.acucares)} g`} indent />
              <NutriLinha label="Proteínas" valor={`${formatDecimal(nutriPorcao.proteina)} g`} vd={percentualVD('proteina', nutriPorcao.proteina)} />
              <NutriLinha label="Gorduras totais" valor={`${formatDecimal(nutriPorcao.gorduraTotal)} g`} vd={percentualVD('gorduraTotal', nutriPorcao.gorduraTotal)} />
              <NutriLinha label="saturadas" valor={`${formatDecimal(nutriPorcao.gorduraSaturada)} g`} vd={percentualVD('gorduraSaturada', nutriPorcao.gorduraSaturada)} indent />
              <NutriLinha label="insaturadas" valor={`${formatDecimal(Math.max(0, nutriPorcao.gorduraTotal - nutriPorcao.gorduraSaturada))} g`} indent />
              <NutriLinha label="Colesterol" valor={`${formatDecimal(nutriPorcao.colesterolMg)} mg`} vd={percentualVD('colesterolMg', nutriPorcao.colesterolMg)} />
              <NutriLinha label="Fibra alimentar" valor={`${formatDecimal(nutriPorcao.fibra)} g`} vd={percentualVD('fibra', nutriPorcao.fibra)} last />
            </tbody>
          </table>
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

function NutriLinha({
  label,
  valor,
  vd,
  indent,
  last,
}: {
  label: string;
  valor: string;
  vd?: number;
  indent?: boolean;
  last?: boolean;
}) {
  return (
    <tr className={last ? '' : 'border-b border-stone-100'}>
      <td className={`py-1.5 ${indent ? 'pl-4 text-stone-500' : 'font-medium'}`}>{label}</td>
      <td className="py-1.5 text-right tabular-nums">{valor}</td>
      <td className="w-16 py-1.5 text-right text-xs tabular-nums text-stone-500">
        {vd !== undefined ? `${formatDecimal(vd)}% VD` : ''}
      </td>
    </tr>
  );
}
