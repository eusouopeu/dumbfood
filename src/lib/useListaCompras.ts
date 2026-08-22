// Todo o cálculo da lista de mercado num lugar só: agregação das receitas do plano,
// itens manuais, correções de quantidade, arredondamento por embalagem, desconto do
// que já está na geladeira, custo por linha e comparação entre mercados.
//
// A tela (pages/ListaMercado.tsx) fica só com a interação; o que é conta mora aqui e
// pode ser lido (e testado) sem renderizar nada.

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { useListaEstado } from '../db/useListaEstado';
import { buildShoppingList, resumoLinha, pesoTotalKg } from './shoppingList';
import { GONDOLA_ORDER } from './aisles';
import { tendenciaPrecoItem } from './history';
import { precoForaDoPadrao, seriePrecoItem } from './precoHistorico';
import { compararMercados, mercadosDoHistorico } from './mercados';
import { arredondarLinha } from './embalagens';
import { ingredienteAtendido } from './geladeira';
import { normalizeItemKey } from './ingredientParser';
import { padronizarMedida } from './measures';
import { formatQtdUnidade } from './displayQty';
import { calcularNutricaoTotal } from './nutrition';
import { custoLinha, buscarPreco } from './prices';
import { PRECOS_BASE } from './precosBase';
import type { Ingredient, ListaEstado, Recipe, ShoppingLine, ShoppingSection } from '../types';

export interface LinhaLista {
  id: string;
  item: string;
  gondola: string;
  quantidades: ShoppingLine['quantidades'];
  rotulo: string;
  origens: string[];
  manual: boolean;
  /** O que sobra das embalagens desta linha (vai para a geladeira ao salvar a compra). */
  sobras: { quantidade: number; unidade: string }[];
  /** Item já disponível na geladeira/despensa. */
  naGeladeira: boolean;
}

export interface CustoLinha {
  valor: number | null;
  estimado: boolean;
  tendencia: 'alta' | 'baixa' | null;
  foraDoPadrao: 'alto' | 'baixo' | null;
}

export interface ListaCompras {
  carregando: boolean;
  estado: ListaEstado;
  secoes: { gondola: string; linhas: LinhaLista[] }[];
  jaTenho: LinhaLista[];
  custoPorLinha: Map<string, CustoLinha>;
  comparacao: ReturnType<typeof compararMercados>;
  mercadosConhecidos: string[];
  itensParaPrecos: string[];
  listaPrecos: typeof PRECOS_BASE;
  nutriTotal: ReturnType<typeof calcularNutricaoTotal>;
  total: number;
  pesoTotal: number;
  valorEstimadoTotal: number;
}

export function useListaCompras(descontarGeladeira: boolean, arredondarEmbalagem: boolean): ListaCompras {
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
  const compras = useLiveQuery(() => db.compras.toArray(), []);
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);
  const plano = usePlano();
  const estado = useListaEstado();

  const sections = useMemo(() => {
    if (!recipes) return [] as ShoppingSection[];
    const map = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
    return buildShoppingList(plano, map);
  }, [recipes, plano]);

  // Junta as linhas geradas pelas receitas com os itens adicionados manualmente,
  // agrupados por gôndola na mesma ordem. Itens manuais recebem um id próprio
  // (não somam com itens de receita) e ficam marcados para o estilo mais claro.
  const sectionsComExtras = useMemo(() => {
    const aplicarOverride = (l: LinhaLista): LinhaLista => {
      const ov = estado.overrides[l.id];
      if (!ov) return l;
      return {
        ...l,
        quantidades: [{ unidade: ov.unidade, quantidade: ov.quantidade }],
        rotulo: formatQtdUnidade(ov.quantidade, ov.unidade),
      };
    };
    // Arredonda para o que o mercado vende de fato (1 kg em vez de 700 g). Vem depois do
    // override para respeitar também a quantidade que o usuário digitou à mão.
    const aplicarEmbalagem = (l: LinhaLista): LinhaLista => {
      if (!arredondarEmbalagem) return l;
      const arredondada = arredondarLinha(l.item, l.quantidades);
      return {
        ...l,
        quantidades: arredondada.quantidades,
        rotulo: arredondada.rotulo,
        sobras: arredondada.sobras,
      };
    };
    const marcarGeladeira = (l: LinhaLista): LinhaLista => {
      if (l.manual || !geladeira || geladeira.length === 0) return l;
      const key = normalizeItemKey(l.item);
      return { ...l, naGeladeira: geladeira.some((g) => ingredienteAtendido(g.itemKey, key)) };
    };
    const preparar = (l: LinhaLista) => marcarGeladeira(aplicarEmbalagem(aplicarOverride(l)));

    const ocultos = new Set(estado.ocultos);
    const porGondola = new Map<string, LinhaLista[]>();
    for (const s of sections) {
      const linhas = s.linhas
        .map((l) => preparar({ ...l, id: `${s.gondola}:${l.item}`, manual: false, sobras: [], naGeladeira: false }))
        .filter((l) => !ocultos.has(l.id));
      if (linhas.length > 0) porGondola.set(s.gondola, linhas);
    }
    for (const ex of estado.extras) {
      const med = padronizarMedida(ex.item, ex.quantidade, ex.unidade, 'metrico');
      const linha: LinhaLista = {
        id: `extra:${ex.id}`,
        item: ex.item,
        gondola: ex.gondola,
        quantidades: [{ unidade: med.unidade, quantidade: med.quantidade }],
        rotulo: formatQtdUnidade(med.quantidade, med.unidade),
        origens: [],
        manual: true,
        sobras: [],
        naGeladeira: false,
      };
      const arr = porGondola.get(ex.gondola) ?? [];
      arr.push(preparar(linha));
      porGondola.set(ex.gondola, arr);
    }
    return GONDOLA_ORDER.filter((g) => porGondola.has(g)).map((g) => ({ gondola: g, linhas: porGondola.get(g)! }));
  }, [sections, estado, arredondarEmbalagem, geladeira]);

  // O que a geladeira já cobre sai da lista de compras (e das somas) e vira um bloco à
  // parte — comprar de novo o que está na despensa é justamente o que o app deveria evitar.
  const { secoes, jaTenho } = useMemo(() => {
    if (!descontarGeladeira) return { secoes: sectionsComExtras, jaTenho: [] as LinhaLista[] };
    const jaTenho: LinhaLista[] = [];
    const restantes = sectionsComExtras
      .map((s) => ({
        gondola: s.gondola,
        linhas: s.linhas.filter((l) => {
          if (!l.naGeladeira) return true;
          jaTenho.push(l);
          return false;
        }),
      }))
      .filter((s) => s.linhas.length > 0);
    return { secoes: restantes, jaTenho };
  }, [sectionsComExtras, descontarGeladeira]);

  // Os preços importados pelo usuário vêm primeiro: `buscarPreco` usa o primeiro que casar,
  // então a tabela embutida só entra onde ele ainda não tem nota fiscal.
  const listaPrecos = useMemo(() => [...(precos ?? []), ...PRECOS_BASE], [precos]);

  const custoPorLinha = useMemo(() => {
    const m = new Map<string, CustoLinha>();
    for (const s of secoes) {
      for (const l of s.linhas) {
        const fonte = buscarPreco(normalizeItemKey(l.item), listaPrecos);
        const valor = custoLinha(l, listaPrecos);
        // Converte o custo da linha para preço unitário e compara com a mediana histórica:
        // é o aviso de "esse não é o preço de sempre" antes de a compra ser salva.
        const { gramas, unidades } = resumoLinha(l);
        const serie = seriePrecoItem(l.item, compras ?? []);
        const unitario =
          valor === null
            ? null
            : gramas !== null && gramas > 0
              ? valor / (gramas / 1000)
              : unidades !== null && unidades > 0
                ? valor / unidades
                : null;
        m.set(l.id, {
          valor,
          estimado: fonte?.estimado === true,
          tendencia: tendenciaPrecoItem(l.item, compras ?? []),
          foraDoPadrao: unitario === null ? null : precoForaDoPadrao(unitario, serie),
        });
      }
    }
    return m;
  }, [secoes, listaPrecos, compras]);

  const comparacao = useMemo(
    () => compararMercados(secoes.flatMap((s) => s.linhas), compras ?? []),
    [secoes, compras],
  );

  const mercadosConhecidos = useMemo(() => mercadosDoHistorico(compras ?? []), [compras]);

  // Itens distintos da lista atual (por chave normalizada), para o editor manual de preços.
  const itensParaPrecos = useMemo(() => {
    const vistos = new Set<string>();
    const nomes: string[] = [];
    for (const s of secoes) {
      for (const l of s.linhas) {
        const key = normalizeItemKey(l.item);
        if (vistos.has(key)) continue;
        vistos.add(key);
        nomes.push(l.item);
      }
    }
    return nomes;
  }, [secoes]);

  const nutriTotal = useMemo(() => {
    const pseudo: Ingredient[] = secoes
      .flatMap((s) => s.linhas)
      .flatMap((l) =>
        l.quantidades.map((q) => ({ raw: '', item: l.item, quantidade: q.quantidade, unidade: q.unidade, gondola: l.gondola })),
      );
    return calcularNutricaoTotal(pseudo);
  }, [secoes]);

  const total = secoes.reduce((n, s) => n + s.linhas.length, 0);
  const valorEstimadoTotal = Array.from(custoPorLinha.values()).reduce((s, v) => s + (v.valor ?? 0), 0);

  return {
    carregando: !recipes,
    estado,
    secoes,
    jaTenho,
    custoPorLinha,
    comparacao,
    mercadosConhecidos,
    itensParaPrecos,
    listaPrecos,
    nutriTotal,
    total,
    pesoTotal: pesoTotalKg(secoes),
    valorEstimadoTotal,
  };
}
