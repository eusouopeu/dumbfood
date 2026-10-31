# Estado de funcionalidades

Quando ler: antes de criar, remover ou recriar funcionalidade.
Fonte de verdade para: o que foi removido e não deve voltar; contratos visíveis.
Atualizado em: 31/10/2026.

## Não reimplementar

Funcionalidade removida ou substituída, com data e o que cobre o uso agora.

- Modo cozinha (tela cheia, timers e bip próprios) – removido em 22/08/2026; os temporizadores flutuantes com alarme (31/08/2026) cobrem o uso.
- Lembrete na aba Semana e bloco "Com o que você tem" em Receitas – removidos em 12/09/2026.
- Preços editados por arquivo – substituídos em 16/08/2026 pela edição dentro do app.
- Interruptores de geladeira/embalagem no Mercado e a linha "2 × 500 g — sobram 400 g" – saíram em 22/08/2026; ficam só em Configurações.

- Receitas sem seleção múltipla e sem filtro por tempo (removidos antes de 14/10/2026).
- Seletor de dieta nas macros de Semana e Mercado: substituído por barras contra a meta do Perfil (`MacroBarrasCard`); a tabela por dieta (`MacroResumoCard`) ficou só no Histórico.

## Contratos visuais e funcionais

Comportamentos visíveis que parecem estranhos mas são intencionais.

- Tocar no card da Semana marca ou desmarca a receita, sem abrir o detalhe.
- Arrastar item da lista para a direita edita a quantidade; para a esquerda remove (item de receita só fica oculto na semana).
