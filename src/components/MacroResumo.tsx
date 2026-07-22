// Seletor de dieta + card de resumo de macros/calorias (valor real / valor ideal),
// reutilizado nas abas Semana, Mercado e Histórico.

import { DIETA_ORDEM, DIETAS, type Dieta } from '../lib/diet';

export const CORES_MACRO = {
  carboidrato: '#a855f7',
  proteina: '#0ea5e9',
  gordura: '#eab308',
};

export function SeletorDieta({ dieta, onChange }: { dieta: Dieta; onChange: (d: Dieta) => void }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs">
      {DIETA_ORDEM.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-md px-2 py-1 font-semibold ${dieta === d ? 'bg-white shadow-sm' : 'text-stone-500'}`}
        >
          {DIETAS[d].label}
        </button>
      ))}
    </div>
  );
}

export interface ValoresMacro {
  kcal: number;
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
}

/** Card com calorias (negrito) e macros (tags coloridas, por extenso), cada um "real / ideal" conforme a dieta. */
export function MacroResumoCard({ titulo, real, ideal }: { titulo: string; real: ValoresMacro; ideal: ValoresMacro }) {
  const r = (n: number) => Math.round(n).toLocaleString('pt-BR');
  return (
    <div>
      {titulo && <p className="mb-1.5 text-xs font-medium text-stone-500">{titulo}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold">
          {r(real.kcal)} / {r(ideal.kcal)} kcal
        </span>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: CORES_MACRO.carboidrato }}>
          Carboidratos: {r(real.carboidrato)} / {r(ideal.carboidrato)} g
        </span>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: CORES_MACRO.proteina }}>
          Proteínas: {r(real.proteina)} / {r(ideal.proteina)} g
        </span>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: CORES_MACRO.gordura }}>
          Gorduras: {r(real.gorduraTotal)} / {r(ideal.gorduraTotal)} g
        </span>
      </div>
    </div>
  );
}
