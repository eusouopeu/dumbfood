// Gráfico de barras simples, sem dependências externas, para as visões do histórico.

interface Ponto {
  label: string;
  total: number;
}

export default function BarChart({
  dados,
  cor = '#f97316',
  formatar = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
}: {
  dados: Ponto[];
  cor?: string;
  formatar?: (n: number) => string;
}) {
  if (dados.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-400">Sem dados suficientes para o gráfico.</p>;
  }

  const largura = 320;
  const altura = 140;
  const padInferior = 20;
  const max = Math.max(...dados.map((d) => d.total), 1);
  const larguraBarra = largura / dados.length;

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label="Gráfico de barras">
      {dados.map((d, i) => {
        const h = Math.max(2, (d.total / max) * (altura - padInferior - 16));
        const x = i * larguraBarra + larguraBarra * 0.15;
        const w = larguraBarra * 0.7;
        const y = altura - padInferior - h;
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${formatar(d.total)}`}</title>
            <rect x={x} y={y} width={w} height={h} rx={3} fill={cor} />
            <text x={x + w / 2} y={altura - padInferior + 12} fontSize="8" textAnchor="middle" fill="#78716c">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
