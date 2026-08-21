# Instruções para o Codex neste projeto

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
