// Chip de um item da despensa: cor pela validade, quantidade quando se sabe.

import { CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adicionarNaGeladeira, removerDaGeladeira } from '../../db/repo';
import { statusValidade, rotuloValidade } from '../../lib/validade';
import { nomeItem } from '../../lib/format';
import { formatQtdUnidadeAbrev } from '../../lib/displayQty';
import { toast } from '../../lib/toast';
import { hapticLeve } from '../../lib/haptics';
import { useLongPress } from '../../lib/useLongPress';
import type { GeladeiraItem } from '../../types';

/** Classes de cor do chip conforme a proximidade da validade. */
const ESTILO_VALIDADE: Record<string, string> = {
  vencido: 'bg-red-600 dark:bg-red-700',
  vence_hoje: 'bg-amber-500 dark:bg-amber-600',
  proximo: 'bg-amber-500 dark:bg-amber-600',
  ok: 'bg-brand-500',
};

export default /** Chip de um item da geladeira: toque remove, toque longo abre o editor de validade. */
function ChipDespensa({ item: g, onEditarValidade }: { item: GeladeiraItem; onEditarValidade: () => void }) {
  const longPress = useLongPress(onEditarValidade);
  const status = g.validade ? statusValidade(g.validade) : null;
  const cor = status ? ESTILO_VALIDADE[status] : 'bg-brand-500';

  return (
    <button
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      onClick={async (e) => {
        longPress.onClickCapture(e);
        if (e.defaultPrevented) return;
        await removerDaGeladeira(g.itemKey);
        hapticLeve();
        toast(`${nomeItem(g.nome)} removido.`, 'sucesso', {
          rotulo: 'Desfazer',
          onClick: () => adicionarNaGeladeira(g.nome, g.validade),
        });
      }}
      className={`inline-flex items-center gap-1 rounded-full ${cor} px-2.5 py-1 text-xs font-medium text-white`}
      aria-label={`${nomeItem(g.nome)}${g.validade ? `, ${rotuloValidade(g.validade)}` : ''}. Toque para remover, toque e segure para definir validade.`}
      title={g.validade ? rotuloValidade(g.validade) : 'Remover · toque e segure para definir validade'}
    >
      {g.validade && (
        <>
          <CalendarDaysIcon className="size-3.5 text-white/80" />
          <span className="text-white/90">{new Date(g.validade).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          <span className="text-white/50">·</span>
        </>
      )}
      <span>{nomeItem(g.nome)}</span>
      {/* Quantidade aparece quando se sabe (sobra da embalagem comprada, ou "2 kg" digitado). */}
      {g.quantidade != null && (
        <span className="text-white/80">{formatQtdUnidadeAbrev(g.quantidade, g.unidade ?? null)}</span>
      )}
      <XMarkIcon className="size-3.5 text-white/70" />
    </button>
  );
}

