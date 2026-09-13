// Montar semana, parte 2: depois de escolher as receitas, pôr cada uma num dia e numa
// refeição. Sem isso o botão entregava uma lista solta e a agenda ficava toda "sem dia".
//
// As porções viram refeições (uma porção por refeição), a partir de hoje. Pratos vão
// para almoço e jantar; bolos, doces e afins, para o lanche. Primeiro cada receita ganha
// um lugar — nenhuma fica de fora por causa de outra com muitas porções — e depois as
// porções restantes entram intercaladas, para a semana não virar sete dias do mesmo prato.
// Lugares já agendados à mão não são tocados.

import { deburr } from './ingredientParser';
import type { Agendamento, Recipe, RefeicaoPadrao } from '../types';

export type TipoNaSemana = 'principal' | 'lanche';

export interface ReceitaParaDistribuir {
  recipeId: string;
  /** Porções que a quantidade escolhida rende; cada uma ocupa uma refeição. */
  porcoes: number;
  tipo: TipoNaSemana;
}

const REFEICOES_DO_TIPO: Record<TipoNaSemana, RefeicaoPadrao[]> = {
  principal: ['almoco', 'jantar'],
  lanche: ['lanche'],
};

const PALAVRAS_LANCHE = ['bolo', 'doce', 'sobremesa', 'lanche', 'biscoito', 'cookie', 'pao', 'panqueca', 'muffin', 'suco', 'vitamina', 'brigadeiro'];
/** Preparos que acompanham outro prato e não são uma refeição por si. */
const PALAVRAS_ACOMPANHAMENTO = ['molho', 'tempero', 'caldo', 'pasta de'];

/** Onde a receita cabe na semana, ou null quando ela é só acompanhamento. */
export function tipoDaReceita(recipe: Recipe): TipoNaSemana | null {
  const texto = deburr(`${recipe.titulo} ${(recipe.tags ?? []).join(' ')}`).toLowerCase();
  if (PALAVRAS_ACOMPANHAMENTO.some((p) => texto.includes(p))) return null;
  if (PALAVRAS_LANCHE.some((p) => texto.includes(p))) return 'lanche';
  return 'principal';
}

function lugaresLivres(tipo: TipoNaSemana, hoje: number, ocupados: Agendamento[]): Agendamento[] {
  const livres: Agendamento[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = (hoje + i) % 7;
    for (const refeicao of REFEICOES_DO_TIPO[tipo]) {
      if (!ocupados.some((o) => o.dia === dia && o.refeicao === refeicao)) livres.push({ dia, refeicao });
    }
  }
  return livres;
}

/** Agendamentos sugeridos por receita, na ordem em que a semana acontece. */
export function distribuirSemana(
  receitas: ReceitaParaDistribuir[],
  hoje: number,
  ocupados: Agendamento[] = [],
): Map<string, Agendamento[]> {
  const resultado = new Map<string, Agendamento[]>();

  for (const tipo of ['principal', 'lanche'] as TipoNaSemana[]) {
    const doTipo = receitas.filter((r) => r.tipo === tipo);
    const livres = lugaresLivres(tipo, hoje, ocupados);
    const restante = new Map(doTipo.map((r) => [r.recipeId, Math.max(1, Math.round(r.porcoes))]));
    let proximo = 0;

    const colocar = (recipeId: string) => {
      resultado.set(recipeId, [...(resultado.get(recipeId) ?? []), livres[proximo++]]);
      restante.set(recipeId, (restante.get(recipeId) ?? 0) - 1);
    };

    for (const r of doTipo) {
      if (proximo >= livres.length) break;
      colocar(r.recipeId);
    }

    let colocouAlguma = true;
    while (proximo < livres.length && colocouAlguma) {
      colocouAlguma = false;
      for (const r of doTipo) {
        if (proximo >= livres.length) break;
        if ((restante.get(r.recipeId) ?? 0) > 0) {
          colocar(r.recipeId);
          colocouAlguma = true;
        }
      }
    }
  }

  return resultado;
}
