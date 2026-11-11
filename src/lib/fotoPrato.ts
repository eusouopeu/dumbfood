// Foto do prato: o que a IA devolve e as contas da folha de revisão.
//
// A IA olha a foto e chuta itens e gramas; o chute erra mais nas gramas que no nome.
// Por isso a folha deixa mexer só nas gramas (e remover o item), e os macros acompanham
// na mesma proporção — a densidade estimada do item fica, muda a quantidade.

import type { Nutrientes100g } from './nutrition';

/** Um item identificado na foto, com os valores da quantidade estimada (não por 100 g). */
export interface ItemFoto {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
  fibra: number;
}

export type TotalFoto = Omit<ItemFoto, 'nome'>;

/** Lado maior da imagem enviada: o bastante para reconhecer comida, leve para subir. */
export const LADO_MAXIMO_FOTO = 1024;

/** Dimensões reduzidas mantendo a proporção; nunca amplia. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  max = LADO_MAXIMO_FOTO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max || maior <= 0) return { largura, altura };
  const fator = max / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Descarta item sem nome ou sem quantidade e zera números inválidos. */
export function limparItens(brutos: Partial<ItemFoto>[]): ItemFoto[] {
  return brutos
    .map((b) => ({
      nome: (b.nome ?? '').trim(),
      gramas: num(b.gramas),
      kcal: num(b.kcal),
      proteina: num(b.proteina),
      carboidrato: num(b.carboidrato),
      gorduraTotal: num(b.gorduraTotal),
      fibra: num(b.fibra),
    }))
    .filter((i) => i.nome && i.gramas > 0);
}

/** Troca as gramas do item, levando kcal e macros na mesma proporção. */
export function ajustarGramas(item: ItemFoto, gramas: number): ItemFoto {
  const novas = Math.max(0, gramas);
  const fator = item.gramas > 0 ? novas / item.gramas : 0;
  return {
    nome: item.nome,
    gramas: novas,
    kcal: item.kcal * fator,
    proteina: item.proteina * fator,
    carboidrato: item.carboidrato * fator,
    gorduraTotal: item.gorduraTotal * fator,
    fibra: item.fibra * fator,
  };
}

export function totalDosItens(itens: ItemFoto[]): TotalFoto {
  return itens.reduce<TotalFoto>(
    (t, i) => ({
      gramas: t.gramas + i.gramas,
      kcal: t.kcal + i.kcal,
      proteina: t.proteina + i.proteina,
      carboidrato: t.carboidrato + i.carboidrato,
      gorduraTotal: t.gorduraTotal + i.gorduraTotal,
      fibra: t.fibra + i.fibra,
    }),
    { gramas: 0, kcal: 0, proteina: 0, carboidrato: 0, gorduraTotal: 0, fibra: 0 },
  );
}

/**
 * O item no formato do consumo. A foto não estima saturada, açúcar nem colesterol:
 * ficam em zero, como num registro digitado sem rótulo.
 */
export function nutrientesDoItem(item: ItemFoto): Nutrientes100g {
  return {
    kcal: item.kcal,
    gorduraTotal: item.gorduraTotal,
    gorduraSaturada: 0,
    colesterolMg: 0,
    carboidrato: item.carboidrato,
    acucares: 0,
    proteina: item.proteina,
    fibra: item.fibra,
  };
}
