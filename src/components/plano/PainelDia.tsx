// Painel do dia: o cabeçalho da aba Semana.
//
// A aba abria na escolha de receitas — uma decisão semanal — mas a pergunta de quem
// abre o app no meio da tarde é do dia: "quanto ainda cabe hoje?". O painel responde
// isso primeiro (anel de calorias, macros contra a meta, semana em barras) e só depois
// vem o planejamento. O dia é navegável porque registrar o jantar de ontem às 23h é
// tão comum quanto registrar o almoço de hoje.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { db } from '../../db/db';
import { registrarConsumo, removerConsumo } from '../../db/repo';
import { REFEICOES, receitasDoDia } from '../../lib/agenda';
import { chaveDia, dataDaChave, kcalPorDia, porRefeicao, rotuloDia, somarDias, totaisDoDia } from '../../lib/consumo';
import { kcalRecomendadaRefeicao, useMetaDiaria } from '../../lib/metas';
import { capitalizar } from '../../lib/format';
import type { Nutrientes100g } from '../../lib/nutrition';
import { CORES_MACRO } from '../MacroResumo';
import AnelProgresso from '../AnelProgresso';
import BarraMacro from '../BarraMacro';
import BarChart from '../BarChart';
import RegistrarConsumo from './RegistrarConsumo';
import { toast } from '../../lib/toast';
import { hapticLeve } from '../../lib/haptics';
import type { PlanItem, Recipe, Refeicao } from '../../types';

const DIAS_NA_SERIE = 7;

/** O que a folha de registro devolve; o dia e a refeição são do painel. */
type DadosRegistro = { nome: string; recipeId?: string; porcoes: number; nutrientes: Nutrientes100g };

export default function PainelDia({ recipes, itensPlano }: { recipes: Recipe[]; itensPlano: PlanItem[] }) {
  const [dia, setDia] = useState(() => chaveDia());
  const [registrando, setRegistrando] = useState<Refeicao | null>(null);
  const meta = useMetaDiaria();

  const consumo = useLiveQuery(() => db.consumo.toArray(), []) ?? [];
  const registrosDoDia = useMemo(() => consumo.filter((r) => r.dia === dia), [consumo, dia]);
  const totais = useMemo(() => totaisDoDia(registrosDoDia), [registrosDoDia]);
  const agrupado = useMemo(() => porRefeicao(registrosDoDia), [registrosDoDia]);

  // O que o plano marcou para o dia da semana correspondente à data escolhida.
  const agendadoPorRefeicao = useMemo(() => {
    const porId = new Map(recipes.map((r) => [r.id, r]));
    const doDia = receitasDoDia(itensPlano, porId, dataDaChave(dia).getDay());
    const mapa = new Map<Refeicao, Recipe[]>();
    for (const { chave } of REFEICOES) mapa.set(chave, []);
    for (const item of doDia) {
      if (!item.refeicao) continue;
      mapa.get(item.refeicao)?.push(item.recipe);
    }
    return mapa;
  }, [recipes, itensPlano, dia]);

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
          um caderno, e o rótulo já diz "hoje"/"ontem" para não precisar contar datas. */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="btn-icon p-2">
          <ChevronLeftIcon className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold uppercase tracking-wide">{rotuloDia(dia)}</p>
          {dia !== chaveDia() && (
            <button onClick={() => setDia(chaveDia())} className="chip">
              hoje
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link to="/perfil" aria-label="Perfil e metas" title="Perfil e metas" className="btn-icon p-2">
            <UserCircleIcon className="size-4" />
          </Link>
          <button onClick={() => setDia(somarDias(dia, 1))} aria-label="Próximo dia" className="btn-icon p-2">
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      <AnelProgresso
        consumido={totais.kcal}
        meta={meta.kcal}
        esquerda={{ label: 'Consumido', valor: Math.round(totais.kcal).toLocaleString('pt-BR') }}
        direita={{ label: 'Refeições', valor: String(registrosDoDia.length) }}
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

      <ul className="divide-y divide-stone-100 dark:divide-stone-700">
        {REFEICOES.map(({ chave, label }) => {
          const registros = agrupado.get(chave) ?? [];
          const agendadas = agendadoPorRefeicao.get(chave) ?? [];
          const kcalRegistrada = registros.reduce((s, r) => s + r.nutrientes.kcal, 0);
          const recomendada = kcalRecomendadaRefeicao(meta.kcal, chave);
          return (
            <li key={chave} className="py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  {registros.length > 0 ? (
                    // Os nomes vêm na lista abaixo; repeti-los aqui só duplicaria a linha.
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {Math.round(kcalRegistrada).toLocaleString('pt-BR')} de{' '}
                      {recomendada.toLocaleString('pt-BR')} kcal recomendadas
                    </p>
                  ) : (
                    // Slot vazio com orientação em vez de traço: a recomendação é o que
                    // transforma o buraco da agenda em instrução.
                    <p className="truncate text-xs text-stone-400 dark:text-stone-500">
                      Recomendado: {recomendada.toLocaleString('pt-BR')} kcal
                      {agendadas.length > 0 && ` · planejado: ${agendadas.map((r) => capitalizar(r.titulo)).join(', ')}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setRegistrando(chave)}
                  aria-label={`Registrar ${label}`}
                  title={`Registrar ${label}`}
                  className="btn-icon flex-shrink-0 p-2"
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
              {registros.length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-1">
                  {registros.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="min-w-0 flex-1 truncate">
                        {capitalizar(r.nome)}
                        {r.porcoes !== 1 && ` · ${r.porcoes}×`}
                      </span>
                      <span className="tabular-nums">{Math.round(r.nutrientes.kcal).toLocaleString('pt-BR')} kcal</span>
                      <button
                        onClick={async () => {
                          await removerConsumo(r.id);
                          toast('Registro removido.');
                        }}
                        aria-label={`Remover ${r.nome}`}
                        className="text-red-500 dark:text-red-400"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {registrando && (
        <RegistrarConsumo
          refeicao={registrando}
          recipes={recipes}
          agendadas={agendadoPorRefeicao.get(registrando) ?? []}
          historico={consumo}
          onRegistrar={async (dados) => {
            await registrar(registrando, dados);
            setRegistrando(null);
          }}
          onFechar={() => setRegistrando(null)}
        />
      )}
    </div>
  );
}
