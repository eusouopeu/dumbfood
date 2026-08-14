// Extrai uma duração (em minutos) mencionada num passo do modo de preparo, para
// oferecer um timer sem o usuário precisar digitar nada. Cobre os formatos mais
// comuns de receita em PT-BR: "20 minutos", "1 hora", "1h30", "meia hora",
// "20 a 30 minutos". Ignora quantidades que não são duração (ex.: "2 ovos").

const LIMITE_MAX_MIN = 24 * 60;

export function extrairMinutos(texto: string): number | null {
  const t = texto.toLowerCase();

  if (/\bmeia\s+hora\b/.test(t)) return 30;

  // Horas (+ minutos opcionais): "1 hora", "2 horas e 30 minutos", "1h30".
  const horaMin = t.match(/(\d+)\s*h(?:oras?)?(?:\s*(?:e\s*)?(\d{1,2})\s*(?:min(?:utos?)?)?)?\b/);
  if (horaMin) {
    const horas = Number(horaMin[1]);
    const min = horaMin[2] ? Number(horaMin[2]) : 0;
    return sanitizar(horas * 60 + min);
  }

  // Intervalo de minutos: "20 a 30 minutos", "20-30 min" — usa a média.
  const intervalo = t.match(/(\d+)\s*(?:a|-|até)\s*(\d+)\s*min(?:utos?)?\b/);
  if (intervalo) {
    return sanitizar(Math.round((Number(intervalo[1]) + Number(intervalo[2])) / 2));
  }

  // Minutos simples: "20 minutos", "5 min".
  const min = t.match(/(\d+)\s*min(?:utos?)?\b/);
  if (min) return sanitizar(Number(min[1]));

  return null;
}

function sanitizar(minutos: number): number | null {
  if (!Number.isFinite(minutos) || minutos <= 0 || minutos > LIMITE_MAX_MIN) return null;
  return minutos;
}
