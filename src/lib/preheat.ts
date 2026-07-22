// Detecta passos de pré-aquecimento no modo de preparo para destacá-los.

import { deburr } from './ingredientParser';

export interface PreheatInfo {
  texto: string;
  temperatura?: string;
  duracao?: string;
}

const GATILHOS = [
  'pre-aquec',
  'preaquec',
  'pre aquec',
  'aqueca o forno',
  'aquecer o forno',
  'forno pre-aquecido',
  'forno preaquecido',
];

function extrairTemperatura(texto: string): string | undefined {
  // Ex.: "180° C", "180ºC", "180 graus", "200 °C".
  const m = texto.match(/(\d{2,3})\s*(?:°|º|graus)\s*c?/i);
  if (m) return `${m[1]} °C`;
  return undefined;
}

function extrairDuracao(texto: string): string | undefined {
  // Ex.: "por 40 minutos", "por 1 hora", "15 min".
  const min = texto.match(/(\d+)\s*(?:minutos?|min\b)/i);
  if (min) return `${min[1]} min`;
  const hora = texto.match(/(\d+)\s*(?:horas?|h\b)/i);
  if (hora) return `${hora[1]} h`;
  return undefined;
}

/** Encontra o primeiro passo de pré-aquecimento e extrai temperatura/duração. */
export function detectPreheat(steps: string[]): PreheatInfo | null {
  for (const step of steps) {
    const d = deburr(step).toLowerCase();
    if (GATILHOS.some((g) => d.includes(g))) {
      return {
        texto: step,
        temperatura: extrairTemperatura(step),
        duracao: extrairDuracao(step),
      };
    }
  }
  return null;
}
