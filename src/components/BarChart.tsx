// Gráfico de barras simples, sem dependências externas, para as visões do histórico.

interface Ponto {
  label: string;
  total: number;
}

export default function BarChart({
  dados,
  cor = '#f97316',
  formatar = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
  linhaReferencia,
  rotuloReferencia,
  destaque,
  corDestaque = '#22c55e',
}: {
  dados: Ponto[];
  cor?: string;
  formatar?: (n: number) => string;
  /** Valor opcional (ex.: orçamento) desenhado como linha tracejada de referência. */
  linhaReferencia?: number;
  rotuloReferencia?: string;
  /** Índice da barra do "agora" (dia atual), pintada à parte e com marcador embaixo. */
  destaque?: number;
  corDestaque?: string;
}) {
  if (dados.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">Sem dados suficientes para o gráfico.</p>;
  }

  const largura = 320;
  const altura = 148;
  const padInferior = 20;
  const max = Math.max(...dados.map((d) => d.total), linhaReferencia ?? 0, 1);
  const larguraBarra = largura / dados.length;
  const areaUtil = altura - padInferior - 16;
  const yRef = linhaReferencia != null ? altura - padInferior - (linhaReferencia / max) * areaUtil : null;

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label="Gráfico de barras">
      {dados.map((d, i) => {
        const h = Math.max(2, (d.total / max) * areaUtil);
        const x = i * larguraBarra + larguraBarra * 0.15;
        const w = larguraBarra * 0.7;
        const y = altura - padInferior - h;
        const ehDestaque = i === destaque;
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${formatar(d.total)}`}</title>
            <rect x={x} y={y} width={w} height={h} rx={3} fill={ehDestaque ? corDestaque : cor} />
            <text
              x={x + w / 2}
              y={altura - padInferior + 12}
              fontSize="8"
              textAnchor="middle"
              fill={ehDestaque ? corDestaque : '#78716c'}
              fontWeight={ehDestaque ? 700 : 400}
            >
              {d.label}
            </text>
            {/* Triângulo sob a barra de hoje: o rótulo em negrito some no meio de sete
                colunas iguais, o marcador não. */}
            {ehDestaque && (
              <polygon
                points={`${x + w / 2 - 3},${altura - padInferior + 16} ${x + w / 2 + 3},${altura - padInferior + 16} ${x + w / 2},${altura - padInferior + 20}`}
                fill={corDestaque}
              />
            )}
          </g>
        );
      })}
      {yRef !== null && (
        <g>
          <title>{rotuloReferencia ?? formatar(linhaReferencia!)}</title>
          <line x1={0} y1={yRef} x2={largura} y2={yRef} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 3" />
        </g>
      )}
    </svg>
  );
}
