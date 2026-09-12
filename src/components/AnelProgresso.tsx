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

/** Um dos números laterais do anel; com `onClick` vira botão (ex.: registrar exercício). */
interface Lateral {
  label: string;
  valor: string;
  onClick?: () => void;
}

function Numero({ dados }: { dados: Lateral }) {
  const conteudo = (
    <>
      <p className="truncate text-xs text-stone-500 dark:text-stone-400">{dados.label}</p>
      <p className="text-xl font-bold tabular-nums">{dados.valor}</p>
    </>
  );
  if (!dados.onClick) return <div className="min-w-0 flex-1 text-center">{conteudo}</div>;
  return (
    <button type="button" onClick={dados.onClick} className="min-w-0 flex-1 text-center">
      {conteudo}
    </button>
  );
}

export default function AnelProgresso({
  consumido,
  meta,
  esquerda,
  direita,
}: {
  consumido: number;
  meta: number;
  esquerda?: Lateral;
  direita?: Lateral;
}) {
  const proporcao = meta > 0 ? Math.min(1, consumido / meta) : 0;
  const estourou = meta > 0 && consumido > meta;
  const preenchido = CIRCUNFERENCIA * FRACAO_ARCO * proporcao;

  return (
    <div className="flex items-center justify-between gap-2">
      {esquerda && <Numero dados={esquerda} />}

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
        {/* O número grande é o que já foi comido — é o que muda a cada registro. Quanto
            ainda cabe fica logo abaixo, contra a meta, sem trocar o protagonista. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-3xl font-bold tabular-nums ${estourou ? 'text-red-600 dark:text-red-400' : ''}`}>
            {Math.round(consumido).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">Consumidos</p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            {estourou
              ? `${Math.round(consumido - meta).toLocaleString('pt-BR')} acima da meta`
              : `Meta: ${Math.round(meta).toLocaleString('pt-BR')}`}
          </p>
        </div>
      </div>

      {direita && <Numero dados={direita} />}
    </div>
  );
}
