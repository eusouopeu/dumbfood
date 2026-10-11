// Botão flutuante da lista de mercado, no mesmo lugar do da despensa.
//
// "Adicionar item" à mão é ação ocasional: em vez de ocupar uma fileira de botões e um
// card no topo da lista (empurrando os itens para baixo), o "+" abre a folha direto —
// importar nota fiscal saiu daqui para o botão-ícone ao lado de "Salvar no histórico".

import { useState } from 'react';
import { PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import AbasMercado from '../AbasMercado';

export default function FabLista({
  onAdicionarItem,
  onArrumarComIA,
  arrumando = false,
}: {
  onAdicionarItem: (texto: string) => void;
  /** Só existe com a chave da IA cadastrada (Configurações). */
  onArrumarComIA?: () => void;
  arrumando?: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [texto, setTexto] = useState('');

  function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    onAdicionarItem(limpo);
    setTexto('');
    setAdicionando(false);
  }

  return (
    <>
      <div className="fixed bottom-[4.9rem] right-4 z-30 flex items-center gap-2">
        {onArrumarComIA && (
          <button
            onClick={onArrumarComIA}
            disabled={arrumando}
            aria-label="Arrumar quantidades com IA"
            title="Arrumar quantidades com IA"
            className={`flex size-11 items-center justify-center rounded-full border border-white/60 bg-white/60 text-brand-600 shadow-lg backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/60 dark:text-brand-300 ${arrumando ? 'animate-pulse' : ''}`}
          >
            <SparklesIcon className="size-5" />
          </button>
        )}
        <AbasMercado />
        <button
          onClick={() => setAdicionando(true)}
          aria-label="Adicionar item à lista"
          title="Adicionar item"
          className="flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg"
        >
          <PlusIcon className="size-7" />
        </button>
      </div>

      {adicionando && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-stone-900/50 p-4" onClick={() => setAdicionando(false)}>
          <form
            className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-800"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <p className="text-base font-bold">Adicionar à lista</p>
            <input
              className="input"
              placeholder='ex.: "2 kg de arroz"'
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!texto.trim()} className="btn-primary w-full">
              Adicionar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
