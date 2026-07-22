// Tipos centrais do dumbfood.

export type YieldType = 'porcoes' | 'pessoas' | 'unidades';

export interface RecipeYield {
  valor: number;
  tipo: YieldType;
}

export interface Ingredient {
  /** Texto original do ingrediente, ex.: "2 xícaras de farinha de trigo". */
  raw: string;
  /** Quantidade numérica; null para "a gosto"/sem quantidade. */
  quantidade: number | null;
  /** Unidade normalizada (g, ml, xicara, colher_sopa, unidade...) ou null. */
  unidade: string | null;
  /** Nome canônico do item, usado como chave de agregação. */
  item: string;
  /** Seção do mercado resolvida para o item. */
  gondola: string;
}

export interface Recipe {
  id: string;
  titulo: string;
  fonteUrl?: string;
  imagem?: string;
  rendimentoBase: RecipeYield;
  ingredientes: Ingredient[];
  modoPreparo: string[];
  /** Tags do tipo de receita (Bolos, Massas, Carnes...), auto + manuais. */
  tags: string[];
  /** Tempo de preparo em minutos, quando disponível. */
  tempoPreparoMin?: number;
  criadoEm: number;
}

/** Receita recém-importada, ainda sem id/persistência. */
export type NewRecipe = Omit<Recipe, 'id' | 'criadoEm'>;

export interface PlanItem {
  recipeId: string;
  /** Fator de reescala aplicado à receita neste plano. */
  fator: number;
}

export interface WeekPlan {
  id: string;
  itens: PlanItem[];
}

/** Linha final da lista de mercado, já somada. */
export interface ShoppingLine {
  item: string;
  gondola: string;
  /** Quantidades por unidade compatível (ex.: { g: 400, unidade: 2 }). */
  quantidades: { unidade: string | null; quantidade: number | null }[];
  /** Rótulo pronto para exibição, ex.: "400 g + 2 unidades". */
  rotulo: string;
  /** Receitas de origem (para referência). */
  origens: string[];
}

export interface ShoppingSection {
  gondola: string;
  linhas: ShoppingLine[];
}
