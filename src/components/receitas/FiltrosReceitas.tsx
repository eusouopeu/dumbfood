// Busca, filtros e ordenação da biblioteca de receitas, num componente só —
// a tela em si fica com o que é decisão (o que fazer com a receita), não com controles.

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export type Ordem = 'recentes' | 'ingredientes' | 'tempo' | 'geladeira';
export type ModoTag = 'ou' | 'e';
export default function FiltrosReceitas({
  busca,
  onBusca,
  todasTags,
  tagsSel,
  onToggleTag,
  onLimparTags,
  modoTag,
  onModoTag,
  ordem,
  onOrdem,
  temGeladeira,
  quantidade,
}: {
  busca: string;
  onBusca: (v: string) => void;
  todasTags: string[];
  tagsSel: Set<string>;
  onToggleTag: (t: string) => void;
  onLimparTags: () => void;
  modoTag: ModoTag;
  onModoTag: (m: ModoTag) => void;
  ordem: Ordem;
  onOrdem: (o: Ordem) => void;
  temGeladeira: boolean;
  quantidade: number;
}) {
  return (
    <>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
        <input
          className="input pl-9"
          placeholder="Buscar por nome, ingrediente ou tag…"
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
        />
      </div>

      {todasTags.length > 0 && (
        <div className="card space-y-2 p-3">
          {tagsSel.size > 1 && (
            <div className="flex justify-end">
              <div className="flex gap-1 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
                <button
                  onClick={() => onModoTag('ou')}
                  className={`rounded-md px-2 py-0.5 font-semibold ${modoTag === 'ou' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
                >
                  qualquer (ou)
                </button>
                <button
                  onClick={() => onModoTag('e')}
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
                  onClick={() => onToggleTag(t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    sel ? 'bg-brand-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {t}
                </button>
              );
            })}
            {tagsSel.size > 0 && (
              <button onClick={onLimparTags} className="px-2 py-1 text-xs text-brand-600 dark:text-brand-400 underline">
                limpar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="flex-shrink-0 text-stone-500 dark:text-stone-400">Ordenar:</span>
        <select
          className="input w-auto flex-shrink-0 py-1"
          value={ordem}
          onChange={(e) => onOrdem(e.target.value as Ordem)}
        >
          <option value="recentes">Mais recentes</option>
          <option value="ingredientes">Nº de ingredientes</option>
          <option value="tempo">Tempo de preparo</option>
          {/* Só faz sentido com a geladeira preenchida: sem ela, toda receita fica em 0%. */}
          {temGeladeira && <option value="geladeira">O que dá pra fazer com o que tenho</option>}
        </select>
        <span className="ml-auto flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">{quantidade} receita(s)</span>
      </div>
    </>
  );
}
