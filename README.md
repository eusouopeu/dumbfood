# dumbfood

PWA para **importar receitas** de sites brasileiros (TudoGostoso, Panelinha/Rita Lobo e a maioria dos blogs de receita), **reescalar as quantidades** e gerar uma **lista de mercado unificada, somada e separada por gôndola**.

## O que faz

- 📥 **Importa receitas** por link (extrai os dados estruturados `schema.org/Recipe` da página) ou colando o texto dos ingredientes.
- 🔢 **Reescala** as quantidades por **porção/pessoa/unidade** ou **por grama** (usando um ingrediente de referência).
- 🗓️ **Plano da semana**: selecione quais receitas fazer e em que quantidade.
- 🛒 **Lista de mercado** unificada: soma ingredientes em comum (convertendo g/kg e ml/l) e agrupa por seção do mercado (Hortifruti, Açougue, Mercearia, etc.), com checkboxes para marcar o que já pegou.
- 💾 Tudo **offline** no dispositivo (IndexedDB), instalável como app. Exportar/importar JSON para backup.

## Stack

React + TypeScript + Vite · Tailwind CSS · Dexie (IndexedDB) · vite-plugin-pwa · Vitest.

## Rodando

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # testes do parser, agregação e extração de JSON-LD
npm run build     # gera dist/ (PWA com service worker)
npm run preview   # serve o build de produção
```

Sem dados? Na tela inicial, use **“Adicionar receitas de exemplo”** para testar o fluxo completo sem depender de importação.

## Arquitetura

```
src/
  db/            # Dexie (IndexedDB): receitas e plano da semana
  lib/
    ingredientParser.ts   "2 xícaras de farinha" -> { quantidade, unidade, item }
    units.ts              dicionário de unidades PT-BR + conversões
    aisles.ts             classificação de item -> gôndola
    scale.ts              reescala por fator
    shoppingList.ts       agrega + soma + agrupa por gôndola
    parseRecipeHtml.ts    extrai schema.org/Recipe (JSON-LD) do HTML
    fetchRecipe.ts        busca a página (server-side) e parseia
    importClient.ts       cliente: importar por URL ou por texto
  pages/         # Receitas, Importar, Detalhe, PlanoSemana, ListaMercado
api/
  import.ts      # função serverless (Vercel): busca a URL e devolve a receita
```

### Sobre a importação por link

Sites de receita normalmente bloqueiam requisições diretas do navegador (CORS + proteção anti-bot). Por isso a busca é feita **do lado do servidor**:

- **Em produção:** a função serverless `api/import.ts` (formato Vercel) faz o `fetch` e extrai o JSON-LD.
- **Em desenvolvimento:** um middleware do Vite (em `vite.config.ts`) reproduz o mesmo endpoint em `/api/import`, para que `npm run dev` importe por URL sem backend separado.

Se um site específico bloquear mesmo o acesso server-side, use a aba **“Colar texto”** na tela de importação.

## Deploy

Compatível com hospedagem estática + 1 função serverless (ex.: Vercel): `npm run build` gera o estático em `dist/` e `api/import.ts` vira a função. Para hospedagem 100% estática sem backend, use apenas o fluxo de “Colar texto”.

## App Android (Capacitor)

O mesmo código roda como app nativo Android via [Capacitor](https://capacitorjs.com), empacotado offline (sem depender do GitHub Pages).

```bash
npm run android:sync   # build (sem service worker) + copia pra android/
npm run android:open   # abre o projeto no Android Studio
```

Pelo Android Studio: `Run ▶` instala no emulador/aparelho conectado, ou `Build > Generate Signed Bundle/APK` para gerar o `.apk`/`.aab` de release. Sem abrir o Android Studio, um debug APK pode ser gerado direto:

```bash
npm run android:sync
cd android && ./gradlew assembleDebug   # gera android/app/build/outputs/apk/debug/app-debug.apk
```

- `capacitor.config.ts`: configuração do pacote (appId, nome, `webDir`).
- `resources/icon.png` e `resources/splash.png`: fontes do ícone e da splash screen — depois de alterar, rode `npm run android:assets` para regerar os arquivos em `android/app/src/main/res/`.
- A importação por link precisa de rede; o resto do app funciona 100% offline (IndexedDB local).
