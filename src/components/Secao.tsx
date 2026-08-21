// Seção minimizável (estilo "toggle list" do Notion), usada na tela da receita.
// O estado de aberto/fechado é por seção e persiste entre receitas: quem nunca olha a
// tabela nutricional fecha uma vez e ela continua fechada nas próximas receitas.

import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const KEY = 'dumbfood:secoesAbertas';

function lerEstado(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function gravarEstado(chave: string, aberta: boolean): void {
  const atual = lerEstado();
  localStorage.setItem(KEY, JSON.stringify({ ...atual, [chave]: aberta }));
}

export default function Secao({
  chave,
  titulo,
  subtitulo,
  padraoAberta = true,
  children,
}: {
  /** Identificador estável da seção, usado para lembrar se ela está aberta. */
  chave: string;
  titulo: string;
  subtitulo?: string;
  padraoAberta?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState<boolean>(() => lerEstado()[chave] ?? padraoAberta);

  function alternar() {
    setAberta((v) => {
      gravarEstado(chave, !v);
      return !v;
    });
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <ChevronDownIcon
          className={`size-4 flex-shrink-0 text-stone-400 transition-transform dark:text-stone-500 ${aberta ? '' : '-rotate-90'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="section-heading block">{titulo}</span>
          {subtitulo && <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{subtitulo}</span>}
        </span>
      </button>
      {aberta && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
