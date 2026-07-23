// Seletor de dieta + card de resumo de macros/calorias (percentual da meta da dieta),
// reutilizado nas abas Semana, Mercado e Histórico.

import { DIETA_ORDEM, DIETAS, type Dieta } from '../lib/diet';

// Cores vivas, usadas onde precisa de contraste forte (ex.: preenchimento do gráfico de barras).
export const CORES_MACRO = {
  carboidrato: '#a855f7',
  proteina: '#0ea5e9',
  gordura: '#eab308',
};

// Tons pastéis para as tags de macro nos cards de resumo (fundo claro + texto na mesma cor).
const MACRO_TAG_ESTILO = {
  carboidrato: 'bg-purple-100 text-purple-700',
  proteina: 'bg-sky-100 text-sky-700',
  gordura: 'bg-yellow-100 text-yellow-800',
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

function percentual(real: number, ideal: number): number {
  return ideal > 0 ? Math.round((real / ideal) * 100) : 0;
}

/**
 * Card com o percentual da meta da dieta (calorias em negrito, macros abreviados em tags
 * pastéis). Sempre percentual — como as receitas nem sempre são feitas para uma pessoa só,
 * um valor absoluto de gramas/kcal não corresponderia à meta diária de ninguém em específico;
 * o percentual da meta se mantém interpretável independentemente de quantas porções/pessoas.
 */
export function MacroResumoCard({ titulo, real, ideal }: { titulo: string; real: ValoresMacro; ideal: ValoresMacro }) {
  return (
    <div>
      {titulo && <p className="mb-1.5 text-xs font-medium text-stone-500">{titulo}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold">{percentual(real.kcal, ideal.kcal)}% da meta calórica</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MACRO_TAG_ESTILO.carboidrato}`}>
          Carb.: {percentual(real.carboidrato, ideal.carboidrato)}%
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MACRO_TAG_ESTILO.proteina}`}>
          Prot.: {percentual(real.proteina, ideal.proteina)}%
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MACRO_TAG_ESTILO.gordura}`}>
          Gord.: {percentual(real.gorduraTotal, ideal.gorduraTotal)}%
        </span>
      </div>
    </div>
  );
}
