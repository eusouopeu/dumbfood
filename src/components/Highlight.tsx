// Destaca a primeira ocorrência de `termo` dentro de `texto`, ignorando acentos
// e maiúsculas/minúsculas (mesma lógica de comparação usada na busca).

import { deburr } from '../lib/ingredientParser';

export default function Highlight({ texto, termo }: { texto: string; termo: string }) {
  const t = termo.trim();
  if (!t) return <>{texto}</>;

  const alvo = deburr(texto).toLowerCase();
  const q = deburr(t).toLowerCase();
  const idx = alvo.indexOf(q);
  if (idx === -1) return <>{texto}</>;

  return (
    <>
      {texto.slice(0, idx)}
      <mark className="rounded bg-brand-200 text-inherit dark:bg-brand-700">{texto.slice(idx, idx + q.length)}</mark>
      {texto.slice(idx + q.length)}
    </>
  );
}
