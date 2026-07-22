import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { salvarReceita, exportarJSON, importarJSON } from '../db/repo';
import { receitasExemplo } from '../lib/seed';
import { deburr } from '../lib/ingredientParser';
import { capitalizar, rotuloRendimento, formatTempo } from '../lib/format';
import type { Recipe } from '../types';

type Ordem = 'recentes' | 'ingredientes' | 'tempo';
type ModoTag = 'ou' | 'e';

export default function Receitas() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('criadoEm').reverse().toArray(), []);
  const plano = usePlano();
  const noPlano = new Set(plano.itens.map((i) => i.recipeId));
  const fileRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState('');
  const [tagsSel, setTagsSel] = useState<Set<string>>(new Set());
  const [modoTag, setModoTag] = useState<ModoTag>('ou');
  const [ordem, setOrdem] = useState<Ordem>('recentes');

  const todasTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of recipes ?? []) for (const t of r.tags ?? []) s.add(t);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [recipes]);

  const filtradas = useMemo(() => {
    let lista = [...(recipes ?? [])];

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
  }, [recipes, busca, tagsSel, modoTag, ordem]);

  function toggleTag(tag: string) {
    setTagsSel((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function adicionarExemplos() {
    for (const r of receitasExemplo()) await salvarReceita(r);
  }
  async function baixarBackup() {
    const json = await exportarJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dumbfood-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function restaurarBackup(file: File) {
    const texto = await file.text();
    try {
      const { recipes: n } = await importarJSON(texto);
      alert(`Backup importado: ${n} receita(s).`);
    } catch (e) {
      alert(`Erro ao importar: ${(e as Error).message}`);
    }
  }

  if (recipes === undefined) return <p className="text-stone-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Minhas receitas</h2>
        <Link to="/importar" className="btn-primary">
          + Nova
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="mb-1 text-4xl">🍽️</p>
          <p className="font-semibold">Nenhuma receita ainda</p>
          <p className="mb-4 text-sm text-stone-500">Importe de um site ou cole os ingredientes.</p>
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
          <input
            className="input"
            placeholder="🔎 Buscar por nome, ingrediente ou tag…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          {/* Filtro de tags */}
          {todasTags.length > 0 && (
            <div className="card space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filtrar por tags</span>
                {tagsSel.size > 1 && (
                  <div className="flex gap-1 rounded-lg bg-stone-100 p-0.5 text-xs">
                    <button
                      onClick={() => setModoTag('ou')}
                      className={`rounded-md px-2 py-0.5 font-semibold ${modoTag === 'ou' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
                    >
                      qualquer (ou)
                    </button>
                    <button
                      onClick={() => setModoTag('e')}
                      className={`rounded-md px-2 py-0.5 font-semibold ${modoTag === 'e' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
                    >
                      todas (e)
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {todasTags.map((t) => {
                  const sel = tagsSel.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        sel ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
                {tagsSel.size > 0 && (
                  <button onClick={() => setTagsSel(new Set())} className="px-2 py-1 text-xs text-brand-600 underline">
                    limpar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Ordenação */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-stone-500">Ordenar:</span>
            <select className="input py-1" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="recentes">Mais recentes</option>
              <option value="ingredientes">Nº de ingredientes</option>
              <option value="tempo">Tempo de preparo</option>
            </select>
            <span className="ml-auto text-xs text-stone-400">{filtradas.length} receita(s)</span>
          </div>

          {filtradas.length === 0 ? (
            <p className="card p-6 text-center text-stone-500">Nenhuma receita corresponde ao filtro.</p>
          ) : (
            <ul className="space-y-3">
              {filtradas.map((r) => (
                <li key={r.id}>
                  <CardReceita recipe={r} naSemana={noPlano.has(r.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={baixarBackup} className="btn-outline">
          ⬇︎ Exportar
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-outline">
          ⬆︎ Importar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && restaurarBackup(e.target.files[0])}
        />
      </div>
    </div>
  );
}

function CardReceita({ recipe: r, naSemana }: { recipe: Recipe; naSemana: boolean }) {
  const tempo = formatTempo(r.tempoPreparoMin);
  return (
    <Link to={`/receita/${r.id}`} className="card flex gap-3 p-3">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 text-2xl">
        {r.imagem ? <img src={r.imagem} alt="" className="h-full w-full object-cover" /> : '🍲'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{capitalizar(r.titulo)}</p>
        <p className="text-sm text-stone-500">
          {r.rendimentoBase.valor} {rotuloRendimento(r.rendimentoBase.tipo, r.rendimentoBase.valor)} ·{' '}
          {r.ingredientes.length} ingredientes{tempo ? ` · ${tempo}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {naSemana && <span className="chip bg-brand-100 text-brand-700">na semana</span>}
          {(r.tags ?? []).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
