import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreatePlanoAtual } from '../db/db';
import { salvarReceita, exportarJSON, importarJSON } from '../db/repo';
import { receitasExemplo } from '../lib/seed';
import { capitalizar, rotuloRendimento } from '../lib/format';
import { useRef } from 'react';

export default function Receitas() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('criadoEm').reverse().toArray(), []);
  const plano = useLiveQuery(() => getOrCreatePlanoAtual(), []);
  const noPlano = new Set(plano?.itens.map((i) => i.recipeId));
  const fileRef = useRef<HTMLInputElement>(null);

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
          <p className="mb-4 text-sm text-stone-500">
            Importe de um site ou cole os ingredientes.
          </p>
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
        <ul className="space-y-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link to={`/receita/${r.id}`} className="card flex gap-3 p-3">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 text-2xl">
                  {r.imagem ? (
                    <img src={r.imagem} alt="" className="h-full w-full object-cover" />
                  ) : (
                    '🍲'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{capitalizar(r.titulo)}</p>
                  <p className="text-sm text-stone-500">
                    {r.rendimentoBase.valor} {rotuloRendimento(r.rendimentoBase.tipo, r.rendimentoBase.valor)} ·{' '}
                    {r.ingredientes.length} ingredientes
                  </p>
                  {noPlano.has(r.id) && <span className="chip mt-1 bg-brand-100 text-brand-700">na semana</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
