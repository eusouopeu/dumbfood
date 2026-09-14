// Card de composição de macros, reutilizado nas abas Semana, Mercado e Histórico.

import { composicaoRelativa, type GramasMacro } from '../lib/diet';
import { barrasSemana, useMetaDiaria, type MetaMacrosPct } from '../lib/metas';
import BarraMacro from './BarraMacro';

// Cores vivas, usadas onde precisa de contraste forte (ex.: preenchimento do gráfico de barras).
export const CORES_MACRO = {
  carboidrato: '#a855f7',
  proteina: '#0ea5e9',
  gordura: '#eab308',
};

// Cor de cada macro nas linhas da tabela (pastilha + texto), nos dois temas.
const MACRO_ESTILO = {
  carboidrato: { ponto: 'bg-purple-500', texto: 'text-purple-700 dark:text-purple-300' },
  proteina: { ponto: 'bg-sky-500', texto: 'text-sky-700 dark:text-sky-300' },
  gordura: { ponto: 'bg-yellow-500', texto: 'text-yellow-700 dark:text-yellow-300' },
};

export type ValoresMacro = GramasMacro;

function LinhaMacro({
  rotulo,
  atual,
  meta,
  estilo,
}: {
  rotulo: string;
  atual: number;
  meta: number;
  estilo: { ponto: string; texto: string };
}) {
  return (
    <tr className="border-t border-stone-100 dark:border-stone-700">
      <th scope="row" className={`py-1.5 pr-2 text-left font-semibold ${estilo.texto}`}>
        <span className={`mr-1.5 inline-block size-2 rounded-full align-middle ${estilo.ponto}`} />
        {rotulo}
      </th>
      <td className="py-1.5 text-right font-semibold tabular-nums">{atual}%</td>
      <td className="py-1.5 text-right tabular-nums text-stone-500 dark:text-stone-400">{meta}%</td>
    </tr>
  );
}

/**
 * Composição de macros em percentual do total de gramas (proteína + carboidrato +
 * gordura), com a meta do perfil ao lado para comparação. Sempre relativo: os
 * percentuais somam 100 e não dependem de quantas porções ou pessoas a lista cobre.
 *
 * Em tabela, e não em tags soltas: são três pares de números comparáveis entre si, e a
 * coluna alinhada mostra de relance qual macro está longe da meta.
 */
export function MacroResumoCard({ titulo, real, meta }: { titulo: string; real: ValoresMacro; meta: MetaMacrosPct }) {
  const pct = composicaoRelativa(real);
  const semDados = pct.proteina + pct.carboidrato + pct.gorduraTotal === 0;

  if (semDados) {
    return (
      <div>
        {titulo && <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">{titulo}</p>}
        <p className="text-sm text-stone-400 dark:text-stone-500">Sem ingredientes com quantidade estimável ainda.</p>
      </div>
    );
  }

  return (
    <div>
      {titulo && <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">{titulo}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
            <th scope="col" className="pb-1 text-left font-medium">
              Macro
            </th>
            <th scope="col" className="pb-1 text-right font-medium">
              Atual
            </th>
            <th scope="col" className="pb-1 text-right font-medium">
              Meta
            </th>
          </tr>
        </thead>
        <tbody>
          <LinhaMacro rotulo="Carb." atual={pct.carboidrato} meta={meta.carboidrato} estilo={MACRO_ESTILO.carboidrato} />
          <LinhaMacro rotulo="Prot." atual={pct.proteina} meta={meta.proteina} estilo={MACRO_ESTILO.proteina} />
          <LinhaMacro rotulo="Gord." atual={pct.gorduraTotal} meta={meta.gorduraTotal} estilo={MACRO_ESTILO.gordura} />
        </tbody>
      </table>
    </div>
  );
}

const COR_BARRA: Record<keyof GramasMacro, string> = {
  carboidrato: CORES_MACRO.carboidrato,
  proteina: CORES_MACRO.proteina,
  gorduraTotal: CORES_MACRO.gordura,
};

/**
 * Macros em barras, no mesmo desenho do painel do dia: nome com o percentual do perfil,
 * gramas atuais contra a meta do perfil levada para a semana. Serve às abas Semana e
 * Mercado — plano e lista cobrem sete dias.
 */
export function MacroBarrasCard({ real }: { real: ValoresMacro }) {
  const meta = useMetaDiaria();
  return (
    <div className="space-y-2">
      {barrasSemana(real, meta).map((b) => (
        <BarraMacro
          key={b.chave}
          rotulo={`${b.rotulo} · ${b.pct}%`}
          atual={b.atual}
          meta={b.metaSemanal}
          cor={COR_BARRA[b.chave]}
        />
      ))}
    </div>
  );
}
