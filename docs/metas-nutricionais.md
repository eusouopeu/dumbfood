# Metas nutricionais, consumo e perfil

Quando ler: ao mexer em metas, macros, perfil, consumo, peso, exercício, selos ou refeições.
Fonte de verdade para: bases de percentual (massa × energia), tabelas Dexie de consumo/peso/exercício e regras de cálculo.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

- `src/lib/diet.ts` trabalha em **percentual da massa** de macros e hoje serve só ao
  Histórico (composição das compras passadas).
- `src/lib/metas.ts` trabalha em **percentual da energia** (kcal) e é a meta *do dia*:
  calorias-alvo + divisão de macros, convertidas em gramas com 4/4/9 kcal por grama.
  `ajustarMacros` renormaliza para 100% a cada movimento, respeitando o macro travado —
  não existe estado inválido para "salvar".
- `src/lib/perfil.ts` estima o gasto diário (Mifflin-St Jeor × fator de atividade ×
  ajuste do objetivo). A tela `/perfil` edita perfil, calorias e macros juntos.
- `src/lib/rating.ts` transforma a tabela nutricional em selos de qualidade (limites por
  100 g, na lógica das alegações da ANVISA). Sempre alimentado com valores **por 100 g**.
- O consumo de fato comido fica na tabela `consumo` (Dexie v11), com `dia` em
  'AAAA-MM-DD' local. A tabela `codigos` guarda código de barras → ingrediente e a
  `exercicios` guarda o gasto do dia (nome + kcal, minutos opcionais), registrado à mão.
- Peso corporal: cada mudança válida no campo Peso de `/perfil` grava o registro do dia na
  tabela `pesos` (Dexie v12, chave `dia`); `src/lib/pesoCorporal.ts` calcula a tendência e
  `perfil/EvolucaoPeso` desenha a linha. O perfil continua com o peso atual para a meta.
- Registrar uma **receita** comida desconta os ingredientes da despensa
  (`src/lib/baixaDespensa.ts`), na proporção porções ÷ rendimento, só nos itens com
  quantidade conhecida; o aviso tem "Desfazer". Liga/desliga em Configurações
  (`dumbfood:baixaPorConsumo`).
- Exercício **não** muda a meta de calorias (`src/lib/exercicios.ts`): o fator de atividade
  do perfil já conta o gasto habitual, somar de novo contaria duas vezes. O número aparece
  como coluna própria do anel do dia.
- Além de café/almoço/lanche/jantar, o usuário cria refeições próprias
  (`src/lib/refeicoes.ts`, em `dumbfood:refeicoesExtras`). Por isso `Refeicao` é chave
  aberta (`RefeicaoPadrao | (string & {})`) e a divisão da meta entre refeições é
  **renormalizada** a cada mudança de lista — a soma dos recomendados é sempre a meta.
