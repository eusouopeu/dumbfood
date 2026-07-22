// Gráfico de barras empilhadas (percentual) para a composição de macros ao longo do tempo.

import { CORES_MACRO } from './MacroResumo';

interface PontoMacro {
  label: string;
  carboidrato: number;
  proteina: number;
  gordura: number;
}

const SEGMENTOS: { chave: keyof Omit<PontoMacro, 'label'>; cor: string; nome: string }[] = [
  { chave: 'carboidrato', cor: CORES_MACRO.carboidrato, nome: 'Carboidratos' },
  { chave: 'proteina', cor: CORES_MACRO.proteina, nome: 'Proteínas' },
  { chave: 'gordura', cor: CORES_MACRO.gordura, nome: 'Gorduras' },
];

export default function StackedBarChart({ dados }: { dados: PontoMacro[] }) {
  if (dados.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-400">Sem dados suficientes para o gráfico.</p>;
  }

  const largura = 320;
  const altura = 150;
  const padInferior = 20;
  const alturaUtil = altura - padInferior - 4;
  const larguraBarra = largura / dados.length;

  return (
    <div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label="Gráfico de barras empilhadas de macros">
        {dados.map((d, i) => {
          const total = d.carboidrato + d.proteina + d.gordura || 1;
          const x = i * larguraBarra + larguraBarra * 0.15;
          const w = larguraBarra * 0.7;
          let yAtual = altura - padInferior;
          return (
            <g key={d.label + i}>
              <title>{`${d.label}: Carboidratos ${d.carboidrato}% · Proteínas ${d.proteina}% · Gorduras ${d.gordura}%`}</title>
              {SEGMENTOS.map((seg) => {
                const valor = d[seg.chave];
                const h = (valor / total) * alturaUtil;
                yAtual -= h;
                return <rect key={seg.chave} x={x} y={yAtual} width={w} height={h} fill={seg.cor} />;
              })}
              <text x={x + w / 2} y={altura - padInferior + 12} fontSize="8" textAnchor="middle" fill="#78716c">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-stone-600">
        {SEGMENTOS.map((seg) => (
          <span key={seg.chave} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.cor }} />
            {seg.nome}
          </span>
        ))}
      </div>
    </div>
  );
}
