import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownTrayIcon, ChartBarIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { removerCompra } from '../db/repo';
import { nomeItem } from '../lib/format';
import { round } from '../lib/scale';
import { formatQtdUnidade } from '../lib/displayQty';
import { formatBRL } from '../lib/prices';
import {
  DIAS_POR_GRANULARIDADE,
  GRANULARIDADES,
  agruparPorPeriodo,
  csvDeCompra,
  inicioPeriodoAtual,
  macroPercentualPorPeriodo,
  mediaMacroPorPeriodo,
  precoMedioPorKg,
  type Granularidade,
} from '../lib/history';
import BarChart from '../components/BarChart';
import StackedBarChart from '../components/StackedBarChart';
import { useDieta } from '../lib/diet';
import { useOrcamento, statusOrcamento } from '../lib/orcamento';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import { confirmar } from '../lib/confirm';
import { toast } from '../lib/toast';
import { hapticForte } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import type { Compra, CompraItem } from '../types';

type Aba = 'compras' | 'gastos' | 'macros';

/** Intervalo [início, fim] usado nas médias: o range custom, ou do primeiro registro até hoje. */
function useIntervalo(compras: Compra[], inicioStr: string, fimStr: string): [number, number] {
  return useMemo(() => {
    const agora = Date.now();
    if (inicioStr && fimStr) return [new Date(inicioStr).getTime(), new Date(fimStr).getTime() + 86_400_000];
    if (compras.length === 0) return [agora, agora];
    const primeira = Math.min(...compras.map((c) => c.data));
    return [primeira, agora];
  }, [compras, inicioStr, fimStr]);
}

function useGranularidade() {
  return useState<Granularidade>('mes');
}

export default function Historico() {
  const compras = useLiveQuery(() => db.compras.orderBy('data').reverse().toArray(), []);
  const [aba, setAba] = useState<Aba>('compras');
  const [inicioStr, setInicioStr] = useState('');
  const [fimStr, setFimStr] = useState('');

  if (!compras)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Histórico</h2>
        <CardListSkeleton linhas={3} />
      </div>
    );

  const filtradas = inicioStr && fimStr
    ? compras.filter((c) => c.data >= new Date(inicioStr).getTime() && c.data <= new Date(fimStr).getTime() + 86_400_000)
    : compras;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Histórico</h2>

      <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
        {(['compras', 'gastos', 'macros'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize ${aba === a ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
          >
            {a === 'compras' ? 'Compras' : a === 'gastos' ? 'Gastos' : 'Macros'}
          </button>
        ))}
      </div>

      {compras.length === 0 ? (
        <div className="card p-6 text-center">
          <ChartBarIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
          <p className="font-semibold">Nenhuma compra salva ainda</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Marque os itens na lista de mercado e use "Salvar no histórico".
          </p>
        </div>
      ) : (
        <>
          {aba !== 'compras' && (
            <div className="card flex flex-wrap items-end gap-2 p-3">
              <div>
                <label className="block text-xs text-stone-500 dark:text-stone-400">De</label>
                <input type="date" className="input py-1" value={inicioStr} onChange={(e) => setInicioStr(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 dark:text-stone-400">Até</label>
                <input type="date" className="input py-1" value={fimStr} onChange={(e) => setFimStr(e.target.value)} />
              </div>
              {(inicioStr || fimStr) && (
                <button
                  onClick={() => {
                    setInicioStr('');
                    setFimStr('');
                  }}
                  className="btn-ghost h-8 py-0 text-xs"
                >
                  Limpar período
                </button>
              )}
              <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{filtradas.length} compra(s) no período</span>
            </div>
          )}

          {aba === 'compras' && <AbaCompras compras={compras} />}
          {aba === 'gastos' && <AbaGastos compras={filtradas} />}
          {aba === 'macros' && <AbaMacros compras={filtradas} inicioStr={inicioStr} fimStr={fimStr} />}
        </>
      )}
    </div>
  );
}

function formatCompraItemQtd(i: CompraItem): string {
  if (i.quantidadeUnidades !== null) return formatQtdUnidade(i.quantidadeUnidades, null);
  if (i.quantidadeG !== null) {
    return i.quantidadeG >= 1000
      ? formatQtdUnidade(round(i.quantidadeG / 1000), 'kg')
      : formatQtdUnidade(round(i.quantidadeG), 'g');
  }
  return '—';
}

function AbaCompras({ compras }: { compras: Compra[] }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setAbertas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportar(compra: Compra) {
    const blob = new Blob([csvDeCompra(compra)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compra-${new Date(compra.data).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ul className="space-y-2">
      {compras.map((c) => {
        const aberta = abertas.has(c.id);
        const itensOrdenados = [...c.itens].sort((a, b) => a.gondola.localeCompare(b.gondola, 'pt-BR') || a.item.localeCompare(b.item, 'pt-BR'));
        return (
          <li key={c.id} className="card p-3">
            <button onClick={() => toggle(c.id)} aria-expanded={aberta} className="flex w-full items-center gap-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{new Date(c.data).toLocaleDateString('pt-BR')}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {c.itens.length} itens · estimado {formatBRL(c.valorTotalEstimado)}
                </p>
              </div>
              <p className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatBRL(c.valorTotalReal)}</p>
              {aberta ? (
                <ChevronUpIcon className="size-4 text-stone-400 dark:text-stone-500" />
              ) : (
                <ChevronDownIcon className="size-4 text-stone-400 dark:text-stone-500" />
              )}
            </button>

            {aberta && (
              <ul className="mt-2 max-h-64 divide-y divide-stone-100 dark:divide-stone-700 overflow-y-auto border-t border-stone-100 dark:border-stone-700 text-sm">
                {itensOrdenados.map((i, idx) => (
                  <li key={idx} className="flex items-center gap-2 py-1">
                    <span className="w-16 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                      {formatCompraItemQtd(i)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{nomeItem(i.item)}</span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
                      {i.precoEstimado !== null ? formatBRL(i.precoEstimado) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex gap-2">
              <button onClick={() => exportar(c)} className="btn-outline h-7 px-2 text-xs" title="Exportar CSV">
                <ArrowDownTrayIcon className="size-3.5" /> CSV
              </button>
              <button
                onClick={async () => {
                  const ok = await confirmar('Remover esta compra do histórico?', {
                    textoConfirmar: 'Remover',
                    perigo: true,
                  });
                  if (ok) {
                    await removerCompra(c.id);
                    hapticForte();
                    toast('Compra removida do histórico.');
                  }
                }}
                className="btn-outline h-7 px-2 text-xs text-red-600 dark:text-red-400"
              >
                Excluir
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-lg font-bold">{valor}</p>
      <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
    </div>
  );
}

function SeletorGranularidade({ granularidade, onChange }: { granularidade: Granularidade; onChange: (g: Granularidade) => void }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
      {GRANULARIDADES.map((g) => (
        <button
          key={g.chave}
          onClick={() => onChange(g.chave)}
          className={`rounded-md px-2 py-1 font-semibold ${granularidade === g.chave ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

function AbaGastos({ compras }: { compras: Compra[] }) {
  const [granularidade, setGranularidade] = useGranularidade();
  const [orcamentoSemanal] = useOrcamento();
  const label = GRANULARIDADES.find((g) => g.chave === granularidade)!.label.toLowerCase();

  const inicioAtual = inicioPeriodoAtual(granularidade, Date.now());
  const comprasPeriodoAtual = compras.filter((c) => c.data >= inicioAtual);
  const totalPeriodoAtual = comprasPeriodoAtual.reduce((s, c) => s + c.valorTotalReal, 0);
  const precoKg = precoMedioPorKg(comprasPeriodoAtual);

  const dadosChart = useMemo(
    () => agruparPorPeriodo(compras, granularidade, (c) => c.valorTotalReal),
    [compras, granularidade],
  );

  // O orçamento é definido semanalmente (lista de mercado); aqui ele é convertido
  // pela duração da granularidade escolhida, pra dar um teto comparável em qualquer visão.
  const orcamentoPeriodo =
    orcamentoSemanal !== null ? orcamentoSemanal * (DIAS_POR_GRANULARIDADE[granularidade] / DIAS_POR_GRANULARIDADE.semana) : null;
  const statusOrc = orcamentoPeriodo !== null ? statusOrcamento(totalPeriodoAtual, orcamentoPeriodo) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <SeletorGranularidade granularidade={granularidade} onChange={setGranularidade} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CardResumo label={`gasto n${label === 'semana' ? 'a' : 'o'} ${label} atual`} valor={formatBRL(totalPeriodoAtual)} />
        <CardResumo label={`preço médio do kg n${label === 'semana' ? 'a' : 'o'} ${label} atual`} valor={`${formatBRL(precoKg)}/kg`} />
      </div>

      {orcamentoPeriodo !== null && (
        <div className="card space-y-2 p-4">
          <h3 className="section-heading text-sm">
            Orçamento n{label === 'semana' ? 'a' : 'o'} {label} atual
          </h3>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            <div
              className={
                statusOrc === 'estourado' ? 'h-full bg-red-500' : statusOrc === 'perto' ? 'h-full bg-amber-500' : 'h-full bg-green-500'
              }
              style={{ width: `${Math.min(100, Math.round((totalPeriodoAtual / orcamentoPeriodo) * 100))}%` }}
            />
          </div>
          <p
            className={`text-sm ${
              statusOrc === 'estourado'
                ? 'font-semibold text-red-600 dark:text-red-400'
                : statusOrc === 'perto'
                  ? 'font-semibold text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {formatBRL(totalPeriodoAtual)} de {formatBRL(orcamentoPeriodo)} ({Math.round((totalPeriodoAtual / orcamentoPeriodo) * 100)}%)
            {statusOrc === 'estourado' && ' — orçamento estourado'}
            {statusOrc === 'perto' && ' — perto do limite'}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Calculado a partir do orçamento semanal definido na Lista de mercado.
          </p>
        </div>
      )}

      <div className="card p-4">
        <h3 className="section-heading mb-3 text-sm">Gasto ao longo do tempo</h3>
        <BarChart
          dados={dadosChart}
          formatar={formatBRL}
          linhaReferencia={orcamentoPeriodo ?? undefined}
          rotuloReferencia={orcamentoPeriodo !== null ? `Orçamento: ${formatBRL(orcamentoPeriodo)}` : undefined}
        />
      </div>
    </div>
  );
}

function AbaMacros({ compras, inicioStr, fimStr }: { compras: Compra[]; inicioStr: string; fimStr: string }) {
  const [inicio, fim] = useIntervalo(compras, inicioStr, fimStr);
  const [granularidade, setGranularidade] = useGranularidade();
  const [dieta, setDieta] = useDieta();
  const label = GRANULARIDADES.find((g) => g.chave === granularidade)!.label.toLowerCase();

  const real = {
    proteina: mediaMacroPorPeriodo(compras, 'proteina', granularidade, inicio, fim),
    carboidrato: mediaMacroPorPeriodo(compras, 'carboidrato', granularidade, inicio, fim),
    gorduraTotal: mediaMacroPorPeriodo(compras, 'gorduraTotal', granularidade, inicio, fim),
  };

  const dadosChart = useMemo(
    () => macroPercentualPorPeriodo(compras, granularidade),
    [compras, granularidade],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeletorDieta dieta={dieta} onChange={setDieta} />
        <SeletorGranularidade granularidade={granularidade} onChange={setGranularidade} />
      </div>

      <div className="card p-4">
        <MacroResumoCard
          titulo={`Composição média por ${label} · % das gramas de macros`}
          real={real}
          dieta={dieta}
        />
      </div>

      <div className="card p-4">
        <h3 className="section-heading mb-3 text-sm">Composição de macros ao longo do tempo</h3>
        <StackedBarChart dados={dadosChart} />
      </div>
    </div>
  );
}
