import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowPathIcon,
  BellAlertIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import {
  adicionarAgendamento,
  definirNoPlano,
  removerAgendamento,
  removerDoPlano,
  limparPlano,
  planoAnteriorDisponivel,
  repetirPlanoAnterior,
} from '../db/repo';
import { round } from '../lib/scale';
import { scaleIngredients } from '../lib/scale';
import { capitalizar, rotuloRendimento } from '../lib/format';
import { calcularNutricaoTotal, type Nutrientes100g } from '../lib/nutrition';
import { custoReceita, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { useDieta } from '../lib/diet';
import { useLembreteCompras } from '../lib/lembretes';
import { agendarLembreteSemanal, notificacoesNativasDisponiveis, pedirPermissaoNotificacoes } from '../lib/notifications';
import { sugerirReceitasParaPlano } from '../lib/autoPlano';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import {
  DIAS_CURTOS,
  DIAS_SEMANA,
  REFEICOES,
  agendamentosDoItem,
  agruparPorDia,
  ordenarAgendamentos,
  rotuloAgendamento,
  rotuloRefeicao,
} from '../lib/agenda';
import type { Agendamento, Ingredient, PlanItem, Refeicao } from '../types';

export default function PlanoSemana() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
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

  /**
   * Nutrição do que está agendado em cada dia. O total da semana não responde "como vai
   * ser o meu dia": três receitas caindo todas na quinta é uma quinta bem diferente de
   * três receitas espalhadas. Só entra receita com dia definido.
   */
  const nutriPorDia = useMemo(() => {
    const porId = new Map((recipes ?? []).map((r) => [r.id, r]));
    const mapa = new Map<number, Nutrientes100g>();
    for (const { dia, itens } of agenda.dias) {
      if (itens.length === 0) continue;
      // Receita agendada em três refeições é uma panelada dividida em três, não três
      // panelas: cada dia leva a fração correspondente.
      const ingredientes: Ingredient[] = itens.flatMap(({ item, vezesNaSemana }) => {
        const r = porId.get(item.recipeId);
        return r ? scaleIngredients(r.ingredientes, item.fator / Math.max(1, vezesNaSemana)) : [];
      });
      mapa.set(dia, calcularNutricaoTotal(ingredientes));
    }
    return mapa;
  }, [recipes, agenda]);

  const nutriTotal = useMemo(() => {
    if (!recipes) return calcularNutricaoTotal([]);
    const porId = new Map(recipes.map((r) => [r.id, r]));
    const todos: Ingredient[] = plano.itens.flatMap((item) => {
      const r = porId.get(item.recipeId);
      return r ? scaleIngredients(r.ingredientes, item.fator) : [];
    });
    return calcularNutricaoTotal(todos);
  }, [recipes, plano]);

  /** Custo estimado da semana inteira, receita a receita já na quantidade escolhida. */
  const custoTotal = useMemo(() => {
    if (!recipes) return { total: 0, cobertos: 0, totalItens: 0 };
    const listaPrecos = [...(precos ?? []), ...PRECOS_BASE];
    const porId = new Map(recipes.map((r) => [r.id, r]));
    return plano.itens.reduce(
      (acc, item) => {
        const r = porId.get(item.recipeId);
        if (!r) return acc;
        const c = custoReceita(scaleIngredients(r.ingredientes, item.fator), listaPrecos);
        return { total: acc.total + c.total, cobertos: acc.cobertos + c.cobertos, totalItens: acc.totalItens + c.totalItens };
      },
      { total: 0, cobertos: 0, totalItens: 0 },
    );
  }, [recipes, plano, precos]);

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

  /** Repõe no plano as receitas da semana anterior (as que ainda existem). */
  async function repetirSemana() {
    const idsValidos = new Set((recipes ?? []).map((r) => r.id));
    const n = await repetirPlanoAnterior(idsValidos);
    if (n === 0) {
      toast('Nenhuma receita da semana anterior para repetir.', 'info');
      return;
    }
    hapticLeve();
    toast(`${n} receita(s) da semana anterior de volta ao plano.`);
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
        <div className="card flex flex-nowrap items-center gap-2 overflow-x-auto p-3">
          <button onClick={montarSemanaAutomaticamente} className="btn-outline flex-shrink-0">
            <SparklesIcon className="size-4" /> Montar semana
          </button>
          {planoAnteriorDisponivel() && (
            <button onClick={repetirSemana} className="btn-outline flex-shrink-0" title="Repetir semana passada">
              <ArrowPathIcon className="size-4" /> Repetir semana
            </button>
          )}
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
                    {itens.map(({ recipe, refeicao }) => (
                      <span key={`${recipe.id}-${refeicao ?? 'sem'}`} className="block truncate">
                        {refeicao && (
                          <span className="mr-1 text-xs text-stone-400 dark:text-stone-500">
                            {rotuloRefeicao(refeicao)}:
                          </span>
                        )}
                        {capitalizar(recipe.titulo)}
                      </span>
                    ))}
                    <NutricaoDoDia nutri={nutriPorDia.get(dia)} />
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
          {custoTotal.cobertos > 0 && (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              Custo estimado da semana: <span className="font-semibold">{formatBRL(custoTotal.total)}</span>
              {custoTotal.cobertos < custoTotal.totalItens && '+ (alguns ingredientes sem preço conhecido)'}
            </p>
          )}
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
 * Onde a receita entra na semana. São vários lugares, não um: uma panelada de domingo
 * costuma ser o almoço de segunda e de quarta ao mesmo tempo. Cada chip é um lugar já
 * marcado (o X tira só aquele) e o seletor abaixo acrescenta mais um.
 */
function SeletorAgendamento({ recipeId, item }: { recipeId: string; item: PlanItem | undefined }) {
  const [dia, setDia] = useState('');
  const [refeicao, setRefeicao] = useState('');
  const agendamentos = item ? ordenarAgendamentos(agendamentosDoItem(item)) : [];

  function agendar() {
    if (dia === '') return;
    adicionarAgendamento(recipeId, Number(dia), refeicao === '' ? undefined : (refeicao as Refeicao));
    hapticLeve();
    setDia('');
    setRefeicao('');
  }

  return (
    <div className="mt-2 space-y-1.5 pl-8 pr-1" onClick={(e) => e.stopPropagation()}>
      {agendamentos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agendamentos.map((a: Agendamento) => (
            <span
              key={`${a.dia}-${a.refeicao ?? ''}`}
              className="chip gap-1 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            >
              {rotuloAgendamento(a)}
              <button
                onClick={() => {
                  removerAgendamento(recipeId, a);
                  hapticLeve();
                }}
                aria-label={`Tirar de ${rotuloAgendamento(a)}`}
                className="text-brand-500 hover:text-brand-700 dark:text-brand-400"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Sem rótulo: os próprios "— dia"/"— refeição" já dizem o que são, e numa tela de
          celular o rótulo empurrava o botão de agendar para fora do card. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input w-24 py-1 text-xs"
          aria-label="Dia da semana"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        >
          <option value="">— dia</option>
          {DIAS_SEMANA.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="input w-[5.5rem] py-1 text-xs"
          aria-label="Refeição"
          value={refeicao}
          onChange={(e) => setRefeicao(e.target.value)}
        >
          <option value="">— refeição</option>
          {REFEICOES.map((r) => (
            <option key={r.chave} value={r.chave}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={agendar}
          disabled={dia === ''}
          aria-label="Agendar neste dia"
          title="Agendar"
          className="btn-outline h-7 w-7 !px-0 disabled:opacity-40"
        >
          <PlusIcon className="mx-auto size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Resumo nutricional de um dia da agenda: energia e os três macros em grama. Estimado
 * a partir da mesma base de ingredientes da tabela nutricional da receita — serve para
 * enxergar o dia desequilibrado, não para prescrição.
 */
function NutricaoDoDia({ nutri }: { nutri: Nutrientes100g | undefined }) {
  if (!nutri || nutri.kcal <= 0) return null;
  return (
    <span className="block text-xs text-stone-400 dark:text-stone-500">
      ≈ {Math.round(nutri.kcal).toLocaleString('pt-BR')} kcal · P {Math.round(nutri.proteina)} g · C{' '}
      {Math.round(nutri.carboidrato)} g · G {Math.round(nutri.gorduraTotal)} g
    </span>
  );
}
