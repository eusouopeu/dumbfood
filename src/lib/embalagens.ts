// Arredondamento da lista de mercado para as embalagens que o mercado realmente vende:
// precisar de 700 g de farinha não significa comprar 700 g — significa comprar 1 pacote
// de 1 kg e sobrar 300 g. Só vale para produtos vendidos fechados; o que é pesado no
// balcão (hortifruti, açougue, frios) continua com a quantidade exata.

import type { ShoppingLine } from '../types';
import { deburr, normalizeItemKey } from './ingredientParser';
import { formatQtdUnidade } from './displayQty';
import { round } from './scale';

export type BaseEmbalagem = 'g' | 'ml';

interface DefEmbalagem {
  base: BaseEmbalagem;
  /** Tamanhos disponíveis na prateleira, em unidades da base. */
  tamanhos: number[];
}

// Tamanhos usuais no varejo brasileiro. Ordem importa: chaves mais específicas antes
// das genéricas ("leite condensado" antes de "leite").
const EMBALAGENS: Array<[string[], DefEmbalagem]> = [
  [['leite condensado'], { base: 'g', tamanhos: [395] }],
  [['creme de leite'], { base: 'g', tamanhos: [200] }],
  [['leite de coco'], { base: 'ml', tamanhos: [200, 500] }],
  [['leite em po'], { base: 'g', tamanhos: [400, 800] }],
  [['leite'], { base: 'ml', tamanhos: [1000] }],
  [['iogurte'], { base: 'g', tamanhos: [170, 500, 900] }],
  [['requeijao'], { base: 'g', tamanhos: [200, 400] }],
  [['manteiga'], { base: 'g', tamanhos: [200, 500] }],
  [['margarina'], { base: 'g', tamanhos: [250, 500] }],
  [['arroz'], { base: 'g', tamanhos: [1000, 2000, 5000] }],
  [['feijao'], { base: 'g', tamanhos: [1000] }],
  [['lentilha', 'grao de bico', 'grao-de-bico', 'quinoa'], { base: 'g', tamanhos: [500] }],
  [['macarrao', 'espaguete', 'penne', 'massa de lasanha'], { base: 'g', tamanhos: [500] }],
  [['farinha de rosca'], { base: 'g', tamanhos: [500] }],
  [['farinha'], { base: 'g', tamanhos: [1000, 5000] }],
  [['fuba', 'polvilho'], { base: 'g', tamanhos: [500, 1000] }],
  [['amido', 'maisena'], { base: 'g', tamanhos: [200, 500] }],
  [['aveia'], { base: 'g', tamanhos: [200, 500] }],
  [['acucar'], { base: 'g', tamanhos: [1000, 5000] }],
  [['sal'], { base: 'g', tamanhos: [1000] }],
  [['fermento'], { base: 'g', tamanhos: [100, 250] }],
  [['chocolate em po', 'achocolatado', 'cacau'], { base: 'g', tamanhos: [200, 400] }],
  [['coco ralado'], { base: 'g', tamanhos: [100, 200] }],
  [['azeite'], { base: 'ml', tamanhos: [500] }],
  [['oleo'], { base: 'ml', tamanhos: [900] }],
  [['vinagre'], { base: 'ml', tamanhos: [500, 750] }],
  [['extrato de tomate', 'molho de tomate', 'tomate pelado'], { base: 'g', tamanhos: [340] }],
  [['milho', 'ervilha', 'seleta', 'atum', 'sardinha'], { base: 'g', tamanhos: [170, 200] }],
  [['cafe'], { base: 'g', tamanhos: [250, 500] }],
  [['agua de coco', 'suco', 'refrigerante'], { base: 'ml', tamanhos: [1000, 2000] }],
];

/**
 * Fração mínima da menor embalagem para valer o arredondamento. Abaixo disso o item é
 * tempero/despensa (uma pitada de sal, um fio de azeite): mandar comprar o pacote inteiro
 * toda semana enche a lista de sobra imaginária e estoura o orçamento estimado. Nesse
 * caso a quantidade exata da receita é mantida.
 */
const FRACAO_MINIMA_DA_EMBALAGEM = 0.2;

/** Embalagem padrão do item, quando ele é vendido fechado; undefined quando é vendido a granel. */
export function embalagemDe(item: string): DefEmbalagem | undefined {
  const key = normalizeItemKey(item);
  for (const [chaves, def] of EMBALAGENS) {
    for (const c of chaves) if (key.includes(deburr(c))) return def;
  }
  return undefined;
}

export interface EscolhaEmbalagem {
  /** Tamanho de cada embalagem, na base. */
  tamanho: number;
  /** Quantas embalagens comprar. */
  pacotes: number;
  /** Total que vai pra sacola, na base. */
  totalBase: number;
  /** Excedente sobre o que as receitas pedem, na base. */
  sobraBase: number;
}

/**
 * Escolhe quantas embalagens de um mesmo tamanho cobrem a necessidade com o menor
 * excedente possível; empata a favor de menos pacotes (pacote maior costuma sair mais barato).
 */
export function escolherEmbalagem(necessarioBase: number, def: DefEmbalagem): EscolhaEmbalagem | null {
  if (!(necessarioBase > 0) || def.tamanhos.length === 0) return null;
  let melhor: EscolhaEmbalagem | null = null;
  for (const tamanho of def.tamanhos) {
    const pacotes = Math.ceil(necessarioBase / tamanho);
    const totalBase = pacotes * tamanho;
    const escolha: EscolhaEmbalagem = { tamanho, pacotes, totalBase, sobraBase: round(totalBase - necessarioBase) };
    if (
      melhor === null ||
      escolha.sobraBase < melhor.sobraBase ||
      (escolha.sobraBase === melhor.sobraBase && escolha.pacotes < melhor.pacotes)
    ) {
      melhor = escolha;
    }
  }
  return melhor;
}

/** Converte um par (quantidade, unidade) para a base g/ml; null quando não é massa nem volume. */
function paraBase(quantidade: number, unidade: string | null): { valor: number; base: BaseEmbalagem } | null {
  if (unidade === 'g') return { valor: quantidade, base: 'g' };
  if (unidade === 'kg') return { valor: quantidade * 1000, base: 'g' };
  if (unidade === 'ml') return { valor: quantidade, base: 'ml' };
  if (unidade === 'l') return { valor: quantidade * 1000, base: 'ml' };
  return null;
}

/** Volta da base para a unidade de exibição (promove a kg/L acima de 1000). */
function daBase(valor: number, base: BaseEmbalagem): { quantidade: number; unidade: string } {
  if (valor >= 1000) return { quantidade: round(valor / 1000), unidade: base === 'g' ? 'kg' : 'l' };
  return { quantidade: round(valor), unidade: base };
}

export interface LinhaArredondada {
  quantidades: ShoppingLine['quantidades'];
  rotulo: string;
  /** Ex.: "2 × 1 kg — sobram 300 g". Vazio quando nada foi arredondado. */
  detalhe: string;
  /**
   * O que sobra da embalagem depois de atender as receitas, já na unidade de exibição.
   * É o que entra na geladeira quando a compra é salva: comprar 1 kg para uma receita
   * de 700 g deixa 300 g em casa, e ignorar isso faz a lista da semana seguinte pedir
   * farinha de novo.
   */
  sobras: { quantidade: number; unidade: string }[];
}

/**
 * Arredonda as quantidades de uma linha da lista para o que dá pra comprar de fato:
 * embalagens fechadas nos itens que têm tamanho de prateleira conhecido, e número
 * inteiro nos itens contados (2,5 ovos vira 3). Itens a granel ficam intactos.
 */
export function arredondarLinha(item: string, quantidades: ShoppingLine['quantidades']): LinhaArredondada {
  const def = embalagemDe(item);
  const saida: ShoppingLine['quantidades'] = [];
  const partes: string[] = [];
  const detalhes: string[] = [];
  const sobras: LinhaArredondada['sobras'] = [];

  for (const q of quantidades) {
    if (q.quantidade === null) {
      saida.push(q);
      partes.push('a gosto');
      continue;
    }

    // Item contado: não existe meia unidade na gôndola.
    if (q.unidade === null || q.unidade === 'unidade') {
      const inteiro = Math.ceil(q.quantidade);
      saida.push({ unidade: q.unidade, quantidade: inteiro });
      partes.push(formatQtdUnidade(inteiro, q.unidade));
      continue;
    }

    const emBase = def ? paraBase(q.quantidade, q.unidade) : null;
    if (!def || !emBase || emBase.base !== def.base) {
      saida.push(q);
      partes.push(formatQtdUnidade(q.quantidade, q.unidade));
      continue;
    }

    const menorEmbalagem = Math.min(...def.tamanhos);
    if (emBase.valor < menorEmbalagem * FRACAO_MINIMA_DA_EMBALAGEM) {
      saida.push(q);
      partes.push(formatQtdUnidade(q.quantidade, q.unidade));
      continue;
    }

    const escolha = escolherEmbalagem(emBase.valor, def);
    if (!escolha || escolha.sobraBase <= 0) {
      saida.push(q);
      partes.push(formatQtdUnidade(q.quantidade, q.unidade));
      continue;
    }

    const total = daBase(escolha.totalBase, def.base);
    const unidadePacote = daBase(escolha.tamanho, def.base);
    const sobra = daBase(escolha.sobraBase, def.base);
    saida.push({ unidade: total.unidade, quantidade: total.quantidade });
    partes.push(formatQtdUnidade(total.quantidade, total.unidade));
    detalhes.push(
      `${escolha.pacotes} × ${formatQtdUnidade(unidadePacote.quantidade, unidadePacote.unidade)} — sobram ${formatQtdUnidade(sobra.quantidade, sobra.unidade)}`,
    );
    sobras.push(sobra);
  }

  return { quantidades: saida, rotulo: partes.join(' + '), detalhe: detalhes.join(' · '), sobras };
}
