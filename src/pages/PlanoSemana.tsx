// Aba Semana: escolher as receitas da semana, em que quantidade e em que dias.
//
// A ordem da tela segue a ordem da decisão: primeiro as ações da semana inteira (gerar
// a lista, limpar, montar/repetir), depois o que é resumo (macros), depois a escolha
// receita a receita — e a agenda no fim, que é o resultado de tudo isso.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowPathIcon,
  BookOpenIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { definirNoPlano, removerDoPlano, limparPlano, planoAnteriorDisponivel, repetirPlanoAnterior } from '../db/repo';
import { scaleIngredients } from '../lib/scale';
import { capitalizar } from '../lib/format';
import { calcularNutricaoTotal, type Nutrientes100g } from '../lib/nutrition';
import { custoReceita, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { useDieta } from '../lib/diet';
import { useLembreteCompras } from '../lib/lembretes';
import { agendarLembreteSemanal, notificacoesNativasDisponiveis } from '../lib/notifications';
import { sugerirReceitasParaPlano } from '../lib/autoPlano';
import { CabecalhoMacros, MacroBarrasCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import { agruparPorDia } from '../lib/agenda';
import AgendaSemana from '../components/plano/AgendaSemana';
import CardReceitaPlano from '../components/plano/CardReceitaPlano';
import type { Ingredient } from '../types';

export default function PlanoSemana() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
  const plano = usePlano();
  const [dieta, setDieta] = useDieta();
  // O controle do lembrete saiu da tela; o que já estava configurado continua agendado.
  const [lembreteCompras] = useLembreteCompras();
  const [alvoAuto, setAlvoAuto] = useState(5);

  useEffect(() => {
    if (notificacoesNativasDisponiveis()) agendarLembreteSemanal(lembreteCompras);
  }, [lembreteCompras]);

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

      {/* O que fazer com a semana inteira vem antes da escolha receita a receita: é a
          ação que o usuário procura ao abrir a aba com o plano já montado. */}
      <div className="flex gap-2">
        <Link to="/lista" className="btn-primary flex-1">
          <ShoppingCartIcon className="size-4" /> Gerar lista de mercado
        </Link>
        {plano.itens.length > 0 && (
          <button onClick={() => limparPlano()} aria-label="Limpar a semana" title="Limpar" className="btn-icon">
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>

      <p className="text-sm text-stone-500 dark:text-stone-400">
        Marque as receitas da semana e ajuste a quantidade. Depois gere a lista de mercado.
      </p>

      {recipes.length > 0 && (
        <div className="card flex flex-nowrap items-center gap-2 overflow-x-auto p-3">
          <button
            onClick={montarSemanaAutomaticamente}
            aria-label="Montar semana automaticamente"
            title="Montar semana"
            className="btn-icon flex-shrink-0"
          >
            <SparklesIcon className="size-4" />
          </button>
          {planoAnteriorDisponivel() && (
            <button
              onClick={repetirSemana}
              aria-label="Repetir a semana passada"
              title="Repetir semana"
              className="btn-icon flex-shrink-0"
            >
              <ArrowPathIcon className="size-4" />
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

      {plano.itens.length > 0 && (
        <div className="card p-4">
          <CabecalhoMacros titulo="Macros do plano" dieta={dieta} onChange={setDieta} />
          <MacroBarrasCard real={nutriTotal} dieta={dieta} />
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
          {recipes.map((r) => (
            <CardReceitaPlano
              key={r.id}
              recipe={r}
              item={plano.itens.find((i) => i.recipeId === r.id)}
              onAlternar={(marcado) => alternarNoPlano(r.id, r.titulo, marcado)}
            />
          ))}
        </ul>
      )}

      {plano.itens.length > 0 && <AgendaSemana agenda={agenda} hoje={hoje} nutriPorDia={nutriPorDia} />}
    </div>
  );
}
