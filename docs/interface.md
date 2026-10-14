# Interface e organização do código

Quando ler: ao mexer em telas, navegação, barras, botões flutuantes ou ao criar/quebrar página.
Fonte de verdade para: navegação, abas, posição dos flutuantes, formulários em folha, preferências de interface.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

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
