# dumbfood — instruções permanentes

App de receitas, plano da semana, lista de mercado por gôndola e diário de
consumo com metas nutricionais. React + TypeScript + Tailwind, Dexie,
Capacitor (Android); funções em `api/` (importar receita, nota fiscal).
Visão de produto no `README.md`.

Leia somente os documentos pertinentes à tarefa; não carregue documentação ou
arquivos grandes por padrão.

## Padrões compartilhados

Segue `../_shared/tech-standards.md` (stack, testes, commit/push/release,
`/caveman`, subagentes, dependências), `../_shared/design-standards.md`,
`../_shared/minimalismo.md` e `../_shared/docs-standards.md`. Ícones já usam
Heroicons, alinhado ao padrão.

- "Ajuda recolhida" já aplicada aos selos de qualidade (`SelosQualidade`): o
  ⓘ abre o motivo de cada selo (`Selo.motivo` em `src/lib/rating.ts`) e a
  regra da nota.

## Regras invioláveis

- Página com mais de ~350 linhas é quebrada: cálculo vai para `src/lib/`
  (puro e testável) e UI para `src/components/<área>/`.
- Telas fora da inicial entram por `React.lazy` em `App.tsx` (OCR, leitor de
  QR e vídeo não pesam na primeira abertura).
- Dado do usuário (receitas, plano, consumo, compras) fica no Dexie;
  preferências de interface ficam em `localStorage` com prefixo `dumbfood:`
  — tudo com esse prefixo entra no backup JSON automaticamente.
- Ação principal de tela entra como botão flutuante e o formulário vira
  folha/modal; todo flutuante fica a `bottom-[4.9rem]`. Demais regras de
  navegação e barras: `docs/interface.md`.
- No celular, `input`/`select`/`textarea` têm fonte de 16px (`index.css`),
  senão o navegador dá zoom ao focar.

## Contratos sensíveis

- Duas bases de percentual: `src/lib/diet.ts` (massa, só Histórico) e
  `src/lib/metas.ts` (energia, meta do dia). Não misturar; detalhes em
  `docs/metas-nutricionais.md`.
- `src/lib/rating.ts` recebe sempre valores **por 100 g**.
- Exercício **não** muda a meta de calorias (o fator de atividade já conta o
  gasto habitual).
- `Refeicao` é chave aberta (refeições próprias); a divisão da meta entre
  refeições é renormalizada a cada mudança — a soma é sempre a meta.
- Integração com o Nexo: `CompartilharProvider.java` só responde ao
  `com.pedro.nexo` assinado pela chave de debug do Mac (SHA-256 fixo no Java).
  Trocar a keystore exige atualizar a constante lá e no `Assinatura.java` do
  Nexo. O provider entrega `/brita` só ao `com.pedro.rotinas` assinado pela
  `brita.keystore` (`CHAVE_BRITA`). Detalhes em `docs/nativo.md`.
- `android/debug.keystore` é versionada (= chave de debug do Mac e do Nexo):
  APK da nuvem atualiza o instalado. Não trocar.
- Chaves fora do backup de propósito (sem o prefixo `dumbfood:`):
  `dumbfoodIA:chave` (chave da IA) e `dumbfoodNexo:evitar`.
- IA (`src/lib/ia.ts`) usa `claude-haiku-5-5` com saída JSON; detalhes em
  `docs/fome-ia-lugares.md`.

## Fluxo de trabalho

- Faça a menor alteração completa; não faça refactor não relacionado.
- Antes de propor melhorias ou recriar algo, consulte
  `docs/feature-status.md` ("Não reimplementar") e `docs/aprimoramentos.md`
  ("Recomendações refutadas").
- Build do APK (o restante segue o fluxo global):
  ```bash
  npm run android:sync
  cd android && ./gradlew assembleDebug
  ```
  APK copiado para a raiz como `dumbfood-<versionName>.apk` (fora do git).
- Push para `origin/main`.

## Fim de sessão

Antes do commit, atualizar: `docs/decisoes.md` (decisão nova no topo),
`docs/pendencias.md`, `docs/feature-status.md` se uma funcionalidade visível
mudou, `docs/aprimoramentos.md` se uma melhoria foi entregue ou recusada e o
documento temático tocado (`interface`, `nativo`, `metas-nutricionais`,
`fome-ia-lugares`).

## Atualização desta documentação

- `CLAUDE.md` só muda quando uma regra global do projeto muda.
- Detalhe de tela, componente ou cálculo vai para o `docs/<tema>.md`.

## Navegação

| Arquivo | Quando ler |
|---|---|
| `docs/interface.md` | Telas, abas, barras, botões flutuantes, organização de páginas |
| `docs/metas-nutricionais.md` | Metas, macros, perfil, consumo, peso, exercício, selos, refeições |
| `docs/nativo.md` | Atalhos, widget, plugins Java, integração com Nexo e Brita |
| `docs/fome-ia-lugares.md` | Fome, IA (Claude Haiku), cercas de GPS, alarme da cozinha, hortifrúti |
| `docs/decisoes.md` | Antes de mudar comportamento já decidido |
| `docs/pendencias.md` | Ao retomar o projeto ou propor próximos passos |
| `docs/feature-status.md` | Antes de criar ou remover funcionalidade |
| `docs/aprimoramentos.md` | Antes de sugerir melhorias |
