// Resumo do produto logo após a leitura do código de barras: kcal da porção e quatro
// anéis (gordura, proteína, carboidrato, fibra) contra a meta do dia. A nota vem logo
// abaixo, dos selos (rating.ts, por 100 g).

import { useMetaDiaria } from '../lib/metas';
import { vereditoProduto, type ChaveAnel } from '../lib/veredito';
import type { Nutrientes100g } from '../lib/nutrition';
import { CORES_MACRO } from './MacroResumo';

const COR: Record<ChaveAnel, string> = {
  gorduraTotal: CORES_MACRO.gordura,
  proteina: CORES_MACRO.proteina,
  carboidrato: CORES_MACRO.carboidrato,
  fibra: '#16a34a',
};

const RAIO = 15;
const CIRC = 2 * Math.PI * RAIO;

export default function VereditoProduto({ nutrientes, porcaoG }: { nutrientes: Nutrientes100g; porcaoG?: number }) {
  const meta = useMetaDiaria();
  const v = vereditoProduto(nutrientes, porcaoG, meta);
  const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');

  return (
    <div className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-900/40">
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{Math.round(v.kcal).toLocaleString('pt-BR')}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          kcal por porção de {fmt(v.porcaoG)} g{porcaoG ? '' : ' (rótulo sem porção)'}
        </span>
      </p>
      <div className="grid grid-cols-4 gap-1 text-center">
        {v.aneis.map((a) => (
          <div key={a.chave}>
            <svg viewBox="0 0 40 40" className="mx-auto size-12" role="img" aria-label={`${a.rotulo}: ${fmt(a.gramas)} g, ${Math.round(a.fracao * 100)}% da meta do dia`}>
              <circle cx={20} cy={20} r={RAIO} fill="none" strokeWidth={4} className="stroke-stone-200 dark:stroke-stone-700" />
              {a.fracao > 0 && (
                <circle
                  cx={20}
                  cy={20}
                  r={RAIO}
                  fill="none"
                  strokeWidth={4}
                  strokeLinecap="round"
                  stroke={COR[a.chave]}
                  strokeDasharray={`${CIRC * Math.min(1, a.fracao)} ${CIRC}`}
                  transform="rotate(-90 20 20)"
                />
              )}
              <text x={20} y={23} textAnchor="middle" className="fill-current text-[10px] font-semibold">
                {Math.round(a.fracao * 100)}%
              </text>
            </svg>
            <p className="text-[11px] font-semibold">{a.rotulo}</p>
            <p className="text-[11px] tabular-nums text-stone-500 dark:text-stone-400">{fmt(a.gramas)} g</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-stone-400 dark:text-stone-500">Anéis: quanto a porção ocupa da sua meta do dia.</p>
    </div>
  );
}
