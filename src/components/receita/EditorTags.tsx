// Tags da receita: remover com o x, adicionar digitando e Enter.

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { adicionarTags, definirTags } from '../../db/repo';
import type { Recipe } from '../../types';

export default function EditorTags({ recipe }: { recipe: Recipe }) {
  const [novaTag, setNovaTag] = useState('');

  async function addTag() {
    const t = novaTag.trim();
    if (!t) return;
    await adicionarTags(recipe, [t]);
    setNovaTag('');
  }

  return (
      <div className="flex flex-wrap items-center gap-1.5">
        {recipe.tags.map((t) => (
          <span key={t} className="chip gap-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
            {t}
            <button
              onClick={() => definirTags(recipe, recipe.tags.filter((x) => x !== t))}
              className="text-brand-500 dark:text-brand-400 hover:text-brand-700"
              aria-label={`remover ${t}`}
            >
              <XMarkIcon className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          className="input h-7 w-28 py-0 text-xs"
          placeholder="+ tag"
          value={novaTag}
          onChange={(e) => setNovaTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
        />
      </div>
  );
}
