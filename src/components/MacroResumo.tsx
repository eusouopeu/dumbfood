// Seletor de dieta + card de composição de macros, reutilizado nas abas Semana,
// Mercado e Histórico.

import { DIETA_ORDEM, DIETAS, composicaoRelativa, type Dieta, type GramasMacro } from '../lib/diet';

// Cores vivas, usadas onde precisa de contraste forte (ex.: preenchimento do gráfico de barras).
export const CORES_MACRO = {
  carboidrato: '#a855f7',
  proteina: '#0ea5e9',
  gordura: '#eab308',
};

// Tons pastéis para as tags de macro nos cards de resumo (fundo claro + texto na mesma cor).
const MACRO_TAG_ESTILO = {
  carboidrato: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  proteina: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  gordura: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
};

export function SeletorDieta({ dieta, onChange }: { dieta: Dieta; onChange: (d: Dieta) => void }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
      {DIETA_ORDEM.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-md px-2 py-1 font-semibold ${dieta === d ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          {DIETAS[d].label}
        </button>
      ))}
    </div>
  );
}

export type ValoresMacro = GramasMacro;

function MacroTag({
  rotulo,
  atual,
  meta,
  estilo,
}: {
  rotulo: string;
  atual: number;
  meta: number;
  estilo: string;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}>
      {rotulo}: {atual}%
      <span className="ml-1 font-normal opacity-70">(meta {meta}%)</span>
    </span>
  );
}

function MetaTag({ rotulo, meta, estilo }: { rotulo: string; meta: number; estilo: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}>
      {rotulo}: {meta}%
    </span>
  );
}

function ProgressoTag({ rotulo, progresso, estilo }: { rotulo: string; progresso: number; estilo: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}>
      {rotulo}: {progresso}%
    </span>
  );
}

/**
 * Composição de macros em percentual do total de gramas (proteína + carboidrato +
 * gordura), com a meta da dieta escolhida ao lado para comparação. Sempre relativo:
 * os percentuais somam 100 e não dependem de quantas porções ou pessoas a lista cobre.
 */
export function MacroResumoCard({
  titulo,
  real,
  dieta,
  mostrarProgressoMeta,
}: {
  titulo: string;
  real: ValoresMacro;
  dieta: Dieta;
  /** Em vez de mostrar a composição atual junto da meta, mostra só a meta e, abaixo,
   *  quanto da meta já foi cumprido (real/meta * 100) — usado no plano da semana. */
  mostrarProgressoMeta?: boolean;
}) {
  const pct = composicaoRelativa(real);
  const meta = DIETAS[dieta];
  const semDados = pct.proteina + pct.carboidrato + pct.gorduraTotal === 0;

  return (
    <div>
      {titulo && <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">{titulo}</p>}
      {semDados ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">Sem ingredientes com quantidade estimável ainda.</p>
      ) : mostrarProgressoMeta ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <MetaTag rotulo="Carb." meta={meta.carboidrato} estilo={MACRO_TAG_ESTILO.carboidrato} />
            <MetaTag rotulo="Prot." meta={meta.proteina} estilo={MACRO_TAG_ESTILO.proteina} />
            <MetaTag rotulo="Gord." meta={meta.gorduraTotal} estilo={MACRO_TAG_ESTILO.gordura} />
          </div>
          <p className="mb-1.5 mt-3 text-xs font-medium text-stone-500 dark:text-stone-400">Cumprimento da meta</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ProgressoTag
              rotulo="Carb."
              progresso={meta.carboidrato > 0 ? Math.round((pct.carboidrato / meta.carboidrato) * 100) : 0}
              estilo={MACRO_TAG_ESTILO.carboidrato}
            />
            <ProgressoTag
              rotulo="Prot."
              progresso={meta.proteina > 0 ? Math.round((pct.proteina / meta.proteina) * 100) : 0}
              estilo={MACRO_TAG_ESTILO.proteina}
            />
            <ProgressoTag
              rotulo="Gord."
              progresso={meta.gorduraTotal > 0 ? Math.round((pct.gorduraTotal / meta.gorduraTotal) * 100) : 0}
              estilo={MACRO_TAG_ESTILO.gordura}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <MacroTag rotulo="Carb." atual={pct.carboidrato} meta={meta.carboidrato} estilo={MACRO_TAG_ESTILO.carboidrato} />
          <MacroTag rotulo="Prot." atual={pct.proteina} meta={meta.proteina} estilo={MACRO_TAG_ESTILO.proteina} />
          <MacroTag rotulo="Gord." atual={pct.gorduraTotal} meta={meta.gorduraTotal} estilo={MACRO_TAG_ESTILO.gordura} />
        </div>
      )}
    </div>
  );
}
