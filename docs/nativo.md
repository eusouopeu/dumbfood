# Android nativo: atalhos, widget e integração com Nexo e Brita

Quando ler: ao mexer em atalhos, widget, plugins Java ou na integração com o Nexo ou o Brita.
Fonte de verdade para: plugins nativos, deep links `dumbfood://` e contratos com o Nexo e o Brita.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

## Atalhos e widget

- `AtalhosPlugin.java` (plugin nativo "Atalhos", ponte em `src/lib/atalhos.ts`): atalhos do
  ícone (`res/xml/shortcuts.xml`) e o widget abrem `dumbfood://<destino>`
  (registrar, lista, importar); o JS navega por `rotaDoAtalho`. "registrar" vira
  `/?registrar=1` (HashRouter), que o `PainelDia` lê para abrir o registro de hoje.
- Widget do dia (`DiaWidgetProvider.java`, `layout/widget_dia.xml`): kcal de hoje contra a
  meta. O `PainelDia` manda os números a cada mudança (`atualizarWidget`), gravados em
  SharedPreferences `dumbfood_widget`.

## Integração com o Nexo e o Brita

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
