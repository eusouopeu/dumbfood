// Tema claro/escuro: aplica a classe `dark` no <html>, com preferência salva no
// localStorage; sem preferência salva, segue prefers-color-scheme do sistema.

const KEY = 'dumbfood:tema';

export type Tema = 'light' | 'dark';

function preferenciaDoSistema(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function temaSalvo(): Tema | null {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'dark');
}

export function temaInicial(): Tema {
  return temaSalvo() ?? preferenciaDoSistema();
}

export function salvarTema(tema: Tema): void {
  localStorage.setItem(KEY, tema);
  aplicarTema(tema);
}
