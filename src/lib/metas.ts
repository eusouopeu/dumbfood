// Meta diária: quantas calorias e como elas se dividem entre os três macros.
//
// Diferente de diet.ts, aqui o percentual é da *energia* (kcal), não da massa em gramas.
// É o que a pessoa reconhece de outros apps ("40% de carboidrato") e o que permite
// converter a meta em gramas por dia — 4 kcal/g para carboidrato e proteína, 9 kcal/g
// para gordura. diet.ts continua servindo às telas de composição da compra, que são
// relativas por natureza (uma lista de mercado não tem "dia").

import { useEffect, useState } from 'react';
import { DIETAS, type Dieta } from './diet';
import type { Refeicao, RefeicaoPadrao } from '../types';
import { kcalSugerida, lerPerfil, type Perfil } from './perfil';

export interface MetaMacrosPct {
  carboidrato: number;
  proteina: number;
  gorduraTotal: number;
}

export type ChaveMacro = keyof MetaMacrosPct;

export const MACROS_ORDEM: ChaveMacro[] = ['carboidrato', 'proteina', 'gorduraTotal'];

export const MACRO_LABEL: Record<ChaveMacro, string> = {
  carboidrato: 'Carboidratos',
  proteina: 'Proteínas',
  gorduraTotal: 'Gorduras',
};

/** Energia por grama de cada macro (fatores de Atwater). */
export const KCAL_POR_GRAMA: Record<ChaveMacro, number> = { carboidrato: 4, proteina: 4, gorduraTotal: 9 };

/** Quantas kcal correspondem a uma fatia percentual da meta. */
export function kcalDoMacro(kcalTotal: number, pct: number): number {
  return Math.round((kcalTotal * pct) / 100);
}

/** Converte a meta percentual (energia) em gramas por dia de cada macro. */
export function gramasDaMeta(kcalTotal: number, pct: MetaMacrosPct): MetaMacrosPct {
  return {
    carboidrato: Math.round(kcalDoMacro(kcalTotal, pct.carboidrato) / KCAL_POR_GRAMA.carboidrato),
    proteina: Math.round(kcalDoMacro(kcalTotal, pct.proteina) / KCAL_POR_GRAMA.proteina),
    gorduraTotal: Math.round(kcalDoMacro(kcalTotal, pct.gorduraTotal) / KCAL_POR_GRAMA.gorduraTotal),
  };
}

function arredondarPara100(pct: MetaMacrosPct, fixo: ChaveMacro): MetaMacrosPct {
  const r: MetaMacrosPct = {
    carboidrato: Math.round(pct.carboidrato),
    proteina: Math.round(pct.proteina),
    gorduraTotal: Math.round(pct.gorduraTotal),
  };
  const soma = r.carboidrato + r.proteina + r.gorduraTotal;
  if (soma === 100) return r;
  // A sobra do arredondamento cai em quem não é o macro que o usuário acabou de mexer,
  // senão o slider "escapa" do valor escolhido.
  const alvo = MACROS_ORDEM.find((k) => k !== fixo && r[k] + (100 - soma) >= 0) ?? fixo;
  r[alvo] += 100 - soma;
  return r;
}

/**
 * Define `campo` em `valor` e reequilibra os outros macros para a soma voltar a 100.
 * A diferença sai dos macros livres na proporção que eles já tinham entre si; o macro
 * `travado` (o cadeado da tela) fica intocado e limita o quanto o editado pode crescer.
 */
export function ajustarMacros(
  atual: MetaMacrosPct,
  campo: ChaveMacro,
  valor: number,
  travado: ChaveMacro | null,
): MetaMacrosPct {
  if (campo === travado) return atual;
  const livres = MACROS_ORDEM.filter((k) => k !== campo && k !== travado);
  const reservado = travado ? atual[travado] : 0;
  const alvo = Math.max(0, Math.min(100 - reservado, Math.round(valor)));

  const disponivel = 100 - reservado - alvo;
  const somaLivres = livres.reduce((s, k) => s + atual[k], 0);
  const resultado: MetaMacrosPct = { ...atual, [campo]: alvo } as MetaMacrosPct;
  if (livres.length === 0) return arredondarPara100(resultado, campo);

  for (const k of livres) {
    resultado[k] = somaLivres > 0 ? (atual[k] / somaLivres) * disponivel : disponivel / livres.length;
  }
  return arredondarPara100(resultado, campo);
}

/** Converte uma meta em percentual de massa (diet.ts) para percentual de energia. */
export function energiaDePercentualEmMassa(dieta: Dieta): MetaMacrosPct {
  const m = DIETAS[dieta];
  const kcal = {
    carboidrato: m.carboidrato * KCAL_POR_GRAMA.carboidrato,
    proteina: m.proteina * KCAL_POR_GRAMA.proteina,
    gorduraTotal: m.gorduraTotal * KCAL_POR_GRAMA.gorduraTotal,
  };
  const total = kcal.carboidrato + kcal.proteina + kcal.gorduraTotal || 1;
  return arredondarPara100(
    {
      carboidrato: (kcal.carboidrato / total) * 100,
      proteina: (kcal.proteina / total) * 100,
      gorduraTotal: (kcal.gorduraTotal / total) * 100,
    },
    'carboidrato',
  );
}

export const META_MACROS_PADRAO = energiaDePercentualEmMassa('normal');

/** Meta de calorias usada quando não há perfil preenchido nem número escolhido à mão. */
export const KCAL_PADRAO = 2000;

export interface MetaSalva {
  /** kcal/dia escolhidas à mão; null = usar a sugestão calculada do perfil. */
  kcal: number | null;
  macros: MetaMacrosPct;
  /** Macro com cadeado fechado na tela de ajuste. */
  travado: ChaveMacro | null;
}

export const META_SALVA_PADRAO: MetaSalva = { kcal: null, macros: META_MACROS_PADRAO, travado: null };

const KEY = 'dumbfood:metaDiaria';

function carregar(): MetaSalva {
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return META_SALVA_PADRAO;
    const lido = JSON.parse(bruto) as Partial<MetaSalva>;
    return {
      kcal: typeof lido.kcal === 'number' && lido.kcal > 0 ? lido.kcal : null,
      macros: lido.macros ?? META_MACROS_PADRAO,
      travado: lido.travado ?? null,
    };
  } catch {
    return META_SALVA_PADRAO;
  }
}

export interface MetaDiaria {
  kcal: number;
  macros: MetaMacrosPct;
  gramas: MetaMacrosPct;
  /** true quando as kcal vieram do cálculo do perfil, e não de um número digitado. */
  kcalAutomatica: boolean;
}

/** Junta perfil e escolhas salvas na meta que as telas usam. */
export function metaEfetiva(perfil: Perfil, salva: MetaSalva): MetaDiaria {
  const sugerida = kcalSugerida(perfil);
  const kcal = salva.kcal ?? sugerida ?? KCAL_PADRAO;
  return {
    kcal,
    macros: salva.macros,
    gramas: gramasDaMeta(kcal, salva.macros),
    kcalAutomatica: salva.kcal === null,
  };
}

/** Meta salva, editável (usada pela tela de Perfil). */
export function useMetaSalva(): [MetaSalva, (m: MetaSalva) => void] {
  const [meta, setMeta] = useState<MetaSalva>(() => carregar());
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(meta));
  }, [meta]);
  return [meta, setMeta];
}

/** Meta do dia já resolvida (perfil + escolhas), para as telas que só consomem o número. */
export function useMetaDiaria(): MetaDiaria {
  const [meta] = useMetaSalva();
  return metaEfetiva(lerPerfil(), meta);
}

/**
 * Como a meta do dia se reparte entre as refeições. Serve para o slot vazio da agenda
 * dizer "recomendado: 430 kcal" em vez de só mostrar um traço.
 */
export const DISTRIBUICAO_REFEICAO: Record<RefeicaoPadrao, number> = {
  cafe: 0.25,
  almoco: 0.35,
  lanche: 0.1,
  jantar: 0.3,
};

export function kcalRecomendadaRefeicao(kcalDia: number, refeicao: Refeicao): number {
  const peso = DISTRIBUICAO_REFEICAO[refeicao as RefeicaoPadrao] ?? 0.15;
  return Math.round(kcalDia * peso);
}

export interface BarraEnergia {
  chave: ChaveMacro;
  rotulo: string;
  /** Percentual da energia que o macro representa no que foi medido (0 sem dados). */
  atual: number;
  /** Percentual-alvo da meta do perfil. */
  meta: number;
}

/**
 * Barras de composição do plano e da lista, na mesma base da meta do perfil: quanto da
 * energia vem de cada macro (4/4/9 kcal por grama) contra o percentual escolhido em
 * Perfil e metas. Antes essas telas usavam um seletor de dieta próprio, em massa, e os
 * números não batiam com o painel do dia.
 */
export function barrasEnergia(gramas: MetaMacrosPct, meta: MetaMacrosPct): BarraEnergia[] {
  const kcal = {
    carboidrato: gramas.carboidrato * KCAL_POR_GRAMA.carboidrato,
    proteina: gramas.proteina * KCAL_POR_GRAMA.proteina,
    gorduraTotal: gramas.gorduraTotal * KCAL_POR_GRAMA.gorduraTotal,
  };
  const total = kcal.carboidrato + kcal.proteina + kcal.gorduraTotal;
  return MACROS_ORDEM.map((chave) => ({
    chave,
    rotulo: MACRO_LABEL[chave],
    atual: total > 0 ? Math.round((kcal[chave] / total) * 100) : 0,
    meta: meta[chave],
  }));
}
