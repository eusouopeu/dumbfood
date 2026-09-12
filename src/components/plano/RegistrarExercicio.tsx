// Folha de registro de exercício: nome, calorias queimadas e, opcionalmente, minutos.
//
// Entrada manual porque o app não fala com relógio nem com sensor. O número serve para
// o dia fechar ("comi 2.400, queimei 300"), e não para mexer na meta — o fator de
// atividade do perfil já conta o gasto habitual (ver lib/exercicios.ts).

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function RegistrarExercicio({
  onRegistrar,
  onFechar,
}: {
  onRegistrar: (dados: { nome: string; kcal: number; minutos?: number }) => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [kcal, setKcal] = useState('');
  const [minutos, setMinutos] = useState('');

  const kcalNum = Number(kcal.replace(',', '.'));
  const valido = nome.trim().length > 0 && Number.isFinite(kcalNum) && kcalNum > 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <form
        className="w-full max-w-2xl space-y-3 rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          const min = Number(minutos.replace(',', '.'));
          onRegistrar({
            nome: nome.trim(),
            kcal: Math.round(kcalNum),
            ...(Number.isFinite(min) && min > 0 ? { minutos: Math.round(min) } : {}),
          });
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="section-heading flex-1 text-sm">Registrar exercício</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="btn-icon p-2">
            <XMarkIcon className="size-4" />
          </button>
        </div>

        <input
          className="input w-full"
          placeholder="Ex.: corrida, musculação…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            inputMode="numeric"
            placeholder="kcal queimadas"
            aria-label="Calorias queimadas"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
          <input
            className="input w-28 shrink-0"
            inputMode="numeric"
            placeholder="min"
            aria-label="Minutos (opcional)"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
          />
        </div>

        <button type="submit" disabled={!valido} className="btn-primary w-full">
          Registrar
        </button>
      </form>
    </div>
  );
}
