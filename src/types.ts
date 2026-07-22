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

/** Preço unitário de um ingrediente, importado de CSV/JSON gerado a partir de notas fiscais. */
export interface PrecoItem {
  /** Nome como veio do arquivo importado. */
  item: string;
  /** Chave normalizada usada para casar com itens da lista de mercado. */
  itemKey: string;
  /** Preço por kg, por litro (1 L tratado como 1 kg) ou por unidade, conforme `unidade`. */
  precoUnitario: number;
  unidade: 'kg' | 'l' | 'unidade';
  atualizadoEm: number;
}

/** Item já comprado, congelado no momento em que a compra foi salva no histórico. */
export interface CompraItem {
  item: string;
  gondola: string;
  /** Peso estimado em gramas (inclui estimativa por unidade p/ ovos, batatas etc., usada no cálculo nutricional). */
  quantidadeG: number | null;
  /** Contagem, quando o item é comprado por unidade. */
  quantidadeUnidades: number | null;
  precoEstimado: number | null;
}

export interface Compra {
  id: string;
  /** Timestamp da compra (data informada pelo usuário ao salvar, por padrão "hoje"). */
  data: number;
  valorTotalReal: number;
  valorTotalEstimado: number;
  itens: CompraItem[];
  criadoEm: number;
}
