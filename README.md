# dumbfood

PWA para **importar receitas** de sites brasileiros (TudoGostoso, Panelinha/Rita Lobo e a maioria dos blogs de receita), **reescalar as quantidades** e gerar uma **lista de mercado unificada, somada e separada por gôndola**.

## O que faz

- 📥 **Importa receitas** por link (extrai os dados estruturados `schema.org/Recipe` da página) ou colando o texto dos ingredientes.
- 🎬 **Receitas de vídeo (TikTok/Reels)**: os ingredientes entram por texto colado ou por **OCR de um print da legenda**, e o vídeo baixado fica guardado no aparelho, tocando dentro do **modo de preparo** — offline.
- 🔢 **Reescala** as quantidades por **porção/pessoa/unidade** ou **por grama** (usando um ingrediente de referência).
- 🗓️ **Plano da semana**: selecione quais receitas fazer, em que quantidade e **em que dia/refeição** (agenda da semana começando por hoje).
- 🧊 **Geladeira integrada**: o que você já tem sai da lista de compras; o que você compra entra na geladeira; o que você cozinha dá baixa.
- 🛒 **Lista de mercado** unificada: soma ingredientes em comum (convertendo g/kg e ml/l), agrupa por seção do mercado (Hortifruti, Açougue, Mercearia, etc.) e **arredonda para as embalagens que o mercado vende de fato** (1 kg em vez de 700 g, com a sobra anotada).
- 💰 **Preços e mercados**: série histórica de preço por item (o que subiu, o que caiu), alerta de preço fora do padrão e estimativa de **quanto a lista sairia em cada mercado** já registrado.
- 📊 **Tabela nutricional e de vitaminas e minerais** estimadas por 100 g, a partir de uma base local (TACO/USDA) dos ingredientes mais usados.
- 💾 Tudo **offline** no dispositivo (IndexedDB), instalável como app. Exportar/importar JSON para backup (receitas e plano; os vídeos ficam só no aparelho).

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
    embalagens.ts         arredonda a lista para as embalagens de prateleira
    geladeira.ts          cruza receitas com o que já tem em casa
    agenda.ts             distribui o plano em dias da semana e refeições
    nutrition.ts          tabela nutricional estimada por 100 g
    micronutrientes.ts    vitaminas e minerais dos 40 ingredientes mais usados
    precoHistorico.ts     série de preço por item a partir das compras salvas
    mercados.ts           quanto a lista custaria em cada mercado do histórico
    ocrLegenda.ts         separa ingredientes/preparo de uma legenda de TikTok
    parseRecipeHtml.ts    extrai schema.org/Recipe (JSON-LD) do HTML
    fetchRecipe.ts        busca a página (server-side) e parseia
    importCache.ts        cache por URL + limite por IP do endpoint de importação
    importClient.ts       cliente: importar por URL ou por texto
  pages/         # Receitas, Importar, Detalhe, PlanoSemana, ListaMercado, Geladeira, Histórico, Configurações
api/
  import.ts      # função serverless (Vercel): busca a URL e devolve a receita
```

As tabelas nutricional e de vitaminas/minerais são **estimativas** por ingrediente-chave
(valores médios TACO/USDA, com proxies para famílias próximas). Servem para comparar
receitas e enxergar carências grosseiras, não para prescrição nutricional.

### Sobre a importação por link

Sites de receita normalmente bloqueiam requisições diretas do navegador (CORS + proteção anti-bot). Por isso a busca é feita **do lado do servidor**:

- **Em produção:** a função serverless `api/import.ts` (formato Vercel) faz o `fetch` e extrai o JSON-LD.
- **Em desenvolvimento:** um middleware do Vite (em `vite.config.ts`) reproduz o mesmo endpoint em `/api/import`, para que `npm run dev` importe por URL sem backend separado.

Se um site específico bloquear mesmo o acesso server-side, use a aba **“Colar texto”** na tela de importação.

O endpoint guarda em memória as receitas já buscadas (24 h) e limita as requisições por IP
(20/min): receita publicada não muda, e sem o limite a função viraria um proxy de fetch aberto.

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
