// Dicionário de unidades de medida em PT-BR e utilidades de normalização.

export type Dimension = 'massa' | 'volume' | 'contagem' | 'cozinha';

export interface UnitDef {
  /** Chave canônica da unidade. */
  canonical: string;
  dimension: Dimension;
  /** Fator para a unidade base da dimensão (massa->g, volume->ml). 1 para as demais. */
  toBase: number;
  /** Unidade base usada na soma dentro da dimensão. */
  base: string;
}

// Mapa de sinônimos (sem acento, minúsculo) -> definição canônica.
const RAW: Array<[string[], UnitDef]> = [
  // Massa (base: g)
  [['g', 'grama', 'gramas'], { canonical: 'g', dimension: 'massa', toBase: 1, base: 'g' }],
  [['mg', 'miligrama', 'miligramas'], { canonical: 'mg', dimension: 'massa', toBase: 0.001, base: 'g' }],
  [['kg', 'kilo', 'kilos', 'quilo', 'quilos', 'quilograma', 'quilogramas'], { canonical: 'kg', dimension: 'massa', toBase: 1000, base: 'g' }],

  // Volume (base: ml)
  [['ml', 'mililitro', 'mililitros'], { canonical: 'ml', dimension: 'volume', toBase: 1, base: 'ml' }],
  [['l', 'litro', 'litros'], { canonical: 'l', dimension: 'volume', toBase: 1000, base: 'ml' }],

  // Medidas de cozinha (somadas entre iguais; não convertidas entre si)
  [['xicara', 'xicaras', 'xic'], { canonical: 'xicara', dimension: 'cozinha', toBase: 1, base: 'xicara' }],
  [['colher de sopa', 'colheres de sopa', 'colher sopa', 'cs'], { canonical: 'colher_sopa', dimension: 'cozinha', toBase: 1, base: 'colher_sopa' }],
  [['colher de cha', 'colheres de cha', 'colher cha', 'cc'], { canonical: 'colher_cha', dimension: 'cozinha', toBase: 1, base: 'colher_cha' }],
  [['colher de sobremesa', 'colheres de sobremesa'], { canonical: 'colher_sobremesa', dimension: 'cozinha', toBase: 1, base: 'colher_sobremesa' }],
  [['colher', 'colheres'], { canonical: 'colher_sopa', dimension: 'cozinha', toBase: 1, base: 'colher_sopa' }],
  [['copo', 'copos'], { canonical: 'copo', dimension: 'cozinha', toBase: 1, base: 'copo' }],
  [['pitada', 'pitadas'], { canonical: 'pitada', dimension: 'cozinha', toBase: 1, base: 'pitada' }],
  [['fio', 'fios'], { canonical: 'fio', dimension: 'cozinha', toBase: 1, base: 'fio' }],
  [['gota', 'gotas'], { canonical: 'gota', dimension: 'cozinha', toBase: 1, base: 'gota' }],

  // Contagem / embalagens (base: cada uma é seu próprio grupo)
  [['unidade', 'unidades', 'un', 'und', 'unid'], { canonical: 'unidade', dimension: 'contagem', toBase: 1, base: 'unidade' }],
  [['dente', 'dentes'], { canonical: 'dente', dimension: 'contagem', toBase: 1, base: 'dente' }],
  [['lata', 'latas'], { canonical: 'lata', dimension: 'contagem', toBase: 1, base: 'lata' }],
  [['caixa', 'caixas'], { canonical: 'caixa', dimension: 'contagem', toBase: 1, base: 'caixa' }],
  [['pacote', 'pacotes'], { canonical: 'pacote', dimension: 'contagem', toBase: 1, base: 'pacote' }],
  [['pote', 'potes'], { canonical: 'pote', dimension: 'contagem', toBase: 1, base: 'pote' }],
  [['vidro', 'vidros'], { canonical: 'vidro', dimension: 'contagem', toBase: 1, base: 'vidro' }],
  [['envelope', 'envelopes'], { canonical: 'envelope', dimension: 'contagem', toBase: 1, base: 'envelope' }],
  [['tablete', 'tabletes'], { canonical: 'tablete', dimension: 'contagem', toBase: 1, base: 'tablete' }],
  [['fatia', 'fatias'], { canonical: 'fatia', dimension: 'contagem', toBase: 1, base: 'fatia' }],
  [['folha', 'folhas'], { canonical: 'folha', dimension: 'contagem', toBase: 1, base: 'folha' }],
  [['ramo', 'ramos'], { canonical: 'ramo', dimension: 'contagem', toBase: 1, base: 'ramo' }],
  [['maco', 'macos'], { canonical: 'maco', dimension: 'contagem', toBase: 1, base: 'maco' }],
  [['punhado', 'punhados'], { canonical: 'punhado', dimension: 'contagem', toBase: 1, base: 'punhado' }],
];

const SYNONYM_MAP = new Map<string, UnitDef>();
for (const [synonyms, def] of RAW) {
  for (const s of synonyms) SYNONYM_MAP.set(s, def);
}

/** Todas as grafias reconhecidas, ordenadas do mais longo para o mais curto (para casar "colher de sopa" antes de "colher"). */
export const UNIT_PHRASES = Array.from(SYNONYM_MAP.keys()).sort((a, b) => b.length - a.length);

/** Rótulos legíveis para as unidades canônicas. */
const CANONICAL_LABEL: Record<string, [string, string]> = {
  g: ['g', 'g'],
  mg: ['mg', 'mg'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  l: ['l', 'l'],
  xicara: ['xícara', 'xícaras'],
  colher_sopa: ['colher de sopa', 'colheres de sopa'],
  colher_cha: ['colher de chá', 'colheres de chá'],
  colher_sobremesa: ['colher de sobremesa', 'colheres de sobremesa'],
  copo: ['copo', 'copos'],
  pitada: ['pitada', 'pitadas'],
  fio: ['fio', 'fios'],
  gota: ['gota', 'gotas'],
  unidade: ['unidade', 'unidades'],
  dente: ['dente', 'dentes'],
  lata: ['lata', 'latas'],
  caixa: ['caixa', 'caixas'],
  pacote: ['pacote', 'pacotes'],
  pote: ['pote', 'potes'],
  vidro: ['vidro', 'vidros'],
  envelope: ['envelope', 'envelopes'],
  tablete: ['tablete', 'tabletes'],
  fatia: ['fatia', 'fatias'],
  folha: ['folha', 'folhas'],
  ramo: ['ramo', 'ramos'],
  maco: ['maço', 'maços'],
  punhado: ['punhado', 'punhados'],
};

export function lookupUnit(phrase: string): UnitDef | undefined {
  return SYNONYM_MAP.get(phrase.trim().toLowerCase());
}

export function unitDefByCanonical(canonical: string): UnitDef | undefined {
  for (const def of SYNONYM_MAP.values()) if (def.canonical === canonical) return def;
  return undefined;
}

/** Formata "unidade" no singular/plural adequado à quantidade. */
export function formatUnitLabel(canonical: string | null, quantidade: number | null): string {
  if (!canonical) return '';
  const labels = CANONICAL_LABEL[canonical];
  if (!labels) return canonical;
  const plural = quantidade === null ? false : quantidade > 1;
  return plural ? labels[1] : labels[0];
}
