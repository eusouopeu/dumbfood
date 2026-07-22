// Pequenos utilitários de formatação de texto para a interface.

export function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTempo(min?: number): string | null {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function rotuloRendimento(tipo: string, valor: number): string {
  const plural = valor > 1;
  switch (tipo) {
    case 'pessoas':
      return plural ? 'pessoas' : 'pessoa';
    case 'unidades':
      return plural ? 'unidades' : 'unidade';
    default:
      return plural ? 'porções' : 'porção';
  }
}
