// Contagem de itens pendentes (não marcados) na lista de mercado, publicada pela
// própria tela ListaMercado e lida pelo badge da barra de navegação em App.tsx.

type Listener = (n: number) => void;

let pendentes = 0;
const listeners = new Set<Listener>();

export function definirPendentesLista(n: number): void {
  pendentes = n;
  for (const l of listeners) l(pendentes);
}

export function onPendentesLista(listener: Listener): () => void {
  listeners.add(listener);
  listener(pendentes);
  return () => listeners.delete(listener);
}
