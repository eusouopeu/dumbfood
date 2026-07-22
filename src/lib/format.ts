// Pequenos utilitários de formatação de texto para a interface.

export function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
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
