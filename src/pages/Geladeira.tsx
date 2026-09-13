import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpenIcon,
  CakeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CubeIcon,
  HashtagIcon,
  PlusIcon,
  QrCodeIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { adicionarNaGeladeira, definirValidadeGeladeira, limparGeladeira, removerDaGeladeira } from '../db/repo';
import { combinarReceitas, sugestoesDeIngredientes, type ReceitaCombinada } from '../lib/geladeira';
import { sugerirSubstitutosParaItem } from '../lib/substitutions';
import { statusValidade, rotuloValidade } from '../lib/validade';
import { prazoPadraoDias, validadeSugerida } from '../lib/prazos';
import { useLembreteValidade } from '../lib/lembretes';
import { agendarLembretesValidade } from '../lib/notifications';
import { capitalizar, nomeItem, formatTempo } from '../lib/format';
import { formatQtdUnidadeAbrev } from '../lib/displayQty';
import { confirmar } from '../lib/confirm';
import { toast } from '../lib/toast';
import { hapticForte, hapticLeve } from '../lib/haptics';
import { useLongPress } from '../lib/useLongPress';
import { CardListSkeleton } from '../components/Skeleton';
import PullToRefresh from '../components/PullToRefresh';
import AbasMercado from '../components/AbasMercado';
import EscanearProduto from '../components/EscanearProduto';
import type { GeladeiraItem } from '../types';

/** Classes de cor do chip conforme a proximidade da validade. */
const ESTILO_VALIDADE: Record<string, string> = {
  vencido: 'bg-red-600 dark:bg-red-700',
  vence_hoje: 'bg-amber-500 dark:bg-amber-600',
  proximo: 'bg-amber-500 dark:bg-amber-600',
  ok: 'bg-brand-500',
};

export default function Geladeira() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('criadoEm').reverse().toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.orderBy('adicionadoEm').toArray(), []);

  const [texto, setTexto] = useState('');
  const [validadeTexto, setValidadeTexto] = useState('');
  /** true enquanto a data mostrada for a sugerida pelo app (o usuário ainda não mexeu nela). */
  const [validadeAutomatica, setValidadeAutomatica] = useState(true);
  const [editandoValidade, setEditandoValidade] = useState<string | null>(null);
  /** Esconde receitas que ainda precisam de compras. */
  const [soCompletas, setSoCompletas] = useState(false);
  const [lembreteValidade] = useLembreteValidade();
  const [escaneando, setEscaneando] = useState(false);
  /** Folha de adicionar: saiu do corpo da tela para o botão flutuante. */
  const [adicionando, setAdicionando] = useState(false);
  const [quantidadeTexto, setQuantidadeTexto] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const itensBrutos = geladeira ?? [];
  const lista = recipes ?? [];

  // Itens com validade mais próxima aparecem primeiro — é o que precisa de atenção agora.
  const itens = useMemo(
    () =>
      [...itensBrutos].sort((a, b) => {
        if (a.validade && b.validade) return a.validade - b.validade;
        if (a.validade) return -1;
        if (b.validade) return 1;
        return a.adicionadoEm - b.adicionadoEm;
      }),
    [itensBrutos],
  );

  const sugestoes = useMemo(() => sugestoesDeIngredientes(lista, itens), [lista, itens]);

  const combinadas = useMemo(() => {
    if (itens.length === 0) return [];
    // Sem nenhum ingrediente em comum a receita não interessa aqui.
    return combinarReceitas(lista, itens).filter((c) => c.tem.length > 0);
  }, [lista, itens]);

  const visiveis = soCompletas ? combinadas.filter((c) => c.falta.length === 0) : combinadas;
  const completas = combinadas.filter((c) => c.falta.length === 0).length;

  // Reagenda as notificações nativas sempre que a geladeira muda, enquanto o
  // lembrete estiver ligado. No PWA/web isso é no-op (ver notifications.ts).
  useEffect(() => {
    if (!lembreteValidade) return;
    agendarLembretesValidade(itens);
  }, [lembreteValidade, itens]);

  /**
   * Preenche a validade sozinho a partir do tipo do item (alface ~4 dias, arroz meses).
   * Preencher data à mão é o atrito que deixava o campo vazio — e sem validade não há
   * aviso de vencimento nem "use antes de vencer". O usuário pode sobrescrever: a partir
   * daí a data para de ser recalculada.
   */
  function digitarItem(valor: string) {
    setTexto(valor);
    if (validadeAutomatica) setValidadeTexto(validadeSugerida(valor));
  }

  async function adicionar(nome: string, validade?: string, quantidade?: string) {
    const sugerida = validade ?? validadeSugerida(nome);
    const ts = sugerida ? new Date(`${sugerida}T00:00:00`).getTime() : undefined;
    const qtd = quantidade && quantidade.trim() ? Number(quantidade.replace(',', '.')) : null;
    await adicionarNaGeladeira(nome, ts, Number.isFinite(qtd) ? qtd : null);
    limparFormulario();
  }

  function limparFormulario() {
    setTexto('');
    setValidadeTexto('');
    setQuantidadeTexto('');
    setValidadeAutomatica(true);
  }

  async function salvarValidade(itemKey: string, valor: string) {
    const ts = valor ? new Date(`${valor}T00:00:00`).getTime() : undefined;
    await definirValidadeGeladeira(itemKey, ts);
    setEditandoValidade(null);
    toast(ts ? 'Validade atualizada.' : 'Validade removida.');
  }

  async function esvaziar() {
    const ok = await confirmar('Esvaziar a geladeira? Todos os itens serão removidos.', {
      textoConfirmar: 'Esvaziar',
      perigo: true,
    });
    if (ok) {
      await limparGeladeira();
      hapticForte();
      toast('Geladeira esvaziada.');
    }
  }

  async function atualizar() {
    await new Promise((r) => setTimeout(r, 400));
    toast('Geladeira atualizada.', 'info');
  }

  if (recipes === undefined || geladeira === undefined)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Geladeira</h2>
        <CardListSkeleton linhas={3} />
      </div>
    );

  return (
    <PullToRefresh onRefresh={atualizar}>
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Geladeira</h2>

      {/* Geladeira atual */}
      {itens.length > 0 && (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Na geladeira · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
            <button onClick={esvaziar} className="text-xs text-brand-600 dark:text-brand-400 underline">
              esvaziar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {itens.map((g) => (
              <ChipGeladeira key={g.itemKey} item={g} onEditarValidade={() => setEditandoValidade(g.itemKey)} />
            ))}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500">Toque para remover · segure para mudar a validade.</p>
        </div>
      )}

      {editandoValidade && (
        <EditorValidade
          item={itens.find((i) => i.itemKey === editandoValidade)!}
          onSalvar={(valor) => salvarValidade(editandoValidade, valor)}
          onFechar={() => setEditandoValidade(null)}
        />
      )}

      {/* Sugestões a partir da biblioteca: recolhidas por padrão, atrás de um toggle —
          ajudam no começo, mas empurravam a geladeira para baixo em todo acesso. */}
      {sugestoes.length > 0 && lista.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setMostrarSugestoes((v) => !v)}
            aria-expanded={mostrarSugestoes}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400"
          >
            {mostrarSugestoes ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
            {itens.length === 0 ? 'Mais usados nas suas receitas' : 'Adicionar rápido'}
          </button>
          {mostrarSugestoes && (
            <div className="flex flex-wrap gap-1.5">
              {sugestoes.slice(0, 10).map((s) => (
                <button
                  key={s.itemKey}
                  onClick={() => adicionar(s.nome)}
                  className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-600 dark:text-stone-300"
                >
                  + {nomeItem(s.nome)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {lista.length === 0 ? (
        <div className="card p-6 text-center">
          <BookOpenIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
          <p className="font-semibold">Sua biblioteca está vazia</p>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">Importe receitas para poder cruzá-las com a geladeira.</p>
          <Link to="/importar" className="btn-primary">
            Importar receita
          </Link>
        </div>
      ) : itens.length === 0 ? (
        <div className="card p-6 text-center text-stone-500 dark:text-stone-400">
          <CubeIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
          <p>Adicione um ingrediente para começar a afunilar as receitas.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setSoCompletas((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                soCompletas ? 'bg-green-600 dark:bg-green-700 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
              }`}
            >
              <CheckCircleIcon className="mr-1 inline-block size-4 align-text-bottom" />
              Dá pra fazer agora ({completas})
            </button>
            <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{visiveis.length} receita(s)</span>
          </div>

          {visiveis.length === 0 ? (
            <p className="card p-6 text-center text-stone-500 dark:text-stone-400">
              {soCompletas
                ? 'Nenhuma receita fecha só com o que você tem. Desligue o filtro para ver as mais próximas.'
                : 'Nenhuma receita da biblioteca usa esses ingredientes.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {visiveis.map((c) => (
                <li key={c.recipe.id}>
                  <CardCombinada combinada={c} totalGeladeira={itens.length} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Canto de baixo: o seletor geladeira/mercado ao lado do botão de adicionar, que é
          o que a tela pede o tempo todo. O leitor de código de barras fica dentro da folha. */}
      <div className="fixed bottom-[4.9rem] right-4 z-20 flex items-center gap-2">
        <AbasMercado />
        <button
          onClick={() => setAdicionando(true)}
          aria-label="Adicionar à geladeira"
          title="Adicionar à geladeira"
          className="flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg"
        >
          <PlusIcon className="size-7" />
        </button>
      </div>

      {adicionando && (
        <FolhaAdicionar
          texto={texto}
          onTexto={digitarItem}
          quantidade={quantidadeTexto}
          onQuantidade={setQuantidadeTexto}
          validade={validadeTexto}
          validadeAutomatica={validadeAutomatica}
          onValidade={(v) => {
            setValidadeTexto(v);
            setValidadeAutomatica(false);
          }}
          sugestoes={sugestoes}
          onEscanear={() => {
            setAdicionando(false);
            setEscaneando(true);
          }}
          onLimpar={limparFormulario}
          onFechar={() => setAdicionando(false)}
          onAdicionar={async () => {
            await adicionar(texto, validadeTexto, quantidadeTexto);
            setAdicionando(false);
          }}
        />
      )}

      {escaneando && (
        <EscanearProduto onConfirmar={(nome) => adicionar(nome)} onFechar={() => setEscaneando(false)} />
      )}
    </div>
    </PullToRefresh>
  );
}

/** Chip de um item da geladeira: toque remove, toque longo abre o editor de validade. */
function ChipGeladeira({ item: g, onEditarValidade }: { item: GeladeiraItem; onEditarValidade: () => void }) {
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

function EditorValidade({
  item,
  onSalvar,
  onFechar,
}: {
  item: GeladeiraItem;
  onSalvar: (valor: string) => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(() => (item.validade ? new Date(item.validade).toISOString().slice(0, 10) : ''));

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="w-full max-w-2xl space-y-3 rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">Validade de {nomeItem(item.nome)}</p>
        <input
          type="date"
          className="input w-full"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => onSalvar(valor)} className="btn-primary flex-1">
            Salvar
          </button>
          {item.validade && (
            <button onClick={() => onSalvar('')} className="btn-outline">
              Remover validade
            </button>
          )}
          <button onClick={onFechar} className="btn-outline">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function CardCombinada({ combinada: c, totalGeladeira }: { combinada: ReceitaCombinada; totalGeladeira: number }) {
  const [aberto, setAberto] = useState(false);
  const tempo = formatTempo(c.recipe.tempoPreparoMin);
  const completa = c.falta.length === 0;

  return (
    <div className="card overflow-hidden">
      <Link to={`/receita/${c.recipe.id}`} className="flex gap-3 p-3">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 dark:bg-brand-900/40">
          {c.recipe.imagem ? (
            <img src={c.recipe.imagem} alt="" className="h-full w-full object-cover" />
          ) : (
            <CakeIcon className="size-8 text-brand-500 dark:text-brand-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{capitalizar(c.recipe.titulo)}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {c.total} ingredientes{tempo ? ` · ${tempo}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="chip bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              usa {c.usados.length} de {totalGeladeira} que você tem
            </span>
            {completa ? (
              <span className="chip bg-green-600 dark:bg-green-700 text-white">dá pra fazer agora</span>
            ) : (
              <span className="chip bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                faltam {c.falta.length} {c.falta.length === 1 ? 'ingrediente' : 'ingredientes'}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Barra de cobertura: quanto da receita a geladeira já cobre. */}
      <div className="mx-3 mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div
          className={completa ? 'h-full bg-green-500' : 'h-full bg-brand-400'}
          style={{ width: `${Math.round(c.cobertura * 100)}%` }}
        />
      </div>

      {!completa && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            className="inline-flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium text-brand-600 dark:text-brand-400"
          >
            {aberto ? (
              <>
                <ChevronDownIcon className="size-3.5" /> ocultar o que falta
              </>
            ) : (
              <>
                <ChevronRightIcon className="size-3.5" /> ver o que falta comprar
              </>
            )}
          </button>
          {aberto && (
            <div className="space-y-2 px-3 pb-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Falta comprar</p>
                <ul className="space-y-0.5 text-stone-600 dark:text-stone-300">
                  {c.falta.map((i) => {
                    const substitutos = sugerirSubstitutosParaItem(i.item);
                    return (
                      <li key={i.item}>
                        {nomeItem(i.item)}
                        {substitutos.length > 0 && (
                          <span className="text-stone-400 dark:text-stone-500"> — ou use {substitutos.join(', ')}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">Você já tem</p>
                <p className="text-stone-600 dark:text-stone-300">{c.tem.map((i) => nomeItem(i.item)).join(', ')}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Folha de adicionar item. Saiu do topo da tela (onde ocupava espaço mesmo quando não
 * estava em uso) para o botão flutuante: guardar compra é uma rajada de vários itens,
 * e a folha mantém o foco no campo entre um e outro.
 */
function FolhaAdicionar({
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
        <p className="text-base font-bold">Adicionar à geladeira</p>

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
