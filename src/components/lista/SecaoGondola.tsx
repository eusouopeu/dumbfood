// Uma gôndola da lista de mercado, com as linhas de item dentro.
//
// A gôndola abre e fecha: a lista de uma semana inteira passa fácil de uma tela e meia,
// e no mercado só interessa o corredor onde se está. O estado de aberta/fechada é por
// gôndola e persiste, para a lista abrir do jeito que o usuário deixou.

import { useState } from 'react';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { estiloGondola } from '../../lib/aisles';
import { nomeItem } from '../../lib/format';
import { formatBRL } from '../../lib/prices';
import SwipeActions from '../SwipeActions';
import type { CustoLinha, LinhaLista } from '../../lib/useListaCompras';

const KEY = 'dumbfood:gondolasFechadas';

function lerFechadas(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function gravarFechada(gondola: string, fechada: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...lerFechadas(), [gondola]: fechada }));
  } catch {
    // Armazenamento indisponível (aba privada): a gôndola só não lembra do estado.
  }
}

export interface SecaoGondolaProps {
  gondola: string;
  linhas: LinhaLista[];
  comprados: Set<string>;
  custoPorLinha: Map<string, CustoLinha>;
  editandoQtd: string | null;
  qtdTexto: string;
  onQtdTexto: (v: string) => void;
  onAlternarComprado: (id: string) => void;
  onIniciarEdicao: (l: LinhaLista) => void;
  onSalvarQtd: (l: LinhaLista) => void;
  onCancelarEdicao: () => void;
  onRemover: (l: LinhaLista) => void;
}

export default function SecaoGondola(props: SecaoGondolaProps) {
  const { gondola, linhas, comprados } = props;
  const [aberta, setAberta] = useState<boolean>(() => !lerFechadas()[gondola]);
  const estilo = estiloGondola(gondola);
  const marcados = linhas.filter((l) => comprados.has(l.id)).length;

  function alternar() {
    setAberta((v) => {
      gravarFechada(gondola, v);
      return !v;
    });
  }

  return (
    <div className={`card overflow-hidden border-2 ${estilo.borda}`}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberta}
        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-bold ${estilo.header}`}
      >
        <ChevronDownIcon className={`size-4 flex-shrink-0 transition-transform ${aberta ? '' : '-rotate-90'}`} />
        <span className="min-w-0 flex-1 truncate">{gondola}</span>
        <span className="flex-shrink-0 text-xs font-semibold opacity-80">
          {marcados}/{linhas.length}
        </span>
      </button>
      {aberta && (
        <ul>
          {linhas.map((l) => (
            <LinhaItem key={l.id} linha={l} {...props} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaItem({
  linha: l,
  comprados,
  custoPorLinha,
  editandoQtd,
  qtdTexto,
  onQtdTexto,
  onAlternarComprado,
  onIniciarEdicao,
  onSalvarQtd,
  onCancelarEdicao,
  onRemover,
}: SecaoGondolaProps & { linha: LinhaLista }) {
  const isChecked = comprados.has(l.id);
  const custo = custoPorLinha.get(l.id);
  const editando = editandoQtd === l.id;

  return (
    <SwipeActions onRemover={() => onRemover(l)} onEditar={() => onIniciarEdicao(l)}>
      <li className="flex items-center gap-3 border-t border-stone-100 bg-white px-4 py-2.5 dark:border-stone-700 dark:bg-stone-800">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand-500"
          checked={isChecked}
          onChange={() => onAlternarComprado(l.id)}
          aria-label={`Marcar ${nomeItem(l.item)} como comprado`}
        />
        {editando ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              onSalvarQtd(l);
            }}
          >
            <input
              autoFocus
              className="input h-7 min-w-0 flex-1 py-0 text-xs"
              value={qtdTexto}
              onChange={(e) => onQtdTexto(e.target.value)}
              placeholder="ex.: 500 g"
            />
            <button type="submit" aria-label="Salvar quantidade" className="flex-shrink-0 text-brand-600 dark:text-brand-400">
              <CheckIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onCancelarEdicao}
              aria-label="Cancelar edição"
              className="flex-shrink-0 text-stone-400 dark:text-stone-500"
            >
              <XMarkIcon className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onAlternarComprado(l.id)}
            className={`min-w-0 flex-1 text-left ${
              isChecked
                ? 'text-stone-400 line-through dark:text-stone-500'
                : l.manual
                  ? 'text-stone-400 dark:text-stone-500'
                  : ''
            }`}
          >
            <span className="font-semibold">{l.rotulo}</span> <span>{nomeItem(l.item)}</span>
            {l.origens.length > 1 && (
              <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">({l.origens.length} receitas)</span>
            )}
          </button>
        )}
        {!editando && (
          /* Preço vindo da tabela embutida fica em itálico e mais claro, para não passar
             por valor conferido em nota fiscal. */
          <div
            className={`flex flex-shrink-0 items-center gap-1 text-right text-sm tabular-nums ${
              custo?.estimado ? 'italic text-stone-400 dark:text-stone-500' : 'text-stone-500 dark:text-stone-400'
            }`}
            title={custo?.estimado ? 'Preço estimado pelo app' : undefined}
          >
            {custo?.tendencia === 'alta' && (
              <ArrowTrendingUpIcon className="size-3.5 flex-shrink-0 text-red-500" aria-label="Preço subiu desde a última compra" />
            )}
            {custo?.tendencia === 'baixa' && (
              <ArrowTrendingDownIcon className="size-3.5 flex-shrink-0 text-green-600" aria-label="Preço caiu desde a última compra" />
            )}
            {custo?.foraDoPadrao === 'alto' && (
              <ExclamationTriangleIcon
                className="size-3.5 flex-shrink-0 text-amber-500"
                aria-label="Preço bem acima da mediana histórica deste item"
              />
            )}
            {custo?.valor != null ? formatBRL(custo.valor) : '—'}
          </div>
        )}
      </li>
    </SwipeActions>
  );
}
