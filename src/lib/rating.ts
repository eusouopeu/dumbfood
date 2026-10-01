// Selos de qualidade de um alimento ou receita, a partir da tabela nutricional que o
// app já estima (nutrition.ts + micronutrientes.ts).
//
// Os limites seguem a lógica das alegações nutricionais da ANVISA (RDC 429/2020 e IN
// 75/2020) em base "por 100 g", que é exatamente a base em que o app calcula. Não é
// rótulo oficial — é leitura rápida: "isso aqui é denso e doce" enxerga-se antes de ler
// sete linhas de tabela.

import type { Nutrientes100g } from './nutrition';
import type { Micronutrientes100g } from './micronutrientes';

export type NotaAlimento = 'bom' | 'moderado' | 'ruim';

export interface Selo {
  chave: string;
  label: string;
  /** Por que o selo apareceu: o valor por 100 g e o limite que ele cruzou. */
  motivo: string;
}

export interface AvaliacaoAlimento {
  nota: NotaAlimento;
  positivos: Selo[];
  negativos: Selo[];
}

/** Limites por 100 g. Acima (ou abaixo, nos positivos) o selo aparece. */
const LIMITES = {
  acucarAlto: 15,
  caloriaDensa: 300,
  gorduraSaturadaAlta: 5,
  gorduraTotalAlta: 20,
  sodioAlto: 600,
  sodioBaixo: 140,
  fibraBoa: 3,
  proteinaBoa: 10,
  colesterolAlto: 100,
};

export function avaliarAlimento(
  n: Nutrientes100g,
  micro?: Partial<Micronutrientes100g>,
): AvaliacaoAlimento {
  const negativos: Selo[] = [];
  const positivos: Selo[] = [];

  const acima = (chave: string, label: string, nome: string, valor: number, limite: number, un = 'g') =>
    negativos.push({ chave, label, motivo: `${nome}: ${fmt(valor)} ${un} por 100 g (limite ${fmt(limite)} ${un})` });
  const bom = (chave: string, label: string, nome: string, valor: number, texto: string) =>
    positivos.push({ chave, label, motivo: `${nome}: ${fmt(valor)} ${texto}` });

  if (n.acucares >= LIMITES.acucarAlto) acima('acucar', 'Muito açúcar', 'Açúcares', n.acucares, LIMITES.acucarAlto);
  if (n.kcal >= LIMITES.caloriaDensa) acima('calorico', 'Calórico', 'Energia', n.kcal, LIMITES.caloriaDensa, 'kcal');
  if (n.gorduraSaturada >= LIMITES.gorduraSaturadaAlta)
    acima('gordura_saturada', 'Gordura saturada alta', 'Gordura saturada', n.gorduraSaturada, LIMITES.gorduraSaturadaAlta);
  if (n.gorduraTotal >= LIMITES.gorduraTotalAlta)
    acima('gordura', 'Muita gordura', 'Gorduras totais', n.gorduraTotal, LIMITES.gorduraTotalAlta);
  if (n.colesterolMg >= LIMITES.colesterolAlto)
    acima('colesterol', 'Colesterol alto', 'Colesterol', n.colesterolMg, LIMITES.colesterolAlto, 'mg');

  const sodio = micro?.sodio;
  if (sodio !== undefined) {
    if (sodio >= LIMITES.sodioAlto) acima('sodio', 'Muito sódio', 'Sódio', sodio, LIMITES.sodioAlto, 'mg');
    else if (sodio <= LIMITES.sodioBaixo)
      bom('pouco_sodio', 'Pouco sódio', 'Sódio', sodio, `mg por 100 g (até ${LIMITES.sodioBaixo} mg)`);
  }

  if (n.fibra >= LIMITES.fibraBoa)
    bom('fibra', 'Fonte de fibras', 'Fibras', n.fibra, `g por 100 g (a partir de ${LIMITES.fibraBoa} g)`);
  if (n.proteina >= LIMITES.proteinaBoa)
    bom('proteina', 'Rico em proteína', 'Proteína', n.proteina, `g por 100 g (a partir de ${LIMITES.proteinaBoa} g)`);

  // Um problema ainda é "moderado": arroz com sal não vira vilão. Dois ou mais é ruim.
  const nota: NotaAlimento = negativos.length >= 2 ? 'ruim' : negativos.length === 1 ? 'moderado' : 'bom';
  return { nota, positivos, negativos };
}

/** Número curto em pt-BR: inteiro quando dá, uma casa decimal quando não. */
function fmt(v: number): string {
  return (Math.round(v * 10) / 10).toLocaleString('pt-BR');
}

/** Como a nota sai dos selos — texto da ajuda recolhida ao lado dos selos. */
export const REGRA_NOTA = 'Nenhum excesso: boa escolha. Um excesso: com moderação. Dois ou mais: pesado.';

export const ESTILO_NOTA: Record<NotaAlimento, { texto: string; fundo: string; rotulo: string }> = {
  bom: { texto: 'text-green-700 dark:text-green-300', fundo: 'bg-green-100 dark:bg-green-900/40', rotulo: 'Boa escolha' },
  moderado: { texto: 'text-amber-700 dark:text-amber-300', fundo: 'bg-amber-100 dark:bg-amber-900/40', rotulo: 'Com moderação' },
  ruim: { texto: 'text-red-700 dark:text-red-300', fundo: 'bg-red-100 dark:bg-red-900/40', rotulo: 'Pesado' },
};
