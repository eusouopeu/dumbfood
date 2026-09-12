// Rosca de composição de macros, para comparar meta e realizado lado a lado.
//
// Duas roscas do mesmo tamanho respondem "estou na dieta que escolhi?" mais rápido que
// duas colunas de número: a diferença aparece como um pedaço de cor maior ou menor, e
// não como dois inteiros que é preciso subtrair de cabeça.

import { CORES_MACRO } from './MacroResumo';

export interface FatiasMacro {
  carboidrato: number;
  proteina: number;
  gorduraTotal: number;
}

const SEGMENTOS: { chave: keyof FatiasMacro; cor: string; nome: string }[] = [
  { chave: 'carboidrato', cor: CORES_MACRO.carboidrato, nome: 'Carboidratos' },
  { chave: 'proteina', cor: CORES_MACRO.proteina, nome: 'Proteínas' },
  { chave: 'gorduraTotal', cor: CORES_MACRO.gordura, nome: 'Gorduras' },
];

const RAIO = 40;
const CIRC = 2 * Math.PI * RAIO;

export default function RoscaMacro({ titulo, fatias }: { titulo: string; fatias: FatiasMacro }) {
  const total = fatias.carboidrato + fatias.proteina + fatias.gorduraTotal;

  if (total <= 0) {
    return (
      <div className="text-center">
        <p className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">{titulo}</p>
        <p className="py-8 text-xs text-stone-400 dark:text-stone-500">Sem dados</p>
      </div>
    );
  }

  let acumulado = 0;
  return (
    <div className="text-center">
      <p className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">{titulo}</p>
      <svg viewBox="0 0 100 100" className="mx-auto size-24" role="img" aria-label={titulo}>
        <g transform="rotate(-90 50 50)">
          {SEGMENTOS.map((seg) => {
            const fracao = fatias[seg.chave] / total;
            const traco = CIRC * fracao;
            const circulo = (
              <circle
                key={seg.chave}
                cx={50}
                cy={50}
                r={RAIO}
                fill="none"
                stroke={seg.cor}
                strokeWidth={12}
                strokeDasharray={`${traco} ${CIRC - traco}`}
                strokeDashoffset={-CIRC * acumulado}
              >
                <title>{`${seg.nome}: ${Math.round(fracao * 100)}%`}</title>
              </circle>
            );
            acumulado += fracao;
            return circulo;
          })}
        </g>
      </svg>
      <ul className="mt-1 space-y-0.5 text-[11px] text-stone-600 dark:text-stone-300">
        {SEGMENTOS.map((seg) => (
          <li key={seg.chave} className="flex items-center justify-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: seg.cor }} />
            <span className="tabular-nums font-semibold">{Math.round((fatias[seg.chave] / total) * 100)}%</span>
            <span className="text-stone-400 dark:text-stone-500">{seg.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
