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

## Skill obrigatória

SEMPRE usar a skill `/caveman` (modo de comunicação ultra-comprimido) em toda resposta neste projeto.


## Padrões técnicos e visuais obrigatórios

- Sempre usar **TypeScript**, **Tailwind CSS** e fonte **Montserrat** com espaçamento
  entrelinhas (line-height) de 1.5.
- Ícones: o app usa **Heroicons** (`@heroicons/react/24/outline`) em todas as telas. Manter
  Heroicons por consistência — não misturar com Lucide.
- Dar preferência a **botões-ícone** em vez de botões com texto.

## Organização do código

- Página com mais de ~350 linhas deve ser quebrada: a lógica de cálculo vai para `src/lib/`
  (pura e testável) e os pedaços de UI para `src/components/<área>/` (`lista/`, `plano/`,
  `receita/`, `receitas/`).
- As telas fora da inicial entram por `React.lazy` em `App.tsx`, para o OCR (tesseract), o
  leitor de QR (jsQR) e o vídeo não pesarem na primeira abertura. A tela inicial (`/`,
  `src/pages/Inicio.tsx`) é **o dia**: só o painel de calorias/macros/refeições
  (`PainelDia`) e a barra flutuante "inserir refeição…" acima da navegação, que abre a
  busca de registro já filtrada, na refeição da hora (`refeicaoPorHorario`).
- Abas da barra: Início (`/`), Receitas (`/receitas`), Semana (`/plano`, sem o painel do
  dia) e Mercado (`/geladeira` e `/lista`, a mesma aba). Histórico (`/historico`) fica
  separado, num círculo à direita.
- A barra inferior é **flutuante e vítrea** (`backdrop-blur`, fundo translúcido), em duas
  peças: pílula com os quatro destinos e círculo do histórico. Só ícones, com pílula de
  fundo no ativo.
- Dentro da aba Mercado, geladeira e lista trocam por uma **pílula flutuante de ícones**
  (`src/components/AbasMercado.tsx`) no canto de baixo, ao lado do FAB laranja; cada ícone
  é um link de verdade.
- Ordem dos botões da barra superior: nova receita, tema, configurações, perfil.
- Ações principais de uma tela entram como botão flutuante (a geladeira tem o `+`; o
  leitor de código de barras fica dentro da folha de adicionar), e o formulário
  correspondente vira folha/modal em vez de ocupar o topo da tela.
- Cores das gôndolas (`src/lib/aisles.ts`) são as mesmas nos dois temas: fundo escuro,
  texto claro.
- Preferências de interface (tema, dieta, orçamento, perfil, meta diária) ficam em
  `localStorage` sob o prefixo `dumbfood:`; tudo com esse prefixo entra e volta no backup
  JSON automaticamente. Dado do usuário (receitas, plano, consumo, compras) fica no Dexie.

## Metas nutricionais: duas bases de percentual

- `src/lib/diet.ts` trabalha em **percentual da massa** de macros e serve às telas de
  composição da compra (Mercado, Histórico), que não têm "dia".
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
- Exercício **não** muda a meta de calorias (`src/lib/exercicios.ts`): o fator de atividade
  do perfil já conta o gasto habitual, somar de novo contaria duas vezes. O número aparece
  como coluna própria do anel do dia.
- Além de café/almoço/lanche/jantar, o usuário cria refeições próprias
  (`src/lib/refeicoes.ts`, em `dumbfood:refeicoesExtras`). Por isso `Refeicao` é chave
  aberta (`RefeicaoPadrao | (string & {})`) e a divisão da meta entre refeições é
  **renormalizada** a cada mudança de lista — a soma dos recomendados é sempre a meta.

## Testes

- Por rodada de alterações, realizar apenas os **2 ou 3 testes mais essenciais** — não mais que isso.
- Esses testes devem ser **elaborados ANTES** da implementação das mudanças de código, para que não
  sejam enviesados pelo resultado da implementação.


## Commit, push e atualização do CLAUDE.md

- A cada rodada em que o código do app/site for alterado, deve ser feito o **commit** e o **push**
  para o repositório remoto no GitHub.
- Nessa mesma rodada, atualizar o conteúdo deste **CLAUDE.md** no que couber (novas convenções,
  decisões, mudanças de stack, etc.), mantendo-o coerente com o estado atual do projeto.

## Proibição de leitura de dependências

- NUNCA ler arquivos de dependências (ex.: `node_modules/`, `dist/`, `build/`, pastas de vendor
  ou qualquer artefato gerado/instalado) para obter contexto. Usar apenas o código-fonte do
  próprio projeto.

