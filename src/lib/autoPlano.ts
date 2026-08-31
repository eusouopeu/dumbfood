// Sugestão automática do plano da semana: pontua as receitas da biblioteca por
// favorito + cobertura da geladeira, e escolhe as melhores com alguma diversidade de
// tags — pra "montar a semana" não devolver cinco receitas de bolo.

import type { GeladeiraItem, Recipe } from '../types';
import { combinarReceitas } from './geladeira';
import { statusValidade } from './validade';

/** Peso do quanto a receita ajuda a não desperdiçar: mais urgente, mais peso. */
function urgenciaItem(g: GeladeiraItem, agora: number): number {
  if (g.validade == null) return 0;
  const status = statusValidade(g.validade, agora);
  if (status === 'vencido') return 3;
  if (status === 'vence_hoje') return 2;
  if (status === 'proximo') return 1;
  return 0;
}

/**
 * Escolhe até `quantidade` receitas para completar o plano, ignorando as que já
 * estão em `jaSelecionadas`. Pontua por favorito + cobertura da geladeira + quanto
 * a receita aproveita itens perto de vencer (o auto-plano vira também "o que evita
 * desperdício"), e limita quantas receitas da mesma tag principal entram, para não
 * repetir o mesmo tipo de prato.
 */
export function sugerirReceitasParaPlano(
  recipes: Recipe[],
  geladeira: GeladeiraItem[],
  jaSelecionadas: Set<string>,
  quantidade: number,
  agora = Date.now(),
): Recipe[] {
  const candidatas = recipes.filter((r) => !jaSelecionadas.has(r.id));
  if (candidatas.length === 0 || quantidade <= 0) return [];

  const porItemKey = new Map(geladeira.map((g) => [g.itemKey, g]));
  const combinacoes = combinarReceitas(candidatas, geladeira);
  const pontuacaoPorId = new Map(
    combinacoes.map((c) => {
      const urgencia = c.usados.reduce((soma, itemKey) => {
        const item = porItemKey.get(itemKey);
        return item ? soma + urgenciaItem(item, agora) : soma;
      }, 0);
      return [c.recipe.id, (c.recipe.favorito ? 1 : 0) + c.cobertura + urgencia];
    }),
  );

  const pontuadas = candidatas
    .map((r) => ({ recipe: r, pontuacao: pontuacaoPorId.get(r.id) ?? 0 }))
    .sort((a, b) => b.pontuacao - a.pontuacao || a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR'));

  const limitePorTag = Math.max(2, Math.ceil(quantidade / 2));
  const contagemTag = new Map<string, number>();
  const escolhidas: Recipe[] = [];

  for (const { recipe } of pontuadas) {
    if (escolhidas.length >= quantidade) break;
    const tagPrincipal = recipe.tags?.[0];
    const usos = tagPrincipal ? (contagemTag.get(tagPrincipal) ?? 0) : 0;
    if (tagPrincipal && usos >= limitePorTag) continue;
    escolhidas.push(recipe);
    if (tagPrincipal) contagemTag.set(tagPrincipal, usos + 1);
  }

  // Se o limite de diversidade deixou vagas sobrando (poucas receitas cobrem tags
  // diferentes), completa o restante só por pontuação, sem essa restrição.
  if (escolhidas.length < quantidade) {
    for (const { recipe } of pontuadas) {
      if (escolhidas.length >= quantidade) break;
      if (!escolhidas.includes(recipe)) escolhidas.push(recipe);
    }
  }

  return escolhidas;
}
