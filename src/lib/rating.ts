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

  if (n.acucares >= LIMITES.acucarAlto) negativos.push({ chave: 'acucar', label: 'Muito açúcar' });
  if (n.kcal >= LIMITES.caloriaDensa) negativos.push({ chave: 'calorico', label: 'Calórico' });
  if (n.gorduraSaturada >= LIMITES.gorduraSaturadaAlta)
    negativos.push({ chave: 'gordura_saturada', label: 'Gordura saturada alta' });
  if (n.gorduraTotal >= LIMITES.gorduraTotalAlta) negativos.push({ chave: 'gordura', label: 'Muita gordura' });
  if (n.colesterolMg >= LIMITES.colesterolAlto) negativos.push({ chave: 'colesterol', label: 'Colesterol alto' });

  const sodio = micro?.sodio;
  if (sodio !== undefined) {
    if (sodio >= LIMITES.sodioAlto) negativos.push({ chave: 'sodio', label: 'Muito sódio' });
    else if (sodio <= LIMITES.sodioBaixo) positivos.push({ chave: 'pouco_sodio', label: 'Pouco sódio' });
  }

  if (n.fibra >= LIMITES.fibraBoa) positivos.push({ chave: 'fibra', label: 'Fonte de fibras' });
  if (n.proteina >= LIMITES.proteinaBoa) positivos.push({ chave: 'proteina', label: 'Rico em proteína' });

  // Um problema ainda é "moderado": arroz com sal não vira vilão. Dois ou mais é ruim.
  const nota: NotaAlimento = negativos.length >= 2 ? 'ruim' : negativos.length === 1 ? 'moderado' : 'bom';
  return { nota, positivos, negativos };
}

export const ESTILO_NOTA: Record<NotaAlimento, { texto: string; fundo: string; rotulo: string }> = {
  bom: { texto: 'text-green-700 dark:text-green-300', fundo: 'bg-green-100 dark:bg-green-900/40', rotulo: 'Boa escolha' },
  moderado: { texto: 'text-amber-700 dark:text-amber-300', fundo: 'bg-amber-100 dark:bg-amber-900/40', rotulo: 'Com moderação' },
  ruim: { texto: 'text-red-700 dark:text-red-300', fundo: 'bg-red-100 dark:bg-red-900/40', rotulo: 'Pesado' },
};
