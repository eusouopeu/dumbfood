// Anel de progresso do dia: quanto já foi comido em relação à meta de calorias.
//
// Em anel, e não em barra, porque é o número que abre a tela: o vazio do arco é a
// pergunta ("quanto ainda cabe?") e o preenchido é a resposta, sem precisar ler rótulo.
// O arco começa às 9 horas e vai até as 3 horas (270°), deixando a base livre para os
// números de consumido e queimado nas laterais.

const RAIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
/** Fração do círculo efetivamente usada pelo arco (270° de 360°). */
const FRACAO_ARCO = 0.75;

export default function AnelProgresso({
  consumido,
  meta,
  esquerda,
  direita,
}: {
  consumido: number;
  meta: number;
  esquerda?: { label: string; valor: string };
  direita?: { label: string; valor: string };
}) {
  const proporcao = meta > 0 ? Math.min(1, consumido / meta) : 0;
  const estourou = meta > 0 && consumido > meta;
  const restante = Math.max(0, Math.round(meta - consumido));
  const preenchido = CIRCUNFERENCIA * FRACAO_ARCO * proporcao;

  return (
    <div className="flex items-center justify-between gap-2">
      {esquerda && (
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{esquerda.label}</p>
          <p className="text-xl font-bold tabular-nums">{esquerda.valor}</p>
        </div>
      )}

      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 128 128" className="size-36" role="img" aria-label={`${Math.round(consumido)} de ${meta} kcal`}>
          <g transform="rotate(135 64 64)">
            <circle
              cx={64}
              cy={64}
              r={RAIO}
              fill="none"
              strokeWidth={10}
              strokeLinecap="round"
              className="stroke-stone-200 dark:stroke-stone-700"
              strokeDasharray={`${CIRCUNFERENCIA * FRACAO_ARCO} ${CIRCUNFERENCIA}`}
            />
            {/* Sem nada consumido o arco não é desenhado: com comprimento zero, a ponta
                arredondada vira um ponto solto no começo do anel. */}
            {preenchido > 0 && (
              <circle
                cx={64}
                cy={64}
                r={RAIO}
                fill="none"
                strokeWidth={10}
                strokeLinecap="round"
                className={estourou ? 'stroke-red-500' : 'stroke-brand-500'}
                strokeDasharray={`${preenchido} ${CIRCUNFERENCIA}`}
              />
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-stone-500 dark:text-stone-400">{estourou ? 'Passou' : 'Restam'}</p>
          <p className={`text-3xl font-bold tabular-nums ${estourou ? 'text-red-600 dark:text-red-400' : ''}`}>
            {estourou ? Math.round(consumido - meta).toLocaleString('pt-BR') : restante.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500">Meta {Math.round(meta).toLocaleString('pt-BR')} kcal</p>
        </div>
      </div>

      {direita && (
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{direita.label}</p>
          <p className="text-xl font-bold tabular-nums">{direita.valor}</p>
        </div>
      )}
    </div>
  );
}
