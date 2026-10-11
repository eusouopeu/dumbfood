// Aba "Fome" do Histórico: em que horários a fome aparece (lib/fome.ts).
//
// Junta os toques em "Estou com fome" com o horário em que as refeições foram lançadas
// (quando lançadas no mesmo dia). Responde "quando eu costumo ter fome?" com até quatro
// horários, separa dia útil de fim de semana e mostra as 24 h num gráfico.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { db } from '../../db/db';
import { removerFome } from '../../db/repo';
import { chaveDia } from '../../lib/consumo';
import {
  distribuicao,
  picosDeFome,
  resumoFome,
  rotuloMinuto,
  separarFimDeSemana,
  sinaisDeFome,
  type PicoFome,
} from '../../lib/fome';
import BarChart from '../BarChart';

const PERIODOS = [14, 30, 90];

function frase(picos: PicoFome[]): string {
  if (picos.length === 0) return 'ainda sem padrão';
  const h = picos.map((p) => rotuloMinuto(p.minuto));
  return h.length === 1 ? h[0] : `${h.slice(0, -1).join(', ')} e ${h[h.length - 1]}`;
}

export default function AnaliseFome() {
  const fome = useLiveQuery(() => db.fome.toArray(), []) ?? [];
  const consumo = useLiveQuery(() => db.consumo.toArray(), []) ?? [];
  const [dias, setDias] = useState(30);
  const [implicitos, setImplicitos] = useState(true);
  const [ajuda, setAjuda] = useState(false);
  const hoje = chaveDia();

  const sinais = useMemo(() => sinaisDeFome(fome, consumo, hoje, dias, implicitos), [fome, consumo, hoje, dias, implicitos]);
  const picos = useMemo(() => picosDeFome(sinais), [sinais]);
  const resumo = useMemo(() => resumoFome(sinais), [sinais]);
  const { uteis, fimDeSemana } = useMemo(() => separarFimDeSemana(sinais), [sinais]);
  const grafico = distribuicao(sinais).map((total, h) => ({ label: h % 3 === 0 ? String(h) : '', total }));
  const recentes = [...fome].sort((a, b) => b.hora - a.hora).slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-800">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setDias(p)}
              className={`rounded-md px-2.5 py-1 font-semibold ${dias === p ? 'bg-white shadow-sm dark:bg-stone-700' : 'text-stone-500 dark:text-stone-400'}`}
            >
              {p} dias
            </button>
          ))}
        </div>
        <button onClick={() => setAjuda((v) => !v)} aria-label="Como funciona" className="ml-auto text-stone-400">
          <InformationCircleIcon className="size-5" />
        </button>
      </div>

      {ajuda && (
        <p className="card p-3 text-xs text-stone-500 dark:text-stone-400">
          Conta cada toque no relógio da barra “inserir refeição…” (ou no atalho “Estou com fome” do ícone) e, se ligado,
          a hora em que você lançou cada refeição no mesmo dia em que comeu. Itens lançados com menos de 25 min entre si
          são uma refeição só; comer até 2 h depois de avisar a fome não conta de novo. Horário típico = média dos
          sinais a até 1 h do pico.
        </p>
      )}

      <div className="card space-y-3 p-4">
        {sinais.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400 dark:text-stone-500">
            Sem registros de fome nem refeições lançadas na hora nos últimos {dias} dias.
          </p>
        ) : (
          <>
            <p className="text-sm">
              Você costuma ter fome por volta de <span className="font-bold">{frase(picos)}</span>.
            </p>
            {picos.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {picos.map((p) => (
                  <li key={p.minuto} className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                    {rotuloMinuto(p.minuto)} · {Math.round(p.frequencia * 100)}% dos dias
                  </li>
                ))}
              </ul>
            )}
            <BarChart dados={grafico} cor="#f59e0b" destaque={new Date().getHours()} formatar={(n) => n.toFixed(1)} />
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-stone-500 dark:text-stone-400">Primeira fome do dia</dt>
                <dd className="font-semibold">{resumo.primeiraFome != null ? rotuloMinuto(resumo.primeiraFome) : '—'}</dd>
              </div>
              <div>
                <dt className="text-stone-500 dark:text-stone-400">Intervalo médio</dt>
                <dd className="font-semibold">
                  {resumo.intervaloMedio != null ? `${Math.floor(resumo.intervaloMedio / 60)}h${String(resumo.intervaloMedio % 60).padStart(2, '0')}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500 dark:text-stone-400">Dias úteis</dt>
                <dd className="font-semibold">{frase(picosDeFome(uteis, 3))}</dd>
              </div>
              <div>
                <dt className="text-stone-500 dark:text-stone-400">Fim de semana</dt>
                <dd className="font-semibold">{frase(picosDeFome(fimDeSemana, 3))}</dd>
              </div>
            </dl>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {resumo.explicitos} aviso(s) de fome · {resumo.implicitos} refeição(ões) lançada(s) na hora · {resumo.dias} dia(s)
            </p>
          </>
        )}
        <label className="flex items-center gap-2 border-t border-stone-100 pt-3 text-xs dark:border-stone-700">
          <input type="checkbox" className="accent-brand-500" checked={implicitos} onChange={(e) => setImplicitos(e.target.checked)} />
          Contar também o horário em que lancei as refeições
        </label>
      </div>

      {recentes.length > 0 && (
        <div className="card p-4">
          <h3 className="section-heading mb-2 text-sm">Últimos avisos de fome</h3>
          <ul className="space-y-1 text-xs">
            {recentes.map((f) => {
              const d = new Date(f.hora);
              return (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="flex-1">
                    {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ·{' '}
                    {rotuloMinuto(d.getHours() * 60 + d.getMinutes())}
                  </span>
                  <button onClick={() => removerFome(f.id)} aria-label="Apagar" className="text-red-500 dark:text-red-400">
                    <TrashIcon className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
