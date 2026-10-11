// Horários de fome: quando o Pedro sente fome ao longo do dia.
//
// Duas fontes. A explícita é o toque em "Estou com fome" (painel do dia, atalho do ícone),
// gravado na tabela `fome`. A implícita é o próprio consumo: registro lançado no mesmo dia
// da refeição carrega no `criadoEm` a hora em que a pessoa estava comendo — e quem come,
// em geral, estava com fome um pouco antes. Registro lançado em outro dia (o jantar de
// ontem lançado hoje) não diz nada sobre horário e fica de fora.
//
// Tudo aqui é puro: a tela (components/historico/AnaliseFome.tsx) só desenha.

import { chaveDia, dataDaChave, somarDias } from './consumo';
import type { RegistroConsumo } from '../types';

export interface RegistroFome {
  id: string;
  /** Dia local 'AAAA-MM-DD', como o consumo. */
  dia: string;
  /** Quando a fome foi sentida (ms). */
  hora: number;
  /** 1 = leve, 2 = fome, 3 = muita fome. */
  intensidade: 1 | 2 | 3;
  criadoEm: number;
}

export interface SinalFome {
  dia: string;
  /** Minutos desde a meia-noite. */
  minuto: number;
  fonte: 'explicito' | 'implicito';
  peso: number;
}

/** Itens lançados com menos disso entre si são a mesma refeição (prato + suco + sobremesa). */
const MESMA_REFEICAO_MIN = 25;
/** Comer até este tempo depois de dizer "estou com fome" é consequência, não outro sinal. */
const DEPOIS_DA_FOME_MIN = 120;

const minutoDoDia = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

export function sinaisDeFome(
  fome: RegistroFome[],
  consumo: RegistroConsumo[],
  hoje: string,
  dias = 30,
  incluirImplicitos = true,
): SinalFome[] {
  const de = somarDias(hoje, -(dias - 1));
  const dentro = (dia: string) => dia >= de && dia <= hoje;
  const explicitos = fome
    .filter((f) => dentro(f.dia))
    .map((f): SinalFome => ({ dia: f.dia, minuto: minutoDoDia(f.hora), fonte: 'explicito', peso: 0.5 + f.intensidade / 2 }));
  if (!incluirImplicitos) return explicitos.sort(ordem);

  const porDia = new Map<string, number[]>();
  for (const r of consumo) {
    if (!dentro(r.dia) || chaveDia(new Date(r.criadoEm)) !== r.dia) continue;
    const lista = porDia.get(r.dia) ?? [];
    lista.push(minutoDoDia(r.criadoEm));
    porDia.set(r.dia, lista);
  }
  const implicitos: SinalFome[] = [];
  for (const [dia, minutos] of porDia) {
    const fomesDoDia = explicitos.filter((e) => e.dia === dia).map((e) => e.minuto);
    let ultimo = -Infinity;
    for (const m of minutos.sort((a, b) => a - b)) {
      if (m - ultimo < MESMA_REFEICAO_MIN) continue;
      ultimo = m;
      if (fomesDoDia.some((f) => m >= f && m - f <= DEPOIS_DA_FOME_MIN)) continue;
      implicitos.push({ dia, minuto: m, fonte: 'implicito', peso: 1 });
    }
  }
  return [...explicitos, ...implicitos].sort(ordem);
}

function ordem(a: SinalFome, b: SinalFome) {
  return a.dia === b.dia ? a.minuto - b.minuto : a.dia < b.dia ? -1 : 1;
}

/** Soma dos pesos por faixa de `passo` minutos ao longo das 24 h. */
export function distribuicao(sinais: SinalFome[], passo = 60): number[] {
  const faixas = new Array(Math.ceil(1440 / passo)).fill(0) as number[];
  for (const s of sinais) faixas[Math.floor(s.minuto / passo)] += s.peso;
  return faixas;
}

export interface PicoFome {
  /** Horário típico (média ponderada dos sinais em volta do pico), em minutos. */
  minuto: number;
  /** Quantos sinais caem na janela de ±1 h do pico. */
  sinais: number;
  /** Fração dos dias com dado em que houve fome nessa janela. */
  frequencia: number;
}

/**
 * Picos de fome: máximos locais da distribuição em meia hora, suavizada (fome das 15h05
 * e das 15h35 são a mesma fome). Só conta pico com pelo menos 2 sinais e 35% do maior.
 */
export function picosDeFome(sinais: SinalFome[], maximo = 4): PicoFome[] {
  if (sinais.length === 0) return [];
  const bruto = distribuicao(sinais, 30);
  const n = bruto.length;
  const suave = bruto.map((v, i) => (bruto[(i - 1 + n) % n] + 2 * v + bruto[(i + 1) % n]) / 4);
  const topo = Math.max(...suave);
  const diasComDado = new Set(sinais.map((s) => s.dia)).size;
  const picos: (PicoFome & { forca: number })[] = [];
  for (let i = 0; i < n; i++) {
    const v = suave[i];
    if (v < topo * 0.35 || v < suave[(i - 1 + n) % n] || v <= suave[(i + 1) % n]) continue;
    const centro = i * 30 + 15;
    const perto = sinais.filter((s) => Math.abs(s.minuto - centro) <= 60);
    if (perto.length < 2) continue;
    const pesoTotal = perto.reduce((a, s) => a + s.peso, 0);
    const minuto = Math.round(perto.reduce((a, s) => a + s.minuto * s.peso, 0) / pesoTotal);
    const dias = new Set(perto.map((s) => s.dia)).size;
    picos.push({ minuto, sinais: perto.length, frequencia: dias / diasComDado, forca: v });
  }
  // Dois máximos a menos de 1 h um do outro viram um só (o mais forte).
  const finais: (PicoFome & { forca: number })[] = [];
  for (const p of picos.sort((a, b) => b.forca - a.forca)) {
    if (finais.some((f) => Math.abs(f.minuto - p.minuto) < 60)) continue;
    finais.push(p);
  }
  return finais
    .slice(0, maximo)
    .sort((a, b) => a.minuto - b.minuto)
    .map(({ forca: _f, ...p }) => p);
}

export interface ResumoFome {
  explicitos: number;
  implicitos: number;
  dias: number;
  /** Mediana do primeiro sinal do dia (minutos), ou null. */
  primeiraFome: number | null;
  /** Intervalo médio entre sinais seguidos no mesmo dia (minutos), ou null. */
  intervaloMedio: number | null;
}

function mediana(v: number[]): number | null {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function resumoFome(sinais: SinalFome[]): ResumoFome {
  const porDia = new Map<string, number[]>();
  for (const s of sinais) porDia.set(s.dia, [...(porDia.get(s.dia) ?? []), s.minuto]);
  const primeiros: number[] = [];
  const intervalos: number[] = [];
  for (const minutos of porDia.values()) {
    const m = [...minutos].sort((a, b) => a - b);
    primeiros.push(m[0]);
    for (let i = 1; i < m.length; i++) if (m[i] - m[i - 1] >= MESMA_REFEICAO_MIN) intervalos.push(m[i] - m[i - 1]);
  }
  return {
    explicitos: sinais.filter((s) => s.fonte === 'explicito').length,
    implicitos: sinais.filter((s) => s.fonte === 'implicito').length,
    dias: porDia.size,
    primeiraFome: mediana(primeiros),
    intervaloMedio: intervalos.length ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length) : null,
  };
}

/** Separa dias úteis de fim de semana: a rotina muda e a fome costuma mudar junto. */
export function separarFimDeSemana(sinais: SinalFome[]): { uteis: SinalFome[]; fimDeSemana: SinalFome[] } {
  const fds = (dia: string) => [0, 6].includes(dataDaChave(dia).getDay());
  return { uteis: sinais.filter((s) => !fds(s.dia)), fimDeSemana: sinais.filter((s) => fds(s.dia)) };
}

/** "15h20", "9h" — como se fala o horário. */
export function rotuloMinuto(minuto: number): string {
  const h = Math.floor(minuto / 60) % 24;
  const m = minuto % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
