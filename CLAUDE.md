# Instruções para o Claude neste projeto

## Commit, push e APK automáticos

Sempre que uma mudança for implementada no app (qualquer alteração de código em
`src/`, `api/`, ou configuração relacionada), ao final do trabalho:

1. Faça o commit das mudanças (mensagem em português, no mesmo estilo dos commits
   existentes — resumo direto do que mudou, sem prefixo tipo "feat:"/"fix:").
2. Dê `git push` para `origin/main`.
3. Gere o APK de debug atualizado:
   ```bash
   npm run android:sync
   cd android && ./gradlew assembleDebug
   ```
   O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Isso vale automaticamente, sem precisar que o usuário peça a cada vez. Só pule
esse fluxo se o usuário pedir explicitamente para não commitar/buildar ainda
(ex.: quando está pedindo uma mudança exploratória ou intermediária).

## Agentes em segundo plano

Para tarefas independentes e bem simples (ex.: pesquisar algo pontual, checar
um arquivo, gerar um resumo isolado que não depende do restante do trabalho
em andamento), pode usar agentes em segundo plano (Agent tool) sem precisar
pedir permissão a cada vez. Reserve isso para tarefas simples e realmente
independentes — não usar para dividir uma tarefa complexa ou que exija
contexto acumulado da conversa.

## Padrões compartilhados

Este projeto segue os padrões comuns aos apps do Pedro, documentados em
`../_shared/tech-standards.md` (stack, testes, commit/push/release, skill
`/caveman` obrigatória, subagentes, leitura de dependências) e
`../_shared/design-standards.md` + `../_shared/minimalismo.md` (visual,
ícones, estética minimalista, "ajuda recolhida"). Ícones já usam Heroicons,
alinhado ao padrão compartilhado.

"Ajuda recolhida" já aplicada aos selos de qualidade (`SelosQualidade`): o ícone ⓘ
abre o motivo de cada selo (valor por 100 g contra o limite, vindo de `Selo.motivo` em
`src/lib/rating.ts`) e a regra da nota.

## Organização do código

- Página com mais de ~350 linhas deve ser quebrada: a lógica de cálculo vai para `src/lib/`
  (pura e testável) e os pedaços de UI para `src/components/<área>/` (`lista/`, `plano/`,
  `receita/`, `receitas/`, `geladeira/`).
- As telas fora da inicial entram por `React.lazy` em `App.tsx`, para o OCR (tesseract), o
  leitor de QR (jsQR) e o vídeo não pesarem na primeira abertura. A tela inicial (`/`,
  `src/pages/Inicio.tsx`) é **o dia**: só o painel de calorias/macros/refeições
  (`PainelDia`) e a barra flutuante "inserir refeição…" acima da navegação, que abre a
  busca de registro já filtrada, na refeição da hora (`refeicaoPorHorario`).
- Abas da barra: Início (`/`), Receitas (`/receitas`), Semana (`/plano` e `/plano/dias`, a
  mesma aba) e Mercado (`/geladeira` e `/lista`, a mesma aba). Histórico (`/historico`) fica
  separado, num círculo à direita.
- Semana e Mercado trocam de visão por uma pílula flutuante de ícones
  (`src/components/PilulaAbas.tsx`). Semana: montar pelas receitas (lista) ou pelos dias
  (agenda com "+" por dia); as duas visões têm "montar semana" e "macros do plano".
- "Montar semana" escolhe as receitas e também as distribui na agenda
  (`src/lib/distribuirSemana.ts`): uma porção por refeição, a partir de hoje, pratos em
  almoço/jantar, bolos e doces no lanche, molhos e acompanhamentos fora; não mexe no que já
  foi agendado à mão.
- Tocar de novo no ícone de Configurações ou Perfil, estando na própria página, volta para a
  última aba aberta antes dela.
- Todo botão flutuante (FABs, pílulas) fica a `bottom-[4.9rem]`, a mesma distância da barra
  "inserir refeição…" até a barra inferior.
- A barra inferior é **flutuante e vítrea** (`backdrop-blur`, fundo translúcido), em duas
  peças: pílula com os quatro destinos e círculo do histórico. Só ícones, com pílula de
  fundo no ativo.
- Dentro da aba Mercado, geladeira e lista trocam por uma **pílula flutuante de ícones**
  (`src/components/AbasMercado.tsx`) no canto de baixo, ao lado do FAB laranja; cada ícone
  é um link de verdade.
- Ordem dos botões da barra superior: nova receita, tema, configurações, perfil.
- A barra "inserir refeição…" também é vítrea e fica colada acima da barra inferior.
- Macros das abas Semana e Mercado usam barras (`MacroBarrasCard`, com `barrasSemana` em
  `metas.ts`), sem seletor de dieta: gramas do plano/lista contra a meta em gramas de Perfil
  e metas multiplicada por 7, com o percentual do perfil ao lado do nome. A tabela por dieta
  (`MacroResumoCard`, em massa) ficou só no Histórico.
- Receitas não têm mais seleção múltipla nem filtro por tempo.
- Na aba Mercado, importar nota fiscal e adicionar item saem de um FAB (`lista/FabLista.tsx`)
  como cards, ao lado do seletor geladeira/lista. Orçamento da semana e atualizar preços
  ficam em Configurações. As sugestões da geladeira ficam recolhidas atrás de um toggle.
- No celular, `input`/`select`/`textarea` têm fonte de 16px (regra em `index.css`): abaixo
  disso o navegador dá zoom ao focar o campo.
- Ações principais de uma tela entram como botão flutuante (a geladeira tem o `+`; o
  leitor de código de barras fica dentro da folha de adicionar), e o formulário
  correspondente vira folha/modal em vez de ocupar o topo da tela.
- Cores das gôndolas (`src/lib/aisles.ts`) são as mesmas nos dois temas: fundo escuro,
  texto claro.
- Preferências de interface (tema, dieta, orçamento, perfil, meta diária) ficam em
  `localStorage` sob o prefixo `dumbfood:`; tudo com esse prefixo entra e volta no backup
  JSON automaticamente. Dado do usuário (receitas, plano, consumo, compras) fica no Dexie.

## Android: atalhos e widget

- `AtalhosPlugin.java` (plugin nativo "Atalhos", ponte em `src/lib/atalhos.ts`): atalhos do
  ícone (`res/xml/shortcuts.xml`) e o widget abrem `dumbfood://<destino>`
  (registrar, lista, importar); o JS navega por `rotaDoAtalho`. "registrar" vira
  `/?registrar=1` (HashRouter), que o `PainelDia` lê para abrir o registro de hoje.
- Widget do dia (`DiaWidgetProvider.java`, `layout/widget_dia.xml`): kcal de hoje contra a
  meta. O `PainelDia` manda os números a cada mudança (`atualizarWidget`), gravados em
  SharedPreferences `dumbfood_widget`.

## Metas nutricionais: duas bases de percentual

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

Testes, commit/push, atualização do CLAUDE.md e leitura de dependências: ver
`../_shared/tech-standards.md`.

