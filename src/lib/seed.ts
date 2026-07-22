// Receitas de exemplo (offline) para testar o app sem depender de importação.

import type { NewRecipe } from '../types';
import { parseIngredientLines } from './ingredientParser';
import { gerarTags } from './tags';

const base: Array<Omit<NewRecipe, 'tags'> & { tempoPreparoMin?: number }> = [
  {
    titulo: 'Molho de tomate caseiro',
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    tempoPreparoMin: 40,
    ingredientes: parseIngredientLines([
      '2 cebolas picadas',
      '4 dentes de alho',
      '1 kg de tomate',
      '3 colheres de sopa de azeite',
      '1 colher de chá de sal',
      'manjericão a gosto',
    ]),
    modoPreparo: [
      'Refogue a cebola e o alho no azeite.',
      'Acrescente o tomate e cozinhe por 30 minutos.',
      'Tempere com sal e finalize com manjericão.',
    ],
  },
  {
    titulo: 'Frango ao curry',
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    tempoPreparoMin: 30,
    ingredientes: parseIngredientLines([
      '600 g de peito de frango',
      '1 cebola picada',
      '2 dentes de alho',
      '400 ml de leite de coco',
      '1 colher de sopa de curry',
      '2 colheres de sopa de azeite',
      'sal a gosto',
    ]),
    modoPreparo: [
      'Doure o frango no azeite e reserve.',
      'Refogue cebola e alho, junte o curry.',
      'Volte o frango, adicione o leite de coco e cozinhe por 20 minutos.',
    ],
  },
  {
    titulo: 'Bolo de cenoura',
    rendimentoBase: { valor: 12, tipo: 'porcoes' },
    tempoPreparoMin: 60,
    ingredientes: parseIngredientLines([
      '3 cenouras médias',
      '4 ovos',
      '1 xícara de óleo',
      '2 xícaras de açúcar',
      '3 e 1/2 xícaras de farinha de trigo',
      '1 colher de sopa de fermento em pó',
    ]),
    modoPreparo: [
      'Pré-aqueça o forno a 180 °C por 10 minutos.',
      'Bata no liquidificador a cenoura, os ovos e o óleo.',
      'Misture o açúcar e a farinha, junte o fermento por último.',
      'Asse por aproximadamente 40 minutos.',
    ],
  },
];

export function receitasExemplo(): NewRecipe[] {
  return base.map((r) => ({ ...r, tags: gerarTags(r.titulo, r.ingredientes) }));
}
