// Adição rápida: digitar o que comeu e cair direto na busca, na refeição da hora.
// Fica flutuando acima da barra de navegação para estar à mão em qualquer rolagem.

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import BotaoFome from './BotaoFome';

export default function BarraRapida({ onEnviar }: { onEnviar: (texto: string) => void }) {
  const [rapido, setRapido] = useState('');
  return (
    <>
      <form
        className="fixed inset-x-0 bottom-[4.9rem] z-20 mx-auto flex max-w-2xl px-3"
        onSubmit={(e) => {
          e.preventDefault();
          const texto = rapido.trim();
          if (!texto) return;
          onEnviar(texto);
          setRapido('');
        }}
      >
        <div className="flex w-full items-center gap-2 rounded-full border border-white/60 bg-white/60 py-0.5 pl-5 pr-1 shadow-lg backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/60">
          <input
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-stone-500"
            placeholder="inserir refeição…"
            aria-label="Adicionar o que comeu"
            value={rapido}
            onChange={(e) => setRapido(e.target.value)}
          />
          <button
            type="submit"
            disabled={!rapido.trim()}
            aria-label="Adicionar"
            title="Adicionar"
            className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-stone-700 disabled:opacity-40 dark:text-stone-200"
          >
            <PlusIcon className="size-6" />
          </button>
          <BotaoFome />
        </div>
      </form>
      {/* Espaço para a barra flutuante não cobrir o jantar. */}
      <div aria-hidden className="h-12" />
    </>
  );
}
