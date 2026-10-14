# Fome, IA e lembretes por lugar

Quando ler: ao mexer em "Estou com fome", IA (Claude Haiku), cercas de GPS, alarme da cozinha ou lembrete de hortifrúti.
Fonte de verdade para: tabela `fome`, cliente de IA e lembretes por lugar.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

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
