// Aba Semana: montar a semana de duas formas, trocadas por uma pílula flutuante —
// a partir das receitas (quais e quanto) ou a partir dos dias (o que entra em cada um).
// As duas visões começam pelo que vale para a semana inteira: montar/repetir e macros.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowPathIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  RectangleStackIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import {
  adicionarAgendamento,
  definirNoPlano,
  distribuirPlanoNaSemana,
  planoAnteriorDisponivel,
  removerAgendamento,
  removerDoPlano,
  repetirPlanoAnterior,
} from '../db/repo';
import { scaleIngredients } from '../lib/scale';
import { capitalizar } from '../lib/format';
import { calcularNutricaoTotal, type Nutrientes100g } from '../lib/nutrition';
import { custoReceita, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { useLembreteCompras } from '../lib/lembretes';
import { agendarLembreteSemanal, notificacoesNativasDisponiveis } from '../lib/notifications';
import { sugerirReceitasParaPlano } from '../lib/autoPlano';
import { MacroBarrasCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import { agruparPorDia } from '../lib/agenda';
import AgendaSemana from '../components/plano/AgendaSemana';
import AdicionarNoDia from '../components/plano/AdicionarNoDia';
import CardReceitaPlano from '../components/plano/CardReceitaPlano';
import PilulaAbas from '../components/PilulaAbas';
import type { Ingredient } from '../types';

export default function PlanoSemana({ visao }: { visao: 'receitas' | 'dias' }) {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
  const plano = usePlano();
  // O controle do lembrete saiu da tela; o que já estava configurado continua agendado.
  const [lembreteCompras] = useLembreteCompras();
  const [alvoAuto, setAlvoAuto] = useState(5);
  const [diaAdicionando, setDiaAdicionando] = useState<number | null>(null);

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

  const pilula = (
    <div className="fixed bottom-[4.9rem] right-4 z-20">
      <PilulaAbas
        abas={[
          { to: '/plano', label: 'Montar pelas receitas', icon: RectangleStackIcon, end: true },
          { to: '/plano/dias', label: 'Montar pelos dias', icon: CalendarDaysIcon },
        ]}
      />
    </div>
  );

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

  /**
   * Completa o plano até `alvoAuto` receitas (favoritos e o que a geladeira já cobre
   * primeiro) e distribui na agenda tudo o que ainda está sem dia.
   */
  async function montarSemanaAutomaticamente() {
    const jaSelecionadas = new Set(plano.itens.map((i) => i.recipeId));
    const faltam = alvoAuto - jaSelecionadas.size;
    const sugeridas = faltam > 0 ? sugerirReceitasParaPlano(recipes ?? [], geladeira ?? [], jaSelecionadas, faltam) : [];
    for (const r of sugeridas) await definirNoPlano(r.id, 1);
    const agendadas = await distribuirPlanoNaSemana(recipes ?? [], hoje);
    if (sugeridas.length === 0 && agendadas === 0) {
      toast('A semana já está montada.', 'info');
      return;
    }
    hapticLeve();
    const partes = [];
    if (sugeridas.length > 0) partes.push(`${sugeridas.length} receita(s) adicionada(s)`);
    if (agendadas > 0) partes.push(`${agendadas} distribuída(s) na agenda`);
    toast(`${capitalizar(partes.join(' e '))}.`);
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

  async function adicionarNoDia(recipeId: string, dia: number, refeicao: Parameters<typeof adicionarAgendamento>[2]) {
    if (!plano.itens.some((i) => i.recipeId === recipeId)) await definirNoPlano(recipeId, 1);
    await adicionarAgendamento(recipeId, dia, refeicao);
    hapticLeve();
    setDiaAdicionando(null);
  }

  return (
    <div className="space-y-4">
      {pilula}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Semana</h2>
        <span className="chip">{plano.itens.length} selecionada(s)</span>
      </div>

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
          <h3 className="section-heading mb-2 text-sm">Macros do plano</h3>
          <MacroBarrasCard real={nutriTotal} />
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
      ) : visao === 'receitas' ? (
        <ul className="space-y-2 pb-16">
          {recipes.map((r) => (
            <CardReceitaPlano
              key={r.id}
              recipe={r}
              item={plano.itens.find((i) => i.recipeId === r.id)}
              onAlternar={(marcado) => alternarNoPlano(r.id, r.titulo, marcado)}
            />
          ))}
        </ul>
      ) : (
        <div className="pb-16">
          <AgendaSemana
            agenda={agenda}
            hoje={hoje}
            nutriPorDia={nutriPorDia}
            onAdicionar={setDiaAdicionando}
            onRemover={(recipeId, agendamento) => removerAgendamento(recipeId, agendamento)}
          />
        </div>
      )}

      {diaAdicionando !== null && (
        <AdicionarNoDia
          dia={diaAdicionando}
          recipes={recipes}
          onAdicionar={(recipeId, refeicao) => adicionarNoDia(recipeId, diaAdicionando, refeicao)}
          onFechar={() => setDiaAdicionando(null)}
        />
      )}
    </div>
  );
}
