import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpenIcon,
  CakeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CubeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { adicionarNaGeladeira, limparGeladeira, removerDaGeladeira } from '../db/repo';
import { combinarReceitas, sugestoesDeIngredientes, type ReceitaCombinada } from '../lib/geladeira';
import { capitalizar, nomeItem, formatTempo } from '../lib/format';

export default function Geladeira() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('criadoEm').reverse().toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.orderBy('adicionadoEm').toArray(), []);

  const [texto, setTexto] = useState('');
  /** Esconde receitas que ainda precisam de compras. */
  const [soCompletas, setSoCompletas] = useState(false);

  const itens = geladeira ?? [];
  const lista = recipes ?? [];

  const sugestoes = useMemo(() => sugestoesDeIngredientes(lista, itens), [lista, itens]);

  const combinadas = useMemo(() => {
    if (itens.length === 0) return [];
    // Sem nenhum ingrediente em comum a receita não interessa aqui.
    return combinarReceitas(lista, itens).filter((c) => c.tem.length > 0);
  }, [lista, itens]);

  const visiveis = soCompletas ? combinadas.filter((c) => c.falta.length === 0) : combinadas;
  const completas = combinadas.filter((c) => c.falta.length === 0).length;

  async function adicionar(nome: string) {
    await adicionarNaGeladeira(nome);
    setTexto('');
  }

  if (recipes === undefined || geladeira === undefined) return <p className="text-stone-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">O que tem na geladeira?</h2>
        <p className="text-sm text-stone-500">
          Adicione o que você tem em casa e veja quais receitas da sua biblioteca aproveitam melhor.
        </p>
      </div>

      {/* Entrada de ingredientes */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) adicionar(texto);
        }}
      >
        <input
          className="input"
          placeholder="Ex.: ovos, cebola, frango…"
          list="ingredientes-biblioteca"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <datalist id="ingredientes-biblioteca">
          {sugestoes.map((s) => (
            <option key={s.itemKey} value={s.nome} />
          ))}
        </datalist>
        <button type="submit" disabled={!texto.trim()} className="btn-primary shrink-0">
          Adicionar
        </button>
      </form>

      {/* Geladeira atual */}
      {itens.length > 0 && (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Na geladeira · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
            <button onClick={() => limparGeladeira()} className="text-xs text-brand-600 underline">
              esvaziar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {itens.map((g) => (
              <button
                key={g.itemKey}
                onClick={() => removerDaGeladeira(g.itemKey)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-medium text-white"
                title="Remover"
              >
                {nomeItem(g.nome)}
                <XMarkIcon className="size-3.5 text-white/70" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sugestões a partir da biblioteca */}
      {sugestoes.length > 0 && lista.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-stone-500">
            {itens.length === 0 ? 'Comece pelos mais usados nas suas receitas:' : 'Adicionar rápido:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoes.slice(0, 10).map((s) => (
              <button
                key={s.itemKey}
                onClick={() => adicionar(s.nome)}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
              >
                + {nomeItem(s.nome)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resultados */}
      {lista.length === 0 ? (
        <div className="card p-6 text-center">
          <BookOpenIcon className="mx-auto mb-1 size-10 text-brand-400" />
          <p className="font-semibold">Sua biblioteca está vazia</p>
          <p className="mb-4 text-sm text-stone-500">Importe receitas para poder cruzá-las com a geladeira.</p>
          <Link to="/importar" className="btn-primary">
            Importar receita
          </Link>
        </div>
      ) : itens.length === 0 ? (
        <div className="card p-6 text-center text-stone-500">
          <CubeIcon className="mx-auto mb-1 size-10 text-brand-400" />
          <p>Adicione um ingrediente para começar a afunilar as receitas.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setSoCompletas((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                soCompletas ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              <CheckCircleIcon className="mr-1 inline-block size-4 align-text-bottom" />
              Dá pra fazer agora ({completas})
            </button>
            <span className="ml-auto text-xs text-stone-400">{visiveis.length} receita(s)</span>
          </div>

          {visiveis.length === 0 ? (
            <p className="card p-6 text-center text-stone-500">
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
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100">
          {c.recipe.imagem ? (
            <img src={c.recipe.imagem} alt="" className="h-full w-full object-cover" />
          ) : (
            <CakeIcon className="size-8 text-brand-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{capitalizar(c.recipe.titulo)}</p>
          <p className="text-sm text-stone-500">
            {c.total} ingredientes{tempo ? ` · ${tempo}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="chip bg-green-100 text-green-800">
              usa {c.usados.length} de {totalGeladeira} que você tem
            </span>
            {completa ? (
              <span className="chip bg-green-600 text-white">dá pra fazer agora</span>
            ) : (
              <span className="chip bg-amber-100 text-amber-800">
                faltam {c.falta.length} {c.falta.length === 1 ? 'ingrediente' : 'ingredientes'}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Barra de cobertura: quanto da receita a geladeira já cobre. */}
      <div className="mx-3 mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className={completa ? 'h-full bg-green-500' : 'h-full bg-brand-400'}
          style={{ width: `${Math.round(c.cobertura * 100)}%` }}
        />
      </div>

      {!completa && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            className="inline-flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium text-brand-600"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Falta comprar</p>
                <p className="text-stone-600">{c.falta.map((i) => nomeItem(i.item)).join(', ')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Você já tem</p>
                <p className="text-stone-600">{c.tem.map((i) => nomeItem(i.item)).join(', ')}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
