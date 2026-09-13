// Botão flutuante da lista de mercado, no mesmo lugar do da geladeira.
//
// Importar a nota e adicionar item à mão ocupavam uma fileira de botões e um card no
// topo da lista, empurrando os itens para baixo. São ações ocasionais: abrem a partir do
// "+" como dois cards, e o "adicionar item" vira folha.

import { useState } from 'react';
import { CameraIcon, PencilSquareIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AbasMercado from '../AbasMercado';

export default function FabLista({
  onImportarNota,
  onAdicionarItem,
}: {
  onImportarNota: () => void;
  onAdicionarItem: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
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
      {aberto && (
        <div className="fixed inset-0 z-20 bg-stone-900/30" onClick={() => setAberto(false)} aria-hidden />
      )}

      <div className="fixed bottom-[4.9rem] right-4 z-30 flex flex-col items-end gap-2">
        {aberto && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => {
                setAberto(false);
                onImportarNota();
              }}
              className="card flex items-center gap-2 px-4 py-3 text-sm font-semibold shadow-lg"
            >
              <CameraIcon className="size-5 text-brand-500" />
              Importar nota fiscal
            </button>
            <button
              onClick={() => {
                setAberto(false);
                setAdicionando(true);
              }}
              className="card flex items-center gap-2 px-4 py-3 text-sm font-semibold shadow-lg"
            >
              <PencilSquareIcon className="size-5 text-brand-500" />
              Adicionar item
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <AbasMercado />
          <button
            onClick={() => setAberto((v) => !v)}
            aria-label={aberto ? 'Fechar ações' : 'Ações da lista'}
            aria-expanded={aberto}
            title="Ações da lista"
            className="flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg"
          >
            {aberto ? <XMarkIcon className="size-7" /> : <PlusIcon className="size-7" />}
          </button>
        </div>
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
