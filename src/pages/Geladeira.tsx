import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpenIcon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, CubeIcon, PlusIcon } from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { adicionarNaGeladeira, definirValidadeGeladeira, limparGeladeira } from '../db/repo';
import { combinarReceitas, ordenarPorValidade, sugestoesDeIngredientes } from '../lib/geladeira';
import { validadeSugerida } from '../lib/prazos';
import { useLembreteValidade } from '../lib/lembretes';
import { agendarLembretesValidade } from '../lib/notifications';
import { nomeItem } from '../lib/format';
import { confirmar } from '../lib/confirm';
import { toast } from '../lib/toast';
import { hapticForte } from '../lib/haptics';
import { CardListSkeleton } from '../components/Skeleton';
import PullToRefresh from '../components/PullToRefresh';
import AbasMercado from '../components/AbasMercado';
import EscanearProduto from '../components/EscanearProduto';
import ChipDespensa from '../components/geladeira/ChipDespensa';
import EditorValidade from '../components/geladeira/EditorValidade';
import CardCombinada from '../components/geladeira/CardCombinada';
import FolhaAdicionar from '../components/geladeira/FolhaAdicionar';

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
  const itens = useMemo(() => ordenarPorValidade(itensBrutos), [itensBrutos]);

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
    const ok = await confirmar('Esvaziar a despensa? Todos os itens serão removidos.', {
      textoConfirmar: 'Esvaziar',
      perigo: true,
    });
    if (ok) {
      await limparGeladeira();
      hapticForte();
      toast('Despensa esvaziada.');
    }
  }

  async function atualizar() {
    await new Promise((r) => setTimeout(r, 400));
    toast('Despensa atualizada.', 'info');
  }

  if (recipes === undefined || geladeira === undefined)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Despensa</h2>
        <CardListSkeleton linhas={3} />
      </div>
    );

  return (
    <PullToRefresh onRefresh={atualizar}>
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Despensa</h2>

      {/* Despensa atual */}
      {itens.length > 0 && (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Na despensa · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
            <button onClick={esvaziar} className="text-xs text-brand-600 dark:text-brand-400 underline">
              esvaziar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {itens.map((g) => (
              <ChipDespensa key={g.itemKey} item={g} onEditarValidade={() => setEditandoValidade(g.itemKey)} />
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
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">Importe receitas para poder cruzá-las com a despensa.</p>
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
          aria-label="Adicionar à despensa"
          title="Adicionar à despensa"
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
