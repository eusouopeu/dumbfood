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

/** Uma parte do preparo, quando a receita tem mais de um modo de preparo. */
export interface SecaoPreparo {
  titulo: string;
  passos: string[];
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
  /** Marcada pelo usuário como favorita, para filtro rápido. */
  favorito?: boolean;
  /** Id do vídeo guardado no dispositivo (tabela `videos`), exibido no modo de preparo. */
  videoId?: string;
  /**
   * Preparo dividido em partes (ex.: "Para a massa" / "Para o recheio"), quando o site
   * publica mais de um modo de preparo. `modoPreparo` continua sendo a lista achatada,
   * na ordem das seções — é ela que o modo cozinha e o resto do app usam.
   */
  secoesPreparo?: SecaoPreparo[];
  criadoEm: number;
}

/** Receita recém-importada, ainda sem id/persistência. */
export type NewRecipe = Omit<Recipe, 'id' | 'criadoEm'>;

/** Refeição do dia em que a receita está agendada. */
export type Refeicao = 'cafe' | 'almoco' | 'jantar' | 'lanche';

export interface PlanItem {
  recipeId: string;
  /** Fator de reescala aplicado à receita neste plano. */
  fator: number;
  /** Dia da semana agendado (0 = domingo .. 6 = sábado, como Date#getDay()); ausente = sem dia. */
  dia?: number;
  /** Refeição do dia; ausente = sem refeição definida. */
  refeicao?: Refeicao;
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
  /** true quando vem da tabela embutida do app, e não de um arquivo importado pelo usuário. */
  estimado?: boolean;
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

/** Ingrediente que o usuário marcou como disponível na geladeira/despensa. */
export interface GeladeiraItem {
  /** Chave normalizada (sem acento, singular) — chave primária. */
  itemKey: string;
  /** Nome como o usuário digitou/escolheu, para exibição. */
  nome: string;
  adicionadoEm: number;
  /** Data de validade (timestamp), quando o usuário informa. Sem validade = null/undefined. */
  validade?: number;
  /**
   * Quanto se tem do item, quando dá para saber (ex.: a sobra da embalagem comprada:
   * 1 kg de farinha para uma receita que pedia 700 g deixa 300 g na despensa).
   * Ausente = "tem, não sei quanto", que é o comportamento original da geladeira.
   */
  quantidade?: number;
  /** Unidade da quantidade (g, kg, ml, l ou null para contagem). */
  unidade?: string | null;
}

/** Item adicionado à mão na lista de mercado (fora das receitas do plano). */
export interface ItemExtra extends Ingredient {
  id: string;
}

/** Quantidade corrigida à mão pelo usuário em uma linha da lista. */
export interface QtdOverride {
  quantidade: number | null;
  unidade: string | null;
}

/**
 * Estado da lista de mercado em andamento (o que já foi marcado, itens manuais,
 * quantidades corrigidas e linhas escondidas). Fica no banco, e não em localStorage,
 * para ser reativo, entrar no backup e sobreviver a uma limpeza de cache no meio da compra.
 */
export interface ListaEstado {
  id: string;
  comprados: string[];
  extras: ItemExtra[];
  overrides: Record<string, QtdOverride>;
  /** Ids de linhas vindas das receitas que o usuário removeu da lista desta semana. */
  ocultos: string[];
}

export interface Compra {
  id: string;
  /** Timestamp da compra (data informada pelo usuário ao salvar, por padrão "hoje"). */
  data: number;
  /** Estabelecimento onde a compra foi feita; ausente nas compras salvas antes desse campo existir. */
  mercado?: string;
  valorTotalReal: number;
  valorTotalEstimado: number;
  itens: CompraItem[];
  criadoEm: number;
}

/** Vídeo da receita (ex.: baixado do TikTok), guardado no próprio dispositivo. */
export interface VideoReceita {
  id: string;
  /** Arquivo em si; fica no IndexedDB para o vídeo tocar offline, como o resto do app. */
  blob: Blob;
  mime: string;
  /** Nome original do arquivo, só para exibição. */
  nome: string;
  /** Tamanho em bytes, para avisar sobre espaço ocupado sem precisar ler o blob. */
  tamanho: number;
  criadoEm: number;
}
