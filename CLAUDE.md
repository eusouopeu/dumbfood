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

## Fome, IA e lembretes por lugar

- Fome: "Estou com fome" (relógio na barra "inserir refeição…", atalho do ícone
  `dumbfood://fome` → `/?fome=1`) grava na tabela `fome` (Dexie v13). `src/lib/fome.ts` junta
  esses toques com o horário de lançamento do consumo (só quando lançado no mesmo dia) e acha
  os picos; a tela é a aba Fome do Histórico (`historico/AnaliseFome.tsx`).
- IA (`src/lib/ia.ts`, SDK `@anthropic-ai/sdk` direto do app, modelo `claude-haiku-5-5`,
  saída em JSON por `output_config.format`): chave em `dumbfoodIA:chave` — **fora** do prefixo
  `dumbfood:` para não ir no backup. Estima prato fora do acervo na busca do registro (vira
  `pratos`, Dexie v13) e arruma a lista de mercado (`lib/correcaoLista.ts`, entra por
  overrides/ocultos/extras, com Desfazer).
- Lugares (`src/lib/lugares.ts` + `Lugares*.java`, `GeofenceReceiver`, `AlarmeService`,
  `BootReceiver`, `Avisos`): cercas do Google Play services (`play-services-location`).
  Cozinha (DWELL 1 min) → notificação ou alarme em loop até "Desligar"/abrir o registro;
  saída da academia → "passe no mercado" se `itensAcabando` (`lib/despensaAcabando.ts`) ou dia
  de hortifrúti; dias de hortifrúti também viram notificação semanal (ids 2000–2006). Config
  em `dumbfood:lugares`; o JS publica itens acabando e último registro em SharedPreferences
  `dumbfood_lugares`. GPS não separa cômodos.
- Assinatura: `android/debug.keystore` versionada (= chave de debug do Mac e do Nexo); o
  `build.gradle` assina com ela, então APK da nuvem atualiza o instalado.

## Integração com o Nexo (refeições → diário de saúde)

- `src/lib/compartilharNexo.ts` monta o pacote dos últimos 14 dias de consumo (horário,
  rótulo da refeição, kcal, ingredientes da receita) e o `App.tsx` o republica a cada mudança
  no consumo, via plugin nativo `Compartilhar` (`CompartilharPlugin.java`, arquivo privado).
- `CompartilharProvider.java` (`content://br.com.dumbfood.app.compartilhar/alimentacao`) só
  responde ao `com.pedro.nexo` assinado pela chave de debug do Mac (SHA-256 fixo no Java).
  Sem internet: o Nexo lê ao abrir. Liga/desliga em Configurações › Nexo
  (`dumbfood:enviarNexo`, padrão ligado). Trocar a keystore exige atualizar a constante lá
  e no `Assinatura.java` do Nexo.
- Brita: `src/lib/compartilharBrita.ts` publica kcal/meta, cardápio do plano (7 dias para trás
  e para a frente), itens acabando e dias de hortifrúti; o provider entrega em `/brita` só ao
  `com.pedro.rotinas` assinado pela `brita.keystore` (`CHAVE_BRITA`). Configurações › Nexo e
  Brita (`dumbfood:enviarBrita`, padrão ligado).
- Nexo → dumbfood: `src/lib/avisosNexo.ts` lê `content://com.pedro.nexo.compartilhar/dumbfood`
  (alergias da ficha e teste de eliminação ativo) e marca receitas/pratos no registro. Guardado
  em `dumbfoodNexo:evitar` (fora do backup); `dumbfood:receberNexo`, padrão ligado.
- O APK de debug é copiado para a raiz como `dumbfood-<versionName>.apk` (fora do git);
  `versionName` segue `AAAA.MM.DD-n`.

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

