// Biblioteca de receitas: busca, filtros, seleção múltipla e os dois atalhos que a
// geladeira habilita — "use antes de vencer" e "o que dá pra fazer com o que eu tenho".

import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import {
  BookOpenIcon,
  CheckCircleIcon,
  CubeIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ShareIcon,
  Squares2X2Icon,
  StarIcon as StarOutlineIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { salvarReceita, alternarFavorito, duplicarReceita, removerReceita, definirNoPlano } from '../db/repo';
import { receitasExemplo } from '../lib/seed';
import { deburr } from '../lib/ingredientParser';
import { capitalizar, nomeItem } from '../lib/format';
import { toast } from '../lib/toast';
import { confirmar } from '../lib/confirm';
import { hapticForte, hapticLeve } from '../lib/haptics';
import { receitasParaAproveitar, receitasPorCobertura } from '../lib/geladeira';
import { statusValidade, rotuloValidade } from '../lib/validade';
import { CardListSkeleton } from '../components/Skeleton';
import ActionSheet, { type AcaoSheet } from '../components/ActionSheet';
import PullToRefresh from '../components/PullToRefresh';
import CardReceita from '../components/receitas/CardReceita';
import ComOQueTenho from '../components/receitas/ComOQueTenho';
import FiltrosReceitas, {
  FILTROS_TEMPO,
  type FiltroTempo,
  type ModoTag,
  type Ordem,
} from '../components/receitas/FiltrosReceitas';
import type { Recipe } from '../types';

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

  const temGeladeira = !!geladeira && geladeira.length > 0;

  /**
   * O que cozinhar antes que estrague. O aviso de validade dizia que a comida ia
   * estragar; aqui ele vira a decisão que deveria provocar — a receita que aproveita
   * justamente esses itens.
   */
  const urgentes = useMemo(
    () => receitasParaAproveitar(recipes ?? [], geladeira ?? [], (g) => statusValidade(g.validade!) !== 'ok'),
    [recipes, geladeira],
  );

  // Receitas ordenadas pelo quanto a geladeira já cobre: alimenta o bloco "Com o que
  // você tem", a ordenação por geladeira e a porcentagem exibida em cada card.
  const porCobertura = useMemo(
    () =>
      temGeladeira
        ? receitasPorCobertura(recipes ?? [], geladeira ?? [], (g) => statusValidade(g.validade!) !== 'ok')
        : [],
    [recipes, geladeira, temGeladeira],
  );

  const coberturaPorReceita = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of porCobertura) m.set(c.recipe.id, c.cobertura);
    return m;
  }, [porCobertura]);

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
    if (soPossoFazer) lista = lista.filter((r) => (coberturaPorReceita.get(r.id) ?? 0) >= 1);

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
    } else if (ordem === 'geladeira') {
      // A ordem já foi calculada (cobertura + urgência de validade): aqui só se respeita
      // a posição de cada receita naquela lista.
      const posicao = new Map(porCobertura.map((c, i) => [c.recipe.id, i]));
      lista.sort((a, b) => (posicao.get(a.id) ?? Infinity) - (posicao.get(b.id) ?? Infinity));
    }
    return lista;
  }, [recipes, busca, tagsSel, modoTag, ordem, soFavoritas, filtroTempo, soPossoFazer, coberturaPorReceita, porCobertura]);

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

  async function excluirReceita(r: Recipe) {
    const ok = await confirmar(`Excluir "${capitalizar(r.titulo)}"? Essa ação não pode ser desfeita.`, {
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    await removerReceita(r.id);
    hapticForte();
    toast('Receita excluída.');
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
      { rotulo: 'Excluir', icone: TrashIcon, destrutiva: true, onClick: () => excluirReceita(r) },
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
              {temGeladeira && (
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

        {urgentes.length > 0 && !selecionando && (
          <div className="card space-y-2 border-2 border-amber-400 p-4 dark:border-amber-600">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="size-4 text-amber-500" />
              <h3 className="section-heading text-sm">Use antes de vencer</h3>
            </div>
            <ul className="space-y-1.5">
              {urgentes.map(({ recipe, vencendo, falta }) => (
                <li key={recipe.id}>
                  <Link to={`/receita/${recipe.id}`} className="block">
                    <span className="font-semibold">{capitalizar(recipe.titulo)}</span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">
                      usa {vencendo.map((g) => nomeItem(g.nome)).join(', ')} ({rotuloValidade(vencendo[0].validade!)})
                      {falta.length > 0 && ` · faltam ${falta.length} ingrediente(s)`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!selecionando && <ComOQueTenho receitas={porCobertura.slice(0, 4)} />}

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
            <FiltrosReceitas
              busca={busca}
              onBusca={setBusca}
              filtroTempo={filtroTempo}
              onFiltroTempo={setFiltroTempo}
              todasTags={todasTags}
              tagsSel={tagsSel}
              onToggleTag={toggleTag}
              onLimparTags={() => setTagsSel(new Set())}
              modoTag={modoTag}
              onModoTag={setModoTag}
              ordem={ordem}
              onOrdem={setOrdem}
              temGeladeira={temGeladeira}
              quantidade={filtradas.length}
            />

            {filtradas.length === 0 ? (
              <p className="card p-6 text-center text-stone-500 dark:text-stone-400">Nenhuma receita corresponde ao filtro.</p>
            ) : (
              <>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Arraste uma receita para a esquerda para excluí-la.
                </p>
                <ul className="space-y-3">
                  {filtradas.map((r) => (
                    <li key={r.id}>
                      <CardReceita
                        recipe={r}
                        naSemana={noPlano.has(r.id)}
                        busca={busca}
                        cobertura={temGeladeira ? (coberturaPorReceita.get(r.id) ?? 0) : undefined}
                        selecionando={selecionando}
                        selecionada={selecionadas.has(r.id)}
                        onToggleSelecionar={() => toggleSelecionada(r.id)}
                        onAbrirMenu={() => setMenuAberto(r)}
                        onToggleFavorito={() => {
                          hapticLeve();
                          alternarFavorito(r);
                        }}
                        onExcluir={() => excluirReceita(r)}
                      />
                    </li>
                  ))}
                </ul>
              </>
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
