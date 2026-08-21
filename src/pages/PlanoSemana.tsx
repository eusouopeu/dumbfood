import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellAlertIcon, BookOpenIcon, CalendarDaysIcon, MinusIcon, PlusIcon, ShoppingCartIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { definirAgendamento, definirNoPlano, removerDoPlano, limparPlano } from '../db/repo';
import { round } from '../lib/scale';
import { scaleIngredients } from '../lib/scale';
import { capitalizar, rotuloRendimento } from '../lib/format';
import { calcularNutricaoTotal } from '../lib/nutrition';
import { useDieta } from '../lib/diet';
import { useLembreteCompras } from '../lib/lembretes';
import { agendarLembreteSemanal, notificacoesNativasDisponiveis, pedirPermissaoNotificacoes } from '../lib/notifications';
import { sugerirReceitasParaPlano } from '../lib/autoPlano';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import { DIAS_CURTOS, DIAS_SEMANA, REFEICOES, agruparPorDia, rotuloRefeicao } from '../lib/agenda';
import type { Ingredient, PlanItem, Refeicao } from '../types';

export default function PlanoSemana() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const plano = usePlano();
  const [dieta, setDieta] = useDieta();
  const [lembreteCompras, setLembreteCompras] = useLembreteCompras();
  const [alvoAuto, setAlvoAuto] = useState(5);

  useEffect(() => {
    if (notificacoesNativasDisponiveis()) agendarLembreteSemanal(lembreteCompras);
  }, [lembreteCompras]);

  async function alternarLembreteCompras(ativo: boolean) {
    if (ativo) {
      const concedida = await pedirPermissaoNotificacoes();
      if (!concedida) {
        toast('Permissão de notificação negada.', 'erro');
        return;
      }
    }
    setLembreteCompras({ ...lembreteCompras, ativo });
    hapticLeve();
  }

  // A agenda começa no dia de hoje: é isso que o usuário quer ver ao abrir a aba.
  const hoje = new Date().getDay();
  const agenda = useMemo(() => {
    const porId = new Map((recipes ?? []).map((r) => [r.id, r]));
    return agruparPorDia(plano.itens, porId, hoje);
  }, [recipes, plano, hoje]);

  const nutriTotal = useMemo(() => {
    if (!recipes) return calcularNutricaoTotal([]);
    const porId = new Map(recipes.map((r) => [r.id, r]));
    const todos: Ingredient[] = plano.itens.flatMap((item) => {
      const r = porId.get(item.recipeId);
      return r ? scaleIngredients(r.ingredientes, item.fator) : [];
    });
    return calcularNutricaoTotal(todos);
  }, [recipes, plano]);

  if (!recipes)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Semana</h2>
        <CardListSkeleton />
      </div>
    );

  const fatorDe = (id: string) => plano.itens.find((i) => i.recipeId === id)?.fator;

  async function alternarNoPlano(id: string, titulo: string, marcado: boolean) {
    hapticLeve();
    if (marcado) {
      await definirNoPlano(id, 1);
      toast(`${capitalizar(titulo)} adicionada à semana!`);
    } else {
      await removerDoPlano(id);
      toast(`${capitalizar(titulo)} removida da semana.`);
    }
  }

  /** Completa o plano até `alvoAuto` receitas: prioriza favoritos e o que a geladeira já cobre. */
  async function montarSemanaAutomaticamente() {
    const jaSelecionadas = new Set(plano.itens.map((i) => i.recipeId));
    const faltam = alvoAuto - jaSelecionadas.size;
    if (faltam <= 0) {
      toast('O plano já tem essa quantidade de receitas ou mais.', 'info');
      return;
    }
    const sugeridas = sugerirReceitasParaPlano(recipes ?? [], geladeira ?? [], jaSelecionadas, faltam);
    if (sugeridas.length === 0) {
      toast('Nenhuma receita nova para sugerir.', 'erro');
      return;
    }
    for (const r of sugeridas) await definirNoPlano(r.id, 1);
    hapticLeve();
    toast(`${sugeridas.length} receita(s) adicionada(s) à semana.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Semana</h2>
        <span className="chip">{plano.itens.length} selecionada(s)</span>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Marque as receitas da semana e ajuste a quantidade. Depois gere a lista de mercado.
      </p>

      {recipes.length > 0 && (
        <div className="card flex flex-nowrap items-center gap-2 p-3">
          <button onClick={montarSemanaAutomaticamente} className="btn-outline flex-shrink-0">
            <SparklesIcon className="size-4" /> Montar semana
          </button>
          <label className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            até
            <input
              type="number"
              min={1}
              max={recipes.length}
              className="input w-14 py-1 text-center text-sm"
              value={alvoAuto}
              onChange={(e) => setAlvoAuto(Math.max(1, Number(e.target.value)))}
            />
            receitas
          </label>
        </div>
      )}

      {notificacoesNativasDisponiveis() && (
        <div className="card space-y-2 p-3 text-sm">
          <label className="flex items-center gap-3">
            <BellAlertIcon className="size-5 flex-shrink-0 text-brand-500" />
            <span className="flex-1 font-medium">Lembrete semanal de compras</span>
            <input
              type="checkbox"
              className="h-5 w-5 flex-shrink-0 accent-brand-500"
              checked={lembreteCompras.ativo}
              onChange={(e) => alternarLembreteCompras(e.target.checked)}
            />
          </label>
          {lembreteCompras.ativo && (
            <div className="flex items-center gap-2 pl-8 text-xs text-stone-500 dark:text-stone-400">
              <select
                className="input py-1 text-xs"
                value={lembreteCompras.diaSemana}
                onChange={(e) => setLembreteCompras({ ...lembreteCompras, diaSemana: Number(e.target.value) })}
              >
                {DIAS_SEMANA.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                className="input py-1 text-xs"
                value={lembreteCompras.hora}
                onChange={(e) => setLembreteCompras({ ...lembreteCompras, hora: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {plano.itens.length > 0 && (
        <div className="card space-y-2 p-4">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-brand-500" />
            <h3 className="section-heading text-sm">Agenda da semana</h3>
            {agenda.semDia.length > 0 && (
              <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
                {agenda.semDia.length} sem dia
              </span>
            )}
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-700">
            {agenda.dias.map(({ dia, itens }) => (
              <li key={dia} className="flex gap-3 py-1.5 text-sm">
                <span
                  className={`w-16 flex-shrink-0 font-semibold ${
                    dia === hoje ? 'text-brand-600 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {DIAS_CURTOS[dia]}
                  {dia === hoje && <span className="ml-1 text-[10px] uppercase">hoje</span>}
                </span>
                {itens.length === 0 ? (
                  <span className="text-stone-300 dark:text-stone-600">—</span>
                ) : (
                  <span className="min-w-0 flex-1 space-y-0.5">
                    {itens.map(({ item, recipe }) => (
                      <span key={recipe.id} className="block truncate">
                        {item.refeicao && (
                          <span className="mr-1 text-xs text-stone-400 dark:text-stone-500">
                            {rotuloRefeicao(item.refeicao)}:
                          </span>
                        )}
                        {capitalizar(recipe.titulo)}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {agenda.semDia.length > 0 && (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Sem dia definido: {agenda.semDia.map(({ recipe }) => capitalizar(recipe.titulo)).join(', ')}.
            </p>
          )}
        </div>
      )}

      {plano.itens.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="section-heading text-sm">Macros do plano</h3>
            <SeletorDieta dieta={dieta} onChange={setDieta} />
          </div>
          <MacroResumoCard titulo="" real={nutriTotal} dieta={dieta} />
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="card p-6 text-center">
          <BookOpenIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
          <p className="font-semibold">Nenhuma receita ainda</p>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Importe receitas para montar o plano da semana.
          </p>
          <Link to="/importar" className="btn-primary">
            Importar receita
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => {
            const fator = fatorDe(r.id);
            const ativo = fator !== undefined;
            return (
              <li
                key={r.id}
                role="checkbox"
                aria-checked={ativo}
                tabIndex={0}
                onClick={() => alternarNoPlano(r.id, r.titulo, !ativo)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    alternarNoPlano(r.id, r.titulo, !ativo);
                  }
                }}
                className={`card cursor-pointer p-3 ${ativo ? 'ring-2 ring-brand-300 dark:ring-brand-700' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="pointer-events-none h-5 w-5 accent-brand-500"
                    checked={ativo}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{capitalizar(r.titulo)}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      base: {r.rendimentoBase.valor}{' '}
                      {rotuloRendimento(r.rendimentoBase.tipo, r.rendimentoBase.valor)}
                    </p>
                  </div>
                </div>

                {ativo && (
                  <div className="mt-2 flex items-center gap-2 pl-8" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-stone-500 dark:text-stone-400">fazer para:</span>
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
                            aria-label={`Diminuir quantidade de ${capitalizar(r.titulo)}`}
                          >
                            <MinusIcon className="mx-auto size-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="input w-14 py-1 text-center text-sm"
                            value={alvo}
                            onChange={(e) => setAlvo(Number(e.target.value))}
                            aria-label={`Quantidade de ${capitalizar(r.titulo)}`}
                          />
                          <button
                            className="btn-outline h-7 w-7 !px-0 text-xs"
                            onClick={() => setAlvo(alvo + 1)}
                            aria-label={`Aumentar quantidade de ${capitalizar(r.titulo)}`}
                          >
                            <PlusIcon className="mx-auto size-3.5" />
                          </button>
                          <span className="text-xs text-stone-500 dark:text-stone-400">
                            {rotuloRendimento(r.rendimentoBase.tipo, alvo)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}

                {ativo && <SeletorAgendamento recipeId={r.id} item={plano.itens.find((i) => i.recipeId === r.id)} />}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Link to="/lista" className="btn-primary flex-1">
          <ShoppingCartIcon className="size-4" /> Gerar lista de mercado
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

/**
 * Dia da semana + refeição de uma receita já no plano. Fica na própria linha da
 * receita para agendar sem sair da tela; "—" desagenda.
 */
function SeletorAgendamento({ recipeId, item }: { recipeId: string; item: PlanItem | undefined }) {
  return (
    <div className="mt-2 flex items-center gap-2 pl-8" onClick={(e) => e.stopPropagation()}>
      <span className="text-xs text-stone-500 dark:text-stone-400">quando:</span>
      <select
        className="input w-28 py-1 text-xs"
        aria-label="Dia da semana"
        value={item?.dia ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          definirAgendamento(recipeId, v === '' ? undefined : Number(v), item?.refeicao);
          hapticLeve();
        }}
      >
        <option value="">— dia</option>
        {DIAS_SEMANA.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
      <select
        className="input w-24 py-1 text-xs"
        aria-label="Refeição"
        value={item?.refeicao ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          definirAgendamento(recipeId, item?.dia, v === '' ? undefined : (v as Refeicao));
          hapticLeve();
        }}
      >
        <option value="">— refeição</option>
        {REFEICOES.map((r) => (
          <option key={r.chave} value={r.chave}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
