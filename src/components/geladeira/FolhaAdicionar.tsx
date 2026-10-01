import { CalendarDaysIcon, HashtagIcon, QrCodeIcon, TrashIcon } from '@heroicons/react/24/outline';
import { prazoPadraoDias } from '../../lib/prazos';
import { nomeItem } from '../../lib/format';

/**
 * Folha de adicionar item. Saiu do topo da tela (onde ocupava espaço mesmo quando não
 * estava em uso) para o botão flutuante: guardar compra é uma rajada de vários itens,
 * e a folha mantém o foco no campo entre um e outro.
 */
export default function FolhaAdicionar({
  texto,
  onTexto,
  quantidade,
  onQuantidade,
  validade,
  validadeAutomatica,
  onValidade,
  sugestoes,
  onEscanear,
  onLimpar,
  onFechar,
  onAdicionar,
}: {
  texto: string;
  onTexto: (v: string) => void;
  quantidade: string;
  onQuantidade: (v: string) => void;
  validade: string;
  validadeAutomatica: boolean;
  onValidade: (v: string) => void;
  sugestoes: { itemKey: string; nome: string }[];
  onEscanear: () => void;
  onLimpar: () => void;
  onFechar: () => void;
  onAdicionar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-stone-900/50 p-4" onClick={onFechar}>
      <form
        className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) onAdicionar();
        }}
      >
        <p className="text-base font-bold">Adicionar à despensa</p>

        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            placeholder="ex.: cebola, ovo…"
            list="ingredientes-biblioteca"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={onEscanear}
            aria-label="Ler código de barras do produto"
            title="Código de barras"
            className="btn-icon shrink-0"
          >
            <QrCodeIcon className="size-5" />
          </button>
        </div>
        <datalist id="ingredientes-biblioteca">
          {sugestoes.map((s) => (
            <option key={s.itemKey} value={s.nome} />
          ))}
        </datalist>

        <div className="flex items-center gap-2">
          <HashtagIcon className="size-5 shrink-0 text-stone-400 dark:text-stone-500" />
          <input
            className="input w-20 shrink-0"
            inputMode="decimal"
            placeholder="ex.: 4"
            aria-label="Quantidade (opcional)"
            value={quantidade}
            onChange={(e) => onQuantidade(e.target.value)}
          />
          <CalendarDaysIcon className="size-5 shrink-0 text-stone-400 dark:text-stone-500" />
          <input
            type="date"
            className={`input min-w-0 flex-1 text-sm ${
              validadeAutomatica && validade ? 'text-stone-500 dark:text-stone-400' : ''
            }`}
            value={validade}
            onChange={(e) => onValidade(e.target.value)}
            aria-label="Validade (opcional, sugerida pelo tipo do item)"
            title={
              validadeAutomatica && texto.trim() && prazoPadraoDias(texto) !== undefined
                ? `Sugestão: ${prazoPadraoDias(texto)} dias para ${nomeItem(texto)}`
                : 'Validade (opcional)'
            }
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLimpar}
            aria-label="Limpar campos"
            title="Limpar campos"
            className="btn-icon shrink-0 text-red-500 dark:text-red-400"
          >
            <TrashIcon className="size-5" />
          </button>
          <button type="submit" disabled={!texto.trim()} className="btn-primary flex-1">
            Adicionar
          </button>
        </div>
      </form>
    </div>
  );
}
