// Painel do dia: a tela inicial do app.
//
// A aba abria na escolha de receitas — uma decisão semanal — mas a pergunta de quem
// abre o app no meio da tarde é do dia: "quanto ainda cabe hoje?". O painel responde
// isso primeiro (anel de calorias, macros contra a meta, semana em barras) e só depois
// vem o planejamento. O dia é navegável porque registrar o jantar de ontem às 23h é
// tão comum quanto registrar o almoço de hoje.

import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { db } from '../../db/db';
import { registrarConsumo, registrarExercicio, removerConsumo, removerExercicio } from '../../db/repo';
import { receitasDoDia } from '../../lib/agenda';
import {
  chaveDia,
  dataDaChave,
  kcalPorDia,
  porRefeicao,
  rotuloDiaCurto,
  somarDias,
  totaisDoDia,
} from '../../lib/consumo';
import { useMetaDiaria } from '../../lib/metas';
import { kcalRecomendada, refeicaoPorHorario, useRefeicoes } from '../../lib/refeicoes';
import { kcalQueimadaNoDia } from '../../lib/exercicios';
import { capitalizar } from '../../lib/format';
import type { Nutrientes100g } from '../../lib/nutrition';
import { CORES_MACRO } from '../MacroResumo';
import AnelProgresso from '../AnelProgresso';
import BarraMacro from '../BarraMacro';
import BarChart from '../BarChart';
import LinhaRefeicao from './LinhaRefeicao';
import RegistrarConsumo from './RegistrarConsumo';
import RegistrarExercicio from './RegistrarExercicio';
import { toast } from '../../lib/toast';
import { hapticLeve } from '../../lib/haptics';
import type { PlanItem, Recipe, Refeicao } from '../../types';

const DIAS_NA_SERIE = 7;

/** O que a folha de registro devolve; o dia e a refeição são do painel. */
type DadosRegistro = { nome: string; recipeId?: string; porcoes: number; nutrientes: Nutrientes100g };

export default function PainelDia({ recipes, itensPlano }: { recipes: Recipe[]; itensPlano: PlanItem[] }) {
  const [dia, setDia] = useState(() => chaveDia());
  const [registrando, setRegistrando] = useState<Refeicao | null>(null);
  const [registrandoExercicio, setRegistrandoExercicio] = useState(false);
  const [novaRefeicao, setNovaRefeicao] = useState('');
  const [criandoRefeicao, setCriandoRefeicao] = useState(false);
  /** Texto da barra de adição rápida; ao enviar, abre a busca já filtrada. */
  const [rapido, setRapido] = useState('');
  const [buscaInicial, setBuscaInicial] = useState<string | undefined>();
  const seletorData = useRef<HTMLInputElement>(null);
  const meta = useMetaDiaria();
  const { refeicoes, adicionar: adicionarRefeicao, remover: removerRefeicao } = useRefeicoes();
  const chaves = useMemo(() => refeicoes.map((r) => r.chave), [refeicoes]);

  const consumo = useLiveQuery(() => db.consumo.toArray(), []) ?? [];
  const exercicios = useLiveQuery(() => db.exercicios.toArray(), []) ?? [];
  const registrosDoDia = useMemo(() => consumo.filter((r) => r.dia === dia), [consumo, dia]);
  const exerciciosDoDia = useMemo(() => exercicios.filter((e) => e.dia === dia), [exercicios, dia]);
  const totais = useMemo(() => totaisDoDia(registrosDoDia), [registrosDoDia]);
  const agrupado = useMemo(() => porRefeicao(registrosDoDia, chaves), [registrosDoDia, chaves]);
  const queimado = kcalQueimadaNoDia(exerciciosDoDia, dia);

  // O que o plano marcou para o dia da semana correspondente à data escolhida.
  const agendadoPorRefeicao = useMemo(() => {
    const porId = new Map(recipes.map((r) => [r.id, r]));
    const doDia = receitasDoDia(itensPlano, porId, dataDaChave(dia).getDay());
    const mapa = new Map<Refeicao, Recipe[]>();
    for (const chave of chaves) mapa.set(chave, []);
    for (const item of doDia) {
      if (!item.refeicao) continue;
      mapa.get(item.refeicao)?.push(item.recipe);
    }
    return mapa;
  }, [recipes, itensPlano, dia, chaves]);

  const serie = useMemo(() => kcalPorDia(consumo, dia, DIAS_NA_SERIE), [consumo, dia]);
  const dadosGrafico = serie.map((p) => ({
    label: dataDaChave(p.dia).toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(),
    total: p.kcal,
  }));

  async function registrar(refeicao: Refeicao, dados: DadosRegistro) {
    await registrarConsumo({ dia, refeicao, ...dados });
    hapticLeve();
    toast(`${capitalizar(dados.nome)} registrado.`);
  }

  return (
    <div className="card space-y-4 p-4">
      {/* Navegação por dia: setas nas pontas, data no meio — o mesmo gesto de folhear
          um caderno. O ponto ao lado da data marca "hoje" sem gastar uma palavra, e o
          ícone de calendário salta para qualquer data sem passar dia a dia. */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="btn-icon p-2">
          <ChevronLeftIcon className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          {dia === chaveDia() && <span className="size-2 shrink-0 rounded-full bg-red-500" title="Hoje" />}
          <p className="truncate text-sm font-bold">{rotuloDiaCurto(dia)}</p>
          <button
            onClick={() => seletorData.current?.showPicker?.() ?? seletorData.current?.click()}
            aria-label="Escolher data"
            title="Escolher data"
            className="text-stone-400 dark:text-stone-500"
          >
            <CalendarDaysIcon className="size-4" />
          </button>
          {/* O input existe só para abrir o calendário nativo; quem mostra a data é o texto. */}
          <input
            ref={seletorData}
            type="date"
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </div>
        <button onClick={() => setDia(somarDias(dia, 1))} aria-label="Próximo dia" className="btn-icon p-2">
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <AnelProgresso
        consumido={totais.kcal}
        meta={meta.kcal}
        esquerda={{ label: 'Refeições', valor: String(registrosDoDia.length) }}
        direita={{
          label: 'Exercícios',
          valor: Math.round(queimado).toLocaleString('pt-BR'),
          onClick: () => setRegistrandoExercicio(true),
        }}
      />

      <div className="space-y-2">
        <BarraMacro rotulo="Carboidratos" atual={totais.carboidrato} meta={meta.gramas.carboidrato} cor={CORES_MACRO.carboidrato} />
        <BarraMacro rotulo="Proteínas" atual={totais.proteina} meta={meta.gramas.proteina} cor={CORES_MACRO.proteina} />
        <BarraMacro rotulo="Gorduras" atual={totais.gorduraTotal} meta={meta.gramas.gorduraTotal} cor={CORES_MACRO.gordura} />
      </div>

      <div>
        <h3 className="section-heading mb-1 text-sm">Últimos {DIAS_NA_SERIE} dias</h3>
        <BarChart
          dados={dadosGrafico}
          cor="#a8a29e"
          destaque={DIAS_NA_SERIE - 1}
          linhaReferencia={meta.kcal}
          rotuloReferencia={`Meta: ${meta.kcal.toLocaleString('pt-BR')} kcal`}
          formatar={(n) => `${Math.round(n).toLocaleString('pt-BR')} kcal`}
        />
      </div>

      {exerciciosDoDia.length > 0 && (
        <ul className="space-y-0.5">
          {exerciciosDoDia.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <span className="min-w-0 flex-1 truncate">
                {capitalizar(e.nome)}
                {e.minutos ? ` · ${e.minutos} min` : ''}
              </span>
              <span className="tabular-nums">−{Math.round(e.kcal).toLocaleString('pt-BR')} kcal</span>
              <button
                onClick={async () => {
                  await removerExercicio(e.id);
                  toast('Exercício removido.');
                }}
                aria-label={`Remover ${e.nome}`}
                className="text-red-500 dark:text-red-400"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-stone-100 dark:divide-stone-700">
        {refeicoes.map((def) => (
          <LinhaRefeicao
            key={def.chave}
            def={def}
            registros={agrupado.get(def.chave) ?? []}
            agendadas={agendadoPorRefeicao.get(def.chave) ?? []}
            recomendada={kcalRecomendada(meta.kcal, def.chave, chaves)}
            onRegistrar={() => {
              setBuscaInicial(undefined);
              setRegistrando(def.chave);
            }}
            onRemoverRegistro={async (id) => {
              await removerConsumo(id);
              toast('Registro removido.');
            }}
            onRemoverRefeicao={
              def.extra
                ? () => {
                    removerRefeicao(def.chave);
                    toast(`${def.label} removida.`);
                  }
                : undefined
            }
          />
        ))}
      </ul>

      {/* Café, almoço, lanche e jantar não cobrem todo mundo: ceia e pré-treino existem,
          e sem lugar para eles o registro do dia mente. A meta se redistribui sozinha. */}
      {criandoRefeicao ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const nova = adicionarRefeicao(novaRefeicao);
            if (nova) {
              setNovaRefeicao('');
              setCriandoRefeicao(false);
              toast(`${nova.label} adicionada ao dia.`);
            }
          }}
        >
          <input
            className="input min-w-0 flex-1 text-sm"
            placeholder="Nome da refeição (ex.: ceia)"
            aria-label="Nome da nova refeição"
            value={novaRefeicao}
            onChange={(e) => setNovaRefeicao(e.target.value)}
            autoFocus
            onBlur={() => !novaRefeicao.trim() && setCriandoRefeicao(false)}
          />
          <button
            type="submit"
            disabled={!novaRefeicao.trim()}
            aria-label="Criar refeição"
            title="Criar refeição"
            className="btn-icon flex-shrink-0 p-2"
          >
            <PlusIcon className="size-4" />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setCriandoRefeicao(true)}
          aria-label="Nova refeição"
          title="Nova refeição"
          className="flex w-full items-center justify-center rounded-lg border border-dashed border-stone-300 py-1.5 text-stone-400 dark:border-stone-600 dark:text-stone-500"
        >
          <PlusIcon className="size-4" />
        </button>
      )}

      {/* Adição rápida: digitar o que comeu e cair direto na busca, na refeição da hora.
          Fica flutuando acima da barra de navegação para estar à mão em qualquer rolagem. */}
      <form
        className="fixed inset-x-0 bottom-[5.5rem] z-20 mx-auto flex max-w-2xl px-4"
        onSubmit={(e) => {
          e.preventDefault();
          const texto = rapido.trim();
          if (!texto) return;
          setBuscaInicial(texto);
          setRegistrando(refeicaoPorHorario());
          setRapido('');
        }}
      >
        <div className="flex w-full items-center gap-2 rounded-full border border-stone-300 bg-white/80 py-1 pl-5 pr-1 shadow-lg backdrop-blur-md dark:border-stone-600 dark:bg-stone-800/80">
          <input
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-stone-400"
            placeholder="inserir refeição…"
            aria-label="Adicionar o que comeu"
            value={rapido}
            onChange={(e) => setRapido(e.target.value)}
          />
          <button
            type="submit"
            disabled={!rapido.trim()}
            aria-label="Adicionar"
            title="Adicionar"
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full text-stone-700 disabled:opacity-40 dark:text-stone-200"
          >
            <PlusIcon className="size-6" />
          </button>
        </div>
      </form>
      {/* Espaço para a barra flutuante não cobrir o jantar. */}
      <div aria-hidden className="h-16" />

      {registrando && (
        <RegistrarConsumo
          refeicao={registrando}
          rotulo={refeicoes.find((r) => r.chave === registrando)?.label}
          buscaInicial={buscaInicial}
          recipes={recipes}
          agendadas={agendadoPorRefeicao.get(registrando) ?? []}
          historico={consumo}
          onRegistrar={async (dados) => {
            await registrar(registrando, dados);
            setRegistrando(null);
            setBuscaInicial(undefined);
          }}
          onFechar={() => {
            setRegistrando(null);
            setBuscaInicial(undefined);
          }}
        />
      )}

      {registrandoExercicio && (
        <RegistrarExercicio
          onRegistrar={async (dados) => {
            await registrarExercicio({ dia, ...dados });
            hapticLeve();
            setRegistrandoExercicio(false);
            toast(`${capitalizar(dados.nome)} registrado.`);
          }}
          onFechar={() => setRegistrandoExercicio(false)}
        />
      )}
    </div>
  );
}
