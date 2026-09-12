// Barra de um macro contra a meta do dia, com estado de excesso.
//
// A barra neutra ("73 de 132 g") só informa; o que muda comportamento é o vermelho de
// quem passou do teto. Por isso o estouro pinta a barra inteira e os números, e não só
// a pontinha que passou — é para ser visto sem procurar.

export type EstadoMeta = 'baixo' | 'ok' | 'estourado';

export function estadoDaMeta(atual: number, meta: number): EstadoMeta {
  if (meta <= 0) return 'baixo';
  if (atual > meta * 1.05) return 'estourado';
  if (atual >= meta * 0.9) return 'ok';
  return 'baixo';
}

const CLASSES: Record<EstadoMeta, { barra: string; texto: string }> = {
  baixo: { barra: 'bg-brand-400 dark:bg-brand-500', texto: 'text-stone-500 dark:text-stone-400' },
  ok: { barra: 'bg-green-500', texto: 'text-green-600 dark:text-green-400' },
  estourado: { barra: 'bg-red-500', texto: 'text-red-600 dark:text-red-400' },
};

export default function BarraMacro({
  rotulo,
  atual,
  meta,
  unidade = 'g',
  cor,
}: {
  rotulo: string;
  atual: number;
  meta: number;
  unidade?: string;
  /** Cor fixa da barra (usada quando o macro tem cor própria); o estouro sempre vence. */
  cor?: string;
}) {
  const estado = estadoDaMeta(atual, meta);
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  const classes = CLASSES[estado];
  const usarCorPropria = cor && estado !== 'estourado';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-300">{rotulo}</span>
        <span className={`tabular-nums font-semibold ${classes.texto}`}>
          {Math.round(atual).toLocaleString('pt-BR')} / {Math.round(meta).toLocaleString('pt-BR')}
          {unidade}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
        <div
          className={`h-full rounded-full ${usarCorPropria ? '' : classes.barra}`}
          style={{ width: `${pct}%`, ...(usarCorPropria ? { backgroundColor: cor } : {}) }}
        />
      </div>
    </div>
  );
}
