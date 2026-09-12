// Tela inicial: o dia. Contagem de calorias e macros contra a meta, as refeições e a
// barra de adição rápida — a pergunta de quem abre o app é "quanto ainda cabe hoje?",
// não "o que tem na geladeira" nem "o que comprar".

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { CardListSkeleton } from '../components/Skeleton';
import PainelDia from '../components/plano/PainelDia';

export default function Inicio() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const plano = usePlano();

  if (!recipes) return <CardListSkeleton linhas={3} />;
  return <PainelDia recipes={recipes} itensPlano={plano.itens} />;
}
