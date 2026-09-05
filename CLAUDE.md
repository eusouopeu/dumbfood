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
  leitor de QR (jsQR) e o vídeo não pesarem na primeira abertura.
- Cores das gôndolas (`src/lib/aisles.ts`) são as mesmas nos dois temas: fundo escuro,
  texto claro.

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

