import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import {
  BookOpenIcon,
  CakeIcon,
  CheckCircleIcon,
  CubeIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShareIcon,
  Squares2X2Icon,
  StarIcon as StarOutlineIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import {
  salvarReceita,
  alternarFavorito,
  duplicarReceita,
  removerReceita,
  definirNoPlano,
} from '../db/repo';
import { receitasExemplo } from '../lib/seed';
import { deburr } from '../lib/ingredientParser';
import { capitalizar, formatTempo } from '../lib/format';
import { toast } from '../lib/toast';
import { confirmar } from '../lib/confirm';
import { hapticForte, hapticLeve } from '../lib/haptics';
import { useLongPress } from '../lib/useLongPress';
import { combinarReceitas } from '../lib/geladeira';
import { CardListSkeleton } from '../components/Skeleton';
import Highlight from '../components/Highlight';
import ActionSheet, { type AcaoSheet } from '../components/ActionSheet';
import PullToRefresh from '../components/PullToRefresh';
import type { Recipe } from '../types';

type Ordem = 'recentes' | 'ingredientes' | 'tempo';
type ModoTag = 'ou' | 'e';
type FiltroTempo = 'qualquer' | 'rapido' | 'medio' | 'longo';

const FILTROS_TEMPO: { valor: FiltroTempo; rotulo: string; testar: (min?: number) => boolean }[] = [
  { valor: 'qualquer', rotulo: 'Qualquer', testar: () => true },
  { valor: 'rapido', rotulo: 'Até 30 min', testar: (min) => min != null && min <= 30 },
  { valor: 'medio', rotulo: '30–60 min', testar: (min) => min != null && min > 30 && min <= 60 },
  { valor: 'longo', rotulo: 'Mais de 1h', testar: (min) => min != null && min > 60 },
];

export default function Receitas() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('criadoEm').reverse().toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const plano = usePlano();
  const noPlano = new Set(plano.itens.map((i) => i.recipeId));

  const [busca, setBusca] = useState('');
  const [tagsSel, setTagsSel] = useState<Set<string>>(new Set());
  const [modoTag, setModoTag] = useState<ModoTag>('ou');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [soFavoritas, setSoFavoritas] = useState(false);
  const [filtroTempo, setFiltroTempo] = useState<FiltroTempo>('qualquer');
  const [soPossoFazer, setSoPossoFazer] = useState(false);
  const [menuAberto, setMenuAberto] = useState<Recipe | null>(null);

  // Cobertura da geladeira por receita (para "posso fazer com o que tenho"), só
  // calculada quando há itens na geladeira — do contrário nada fecharia 100%.
  const coberturaPorReceita = useMemo(() => {
    const m = new Map<string, boolean>();
    if (!recipes || !geladeira || geladeira.length === 0) return m;
    for (const c of combinarReceitas(recipes, geladeira)) m.set(c.recipe.id, c.falta.length === 0);
    return m;
  }, [recipes, geladeira]);

  // Modo de seleção múltipla: some com o filtro de tags e busca só por simplicidade
  // de interação (evita selecionar itens que já saíram de vista).
  const [selecionando, setSelecionando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const todasTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of recipes ?? []) for (const t of r.tags ?? []) s.add(t);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [recipes]);

  const filtradas = useMemo(() => {
    let lista = [...(recipes ?? [])];

    if (soFavoritas) lista = lista.filter((r) => r.favorito);
    if (soPossoFazer) lista = lista.filter((r) => coberturaPorReceita.get(r.id));

    if (filtroTempo !== 'qualquer') {
      const teste = FILTROS_TEMPO.find((f) => f.valor === filtroTempo)!.testar;
      lista = lista.filter((r) => teste(r.tempoPreparoMin));
    }

    // Busca textual (título, ingredientes, tags).
    const q = deburr(busca).toLowerCase().trim();
    if (q) {
      lista = lista.filter((r) => {
        const alvo = deburr(
          `${r.titulo} ${r.ingredientes.map((i) => i.item).join(' ')} ${(r.tags ?? []).join(' ')}`,
        ).toLowerCase();
        return alvo.includes(q);
      });
    }

    // Filtro multi-select de tags: E (todas) ou OU (qualquer).
    if (tagsSel.size > 0) {
      lista = lista.filter((r) => {
        const tags = new Set(r.tags ?? []);
        return modoTag === 'e'
          ? Array.from(tagsSel).every((t) => tags.has(t))
          : Array.from(tagsSel).some((t) => tags.has(t));
      });
    }

    // Ordenação.
    if (ordem === 'ingredientes') {
      lista.sort((a, b) => a.ingredientes.length - b.ingredientes.length);
    } else if (ordem === 'tempo') {
      // Sem tempo definido vem na frente.
      lista.sort((a, b) => {
        const ta = a.tempoPreparoMin, tb = b.tempoPreparoMin;
        if (ta == null && tb == null) return 0;
        if (ta == null) return -1;
        if (tb == null) return 1;
        return ta - tb;
      });
    }
    return lista;
  }, [recipes, busca, tagsSel, modoTag, ordem, soFavoritas, filtroTempo, soPossoFazer, coberturaPorReceita]);

  function toggleTag(tag: string) {
    setTagsSel((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function toggleSelecionada(id: string) {
    hapticLeve();
    setSelecionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function sairDaSelecao() {
    setSelecionando(false);
    setSelecionadas(new Set());
  }

  async function adicionarSelecionadasNaSemana() {
    for (const id of selecionadas) await definirNoPlano(id, 1);
    toast(`${selecionadas.size} receita(s) adicionada(s) à semana!`);
    sairDaSelecao();
  }

  async function excluirSelecionadas() {
    const ok = await confirmar(`Excluir ${selecionadas.size} receita(s)? Essa ação não pode ser desfeita.`, {
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    for (const id of selecionadas) await removerReceita(id);
    hapticForte();
    toast(`${selecionadas.size} receita(s) excluída(s).`);
    sairDaSelecao();
  }

  async function adicionarExemplos() {
    for (const r of receitasExemplo()) await salvarReceita(r);
  }
  async function compartilhar(r: Recipe) {
    const texto = `${capitalizar(r.titulo)}\n\n${r.ingredientes.map((i) => `- ${i.raw}`).join('\n')}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: r.titulo, text: texto });
      } catch {
        // Usuário cancelou o share nativo — nada a fazer.
      }
    } else {
      await navigator.clipboard.writeText(texto);
      toast('Receita copiada para a área de transferência.');
    }
  }

  function acoesDoMenu(r: Recipe): AcaoSheet[] {
    return [
      {
        rotulo: r.favorito ? 'Remover dos favoritos' : 'Favoritar',
        icone: r.favorito ? StarSolidIcon : StarOutlineIcon,
        onClick: () => alternarFavorito(r),
      },
      {
        rotulo: 'Duplicar',
        icone: DocumentDuplicateIcon,
        onClick: async () => {
          await duplicarReceita(r);
          toast('Receita duplicada.');
        },
      },
      { rotulo: 'Compartilhar', icone: ShareIcon, onClick: () => compartilhar(r) },
      {
        rotulo: 'Excluir',
        icone: TrashIcon,
        destrutiva: true,
        onClick: async () => {
          const ok = await confirmar(`Excluir "${capitalizar(r.titulo)}"? Essa ação não pode ser desfeita.`, {
            textoConfirmar: 'Excluir',
            perigo: true,
          });
          if (ok) {
            await removerReceita(r.id);
            hapticForte();
            toast('Receita excluída.');
          }
        },
      },
    ];
  }

  async function atualizar() {
    await new Promise((r) => setTimeout(r, 400));
    toast('Receitas atualizadas.', 'info');
  }

  if (recipes === undefined)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Minhas receitas</h2>
        </div>
        <CardListSkeleton />
      </div>
    );

  return (
    <PullToRefresh onRefresh={atualizar}>
      <div className="space-y-4 pb-16">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Minhas receitas</h2>
          {recipes.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoFavoritas((v) => !v)}
                aria-label={soFavoritas ? 'Mostrar todas as receitas' : 'Mostrar só favoritas'}
                title="Favoritas"
                className={`rounded-full p-2 ${
                  soFavoritas
                    ? 'bg-amber-400 text-amber-950'
                    : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                {soFavoritas ? <StarSolidIcon className="size-4" /> : <StarOutlineIcon className="size-4" />}
              </button>
              {geladeira && geladeira.length > 0 && (
                <button
                  onClick={() => setSoPossoFazer((v) => !v)}
                  aria-label={soPossoFazer ? 'Mostrar todas as receitas' : 'Mostrar só o que posso fazer com o que tenho'}
                  title="Posso fazer com o que tenho"
                  className={`rounded-full p-2 ${
                    soPossoFazer
                      ? 'bg-brand-500 text-white'
                      : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  <CubeIcon className="size-4" />
                </button>
              )}
              {!selecionando && (
                <button
                  onClick={() => setSelecionando(true)}
                  aria-label="Selecionar receitas"
                  title="Selecionar"
                  className="rounded-full p-2 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                >
                  <Squares2X2Icon className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {recipes.length === 0 ? (
          <div className="card p-6 text-center">
            <BookOpenIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
            <p className="font-semibold">Nenhuma receita ainda</p>
            <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">Importe de um site ou cole os ingredientes.</p>
            <div className="flex flex-col gap-2">
              <Link to="/importar" className="btn-primary">
                Importar receita
              </Link>
              <button onClick={adicionarExemplos} className="btn-ghost">
                Adicionar receitas de exemplo
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Busca */}
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
              <input
                className="input pl-9"
                placeholder="Buscar por nome, ingrediente ou tag…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {/* Filtro por tempo de preparo */}
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_TEMPO.map((f) => (
                <button
                  key={f.valor}
                  onClick={() => setFiltroTempo(f.valor)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    filtroTempo === f.valor
                      ? 'bg-brand-500 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>

            {/* Filtro de tags */}
            {todasTags.length > 0 && (
              <div className="card space-y-2 p-3">
                {tagsSel.size > 1 && (
                  <div className="flex justify-end">
                    <div className="flex gap-1 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
                      <button
                        onClick={() => setModoTag('ou')}
                        className={`rounded-md px-2 py-0.5 font-semibold ${modoTag === 'ou' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
                      >
                        qualquer (ou)
                      </button>
                      <button
                        onClick={() => setModoTag('e')}
                        className={`rounded-md px-2 py-0.5 font-semibold ${modoTag === 'e' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
                      >
                        todas (e)
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {todasTags.map((t) => {
                    const sel = tagsSel.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          sel ? 'bg-brand-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                  {tagsSel.size > 0 && (
                    <button onClick={() => setTagsSel(new Set())} className="px-2 py-1 text-xs text-brand-600 dark:text-brand-400 underline">
                      limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ordenação */}
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-shrink-0 text-stone-500 dark:text-stone-400">Ordenar:</span>
              <select
                className="input w-auto flex-shrink-0 py-1"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
              >
                <option value="recentes">Mais recentes</option>
                <option value="ingredientes">Nº de ingredientes</option>
                <option value="tempo">Tempo de preparo</option>
              </select>
              <span className="ml-auto flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                {filtradas.length} receita(s)
              </span>
            </div>

            {filtradas.length === 0 ? (
              <p className="card p-6 text-center text-stone-500 dark:text-stone-400">Nenhuma receita corresponde ao filtro.</p>
            ) : (
              <ul className="space-y-3">
                {filtradas.map((r) => (
                  <li key={r.id}>
                    <CardReceita
                      recipe={r}
                      naSemana={noPlano.has(r.id)}
                      busca={busca}
                      selecionando={selecionando}
                      selecionada={selecionadas.has(r.id)}
                      onToggleSelecionar={() => toggleSelecionada(r.id)}
                      onAbrirMenu={() => setMenuAberto(r)}
                      onToggleFavorito={() => {
                        hapticLeve();
                        alternarFavorito(r);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* FAB: acesso rápido a "Nova receita" mesmo com a lista rolada. */}
        {!selecionando && (
          <Link
            to="/importar"
            aria-label="Nova receita"
            className="fixed bottom-24 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition hover:bg-brand-600 active:scale-95"
          >
            <PlusIcon className="size-7" />
          </Link>
        )}

        {/* Barra de ações do modo de seleção múltipla */}
        {selecionando && (
          <div className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-2xl items-center gap-2 border-t border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
            <button onClick={sairDaSelecao} aria-label="Cancelar seleção" className="rounded-full p-2 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700">
              <XMarkIcon className="size-5" />
            </button>
            <span className="text-sm font-semibold">{selecionadas.size} selecionada(s)</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={adicionarSelecionadasNaSemana}
                disabled={selecionadas.size === 0}
                className="btn-primary h-9 py-0 text-xs"
              >
                <CheckCircleIcon className="size-4" /> Add. à semana
              </button>
              <button
                onClick={excluirSelecionadas}
                disabled={selecionadas.size === 0}
                className="btn-outline h-9 py-0 text-xs text-red-600 dark:text-red-400"
              >
                <TrashIcon className="size-4" /> Excluir
              </button>
            </div>
          </div>
        )}

        {menuAberto && (
          <ActionSheet
            titulo={capitalizar(menuAberto.titulo)}
            acoes={acoesDoMenu(menuAberto)}
            onFechar={() => setMenuAberto(null)}
          />
        )}
      </div>
    </PullToRefresh>
  );
}

function CardReceita({
  recipe: r,
  naSemana,
  busca,
  selecionando,
  selecionada,
  onToggleSelecionar,
  onAbrirMenu,
  onToggleFavorito,
}: {
  recipe: Recipe;
  naSemana: boolean;
  busca: string;
  selecionando: boolean;
  selecionada: boolean;
  onToggleSelecionar: () => void;
  onAbrirMenu: () => void;
  onToggleFavorito: () => void;
}) {
  const tempo = formatTempo(r.tempoPreparoMin);
  const longPress = useLongPress(onAbrirMenu);

  return (
    <Link
      to={selecionando ? '#' : `/receita/${r.id}`}
      onClick={(e) => {
        longPress.onClickCapture(e);
        if (selecionando) {
          e.preventDefault();
          onToggleSelecionar();
        }
      }}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      className={`card relative flex gap-3 p-3 ${selecionada ? 'ring-2 ring-brand-400' : ''}`}
    >
      {selecionando && (
        <div className="flex items-center">
          <input type="checkbox" readOnly checked={selecionada} className="h-5 w-5 accent-brand-500" />
        </div>
      )}
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 dark:bg-brand-900/40">
        {r.imagem ? (
          <img src={r.imagem} alt="" className="h-full w-full object-cover" />
        ) : (
          <CakeIcon className="size-8 text-brand-500 dark:text-brand-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate pr-6 font-semibold">
          <Highlight texto={capitalizar(r.titulo)} termo={busca} />
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <span className="font-bold text-brand-600 dark:text-brand-400">{r.ingredientes.length} ingredientes</span>
          {tempo ? ` · ${tempo}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {naSemana && <span className="chip bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">na semana</span>}
          {(r.tags ?? []).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </div>
      {!selecionando && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorito();
          }}
          aria-label={r.favorito ? `Remover ${capitalizar(r.titulo)} dos favoritos` : `Favoritar ${capitalizar(r.titulo)}`}
          className="absolute right-2 top-2 rounded-full p-1 text-amber-400 hover:bg-amber-50 dark:hover:bg-stone-700"
        >
          {r.favorito ? <StarSolidIcon className="size-5" /> : <StarOutlineIcon className="size-5 text-stone-300 dark:text-stone-600" />}
        </button>
      )}
    </Link>
  );
}
