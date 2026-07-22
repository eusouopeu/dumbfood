// Agregações do histórico de compras: exportação CSV, médias de gasto e de macros
// por período (semana/mês/trimestre/ano) e agrupamento cronológico para gráficos.

import type { Compra } from '../types';
import { nutrientesDeGramas, somarNutrientes, type Nutrientes100g } from './nutrition';
import { round } from './scale';

export type Granularidade = 'semana' | 'mes' | 'trimestre' | 'ano';

export const GRANULARIDADES: { chave: Granularidade; label: string }[] = [
  { chave: 'semana', label: 'Semana' },
  { chave: 'mes', label: 'Mês' },
  { chave: 'trimestre', label: 'Trimestre' },
  { chave: 'ano', label: 'Ano' },
];

export const DIAS_POR_GRANULARIDADE: Record<Granularidade, number> = {
  semana: 7,
  mes: 30.437,
  trimestre: 91.31,
  ano: 365.25,
};

/** Início (timestamp) do período civil atual (semana/mês/trimestre/ano) que contém "agora". */
export function inicioPeriodoAtual(granularidade: Granularidade, agora: number): number {
  const d = new Date(agora);
  if (granularidade === 'semana') {
    const diaSemana = (d.getDay() + 6) % 7; // segunda = 0
    const seg = new Date(d);
    seg.setHours(0, 0, 0, 0);
    seg.setDate(d.getDate() - diaSemana);
    return seg.getTime();
  }
  if (granularidade === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (granularidade === 'trimestre') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
  return new Date(d.getFullYear(), 0, 1).getTime();
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function chaveEdata(data: number, g: Granularidade): { chave: string; label: string; ordem: number } {
  const d = new Date(data);
  if (g === 'semana') {
    const diaSemana = (d.getDay() + 6) % 7; // segunda = 0
    const seg = new Date(d);
    seg.setHours(0, 0, 0, 0);
    seg.setDate(d.getDate() - diaSemana);
    return { chave: seg.toISOString().slice(0, 10), label: `sem. ${seg.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, ordem: seg.getTime() };
  }
  if (g === 'mes') {
    const ordem = d.getFullYear() * 12 + d.getMonth();
    return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, ordem };
  }
  if (g === 'trimestre') {
    const tri = Math.floor(d.getMonth() / 3) + 1;
    const ordem = d.getFullYear() * 4 + tri;
    return { chave: `${d.getFullYear()}-T${tri}`, label: `T${tri}/${String(d.getFullYear()).slice(2)}`, ordem };
  }
  return { chave: String(d.getFullYear()), label: String(d.getFullYear()), ordem: d.getFullYear() };
}

/** Agrupa compras cronologicamente pela granularidade, somando um valor numérico por período. */
export function agruparPorPeriodo(
  compras: Compra[],
  granularidade: Granularidade,
  valor: (c: Compra) => number,
): { chave: string; label: string; total: number }[] {
  const buckets = new Map<string, { label: string; total: number; ordem: number }>();
  for (const c of compras) {
    const { chave, label, ordem } = chaveEdata(c.data, granularidade);
    const atual = buckets.get(chave);
    if (atual) atual.total += valor(c);
    else buckets.set(chave, { label, total: valor(c), ordem });
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].ordem - b[1].ordem)
    .map(([chave, v]) => ({ chave, label: v.label, total: v.total }));
}

/** Média por período, considerando o intervalo real coberto (evita superestimar com poucos dados). */
export function mediaPorPeriodo(
  compras: Compra[],
  granularidade: Granularidade,
  inicio: number,
  fim: number,
): number {
  const total = compras.reduce((s, c) => s + c.valorTotalReal, 0);
  const dias = Math.max(0, (fim - inicio) / 86_400_000);
  const periodos = Math.max(1, dias / DIAS_POR_GRANULARIDADE[granularidade]);
  return total / periodos;
}

/** Peso total (kg) de uma compra, a partir do peso estimado de cada item. */
export function pesoTotalCompraKg(compra: Compra): number {
  return compra.itens.reduce((s, i) => s + (i.quantidadeG ?? 0), 0) / 1000;
}

/** Preço médio pago por kg de comida em um conjunto de compras (total gasto / total de kg). */
export function precoMedioPorKg(compras: Compra[]): number {
  const totalReal = compras.reduce((s, c) => s + c.valorTotalReal, 0);
  const totalKg = compras.reduce((s, c) => s + pesoTotalCompraKg(c), 0);
  return totalKg > 0 ? totalReal / totalKg : 0;
}

/** Nutrição total estimada de uma compra, somando os itens com peso conhecido. */
export function nutricaoTotalCompra(compra: Compra): Nutrientes100g {
  return somarNutrientes(
    compra.itens.filter((i) => i.quantidadeG !== null).map((i) => nutrientesDeGramas(i.item, i.quantidadeG as number)),
  );
}

/** Média de um campo nutricional por período, no mesmo espírito de mediaPorPeriodo. */
export function mediaMacroPorPeriodo(
  compras: Compra[],
  campo: keyof Nutrientes100g,
  granularidade: Granularidade,
  inicio: number,
  fim: number,
): number {
  const total = compras.reduce((s, c) => s + nutricaoTotalCompra(c)[campo], 0);
  const dias = Math.max(0, (fim - inicio) / 86_400_000);
  const periodos = Math.max(1, dias / DIAS_POR_GRANULARIDADE[granularidade]);
  return total / periodos;
}

/**
 * Composição percentual de macros (% das calorias vindas de carboidrato/proteína/gordura)
 * por período, para o gráfico de barras empilhadas.
 */
export function macroPercentualPorPeriodo(
  compras: Compra[],
  granularidade: Granularidade,
): { chave: string; label: string; carboidrato: number; proteina: number; gordura: number }[] {
  const buckets = new Map<string, { label: string; ordem: number; carb: number; prot: number; gord: number }>();
  for (const c of compras) {
    const { chave, label, ordem } = chaveEdata(c.data, granularidade);
    const n = nutricaoTotalCompra(c);
    const atual = buckets.get(chave);
    if (atual) {
      atual.carb += n.carboidrato;
      atual.prot += n.proteina;
      atual.gord += n.gorduraTotal;
    } else {
      buckets.set(chave, { label, ordem, carb: n.carboidrato, prot: n.proteina, gord: n.gorduraTotal });
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].ordem - b[1].ordem)
    .map(([chave, v]) => {
      const kcalCarb = v.carb * 4;
      const kcalProt = v.prot * 4;
      const kcalGord = v.gord * 9;
      const totalKcal = kcalCarb + kcalProt + kcalGord || 1;
      return {
        chave,
        label: v.label,
        carboidrato: round((kcalCarb / totalKcal) * 100),
        proteina: round((kcalProt / totalKcal) * 100),
        gordura: round((kcalGord / totalKcal) * 100),
      };
    });
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Gera o CSV de uma compra (linha de resumo + itens). */
export function csvDeCompra(compra: Compra): string {
  const resumo = `# Compra de ${new Date(compra.data).toLocaleDateString('pt-BR')} — total real: ${compra.valorTotalReal.toFixed(2)} — total estimado: ${compra.valorTotalEstimado.toFixed(2)}`;
  const linhas = [
    ['item', 'gondola', 'peso_g', 'unidades', 'preco_estimado'],
    ...compra.itens.map((i) => [i.item, i.gondola, i.quantidadeG ?? '', i.quantidadeUnidades ?? '', i.precoEstimado ?? '']),
  ];
  return `${resumo}\n${linhas.map((l) => l.map(csvEscape).join(',')).join('\n')}`;
}
