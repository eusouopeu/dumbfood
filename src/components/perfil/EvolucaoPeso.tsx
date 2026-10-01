// Evolução do peso: a série que o campo "Peso" do perfil vai gravando, um ponto por dia.
//
// Só aparece com dois registros ou mais — um ponto só não é tendência.

import { useLiveQuery } from 'dexie-react-hooks';
import { ScaleIcon } from '@heroicons/react/24/outline';
import { db } from '../../db/db';
import { chaveDia, dataDaChave } from '../../lib/consumo';
import { registrosNaJanela, tendenciaPeso } from '../../lib/pesoCorporal';

const JANELA_DIAS = 90;

function dataCurta(dia: string): string {
  return dataDaChave(dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function EvolucaoPeso() {
  const registros = useLiveQuery(() => db.pesos.toArray(), []);
  if (!registros) return null;

  const hoje = chaveDia();
  const janela = registrosNaJanela(registros, hoje, JANELA_DIAS);
  const tendencia = tendenciaPeso(registros, hoje, JANELA_DIAS);
  if (!tendencia) return null;

  // Linha simples: x pela posição no tempo, y pela faixa de peso da janela.
  const largura = 300;
  const altura = 60;
  const kgs = janela.map((r) => r.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const faixa = max - min || 1;
  const t0 = dataDaChave(janela[0].dia).getTime();
  const t1 = dataDaChave(janela[janela.length - 1].dia).getTime();
  const duracao = t1 - t0 || 1;
  const pontos = janela.map((r) => {
    const x = ((dataDaChave(r.dia).getTime() - t0) / duracao) * largura;
    const y = altura - 4 - ((r.kg - min) / faixa) * (altura - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const v = tendencia.variacao;
  const sinal = v > 0 ? '+' : v < 0 ? '−' : '';

  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center gap-2">
        <ScaleIcon className="size-5 text-brand-500" />
        <h3 className="section-heading flex-1 text-sm">Evolução do peso</h3>
        <span className="text-sm font-bold tabular-nums">{tendencia.atual.toLocaleString('pt-BR')} kg</span>
      </div>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-16 w-full text-brand-500"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Peso de ${dataCurta(tendencia.desde)} até hoje`}
      >
        <polyline
          points={pontos.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {sinal}
        {Math.abs(v).toLocaleString('pt-BR')} kg desde {dataCurta(tendencia.desde)} · {janela.length} registros. Cada
        mudança no campo Peso vira o registro do dia.
      </p>
    </div>
  );
}
