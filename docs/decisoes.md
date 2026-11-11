# Decisões

Quando ler: antes de mudar comportamento já decidido.
Fonte de verdade para: o que já foi decidido no projeto (uma linha por decisão).
Atualizado em: 11/11/2026.

Decisão nova entra no topo, com data e onde está detalhada. Decisão ainda em
aberto fica em [pendencias.md](pendencias.md).

| Data | Decisão | Detalhe em |
|---|---|---|
| 11/11/2026 | Água em copos no painel: total em ml por dia no Dexie (`agua`, v14); copo e meta em `dumbfood:aguaCopoMl`/`dumbfood:aguaMetaMl` | `docs/metas-nutricionais.md` |
| 11/11/2026 | Dependências com pnpm (`pnpm-lock.yaml`), também no CI | `package.json` |
| 11/11/2026 | Foto do prato: Haiku lista itens e gramas, folha editável antes de lançar; a foto não é guardada | `docs/fome-ia-lugares.md` |
| 31/10/2026 | CI no GitHub roda tipos e testes em cada push e PR | `.github/workflows/ci.yml` |
| 14/10/2026 | Documentação segue `../_shared/docs-standards.md` | `CLAUDE.md` |
| 11/10/2026 | Claude Haiku (chave do usuário) estima pratos fora do acervo e arruma quantidades e itens repetidos da lista | `docs/fome-ia-lugares.md` |
| 11/10/2026 | Lembretes por GPS: na cozinha, notificação ou alarme; saindo da academia, aviso de mercado se algo acaba ou é dia de hortifrúti | `docs/fome-ia-lugares.md` |
| 10/10/2026 | Refeições dos últimos 14 dias vão ao Nexo por provider que só responde ao Nexo assinado pela mesma chave, sem internet | `docs/nativo.md` |
| 01/10/2026 | Registrar receita comida dá baixa na despensa, com desfazer e opção em Configurações | `docs/interface.md` |
| 14/09/2026 | Histórico compara macros com a meta do perfil, não mais com uma dieta solta | `docs/metas-nutricionais.md` |
| 12/09/2026 | Meta de calorias pelo gasto estimado (Mifflin-St Jeor), editável, e macros com cadeado sempre somando 100% | `docs/metas-nutricionais.md` |
| 12/09/2026 | Porta de dev fixa em 5180 | `vite.config.ts` |
| 05/09/2026 | Leitura do QR da NFC-e com jsQR de reserva, porque o WebView do Android quase nunca expõe `BarcodeDetector` | `docs/nativo.md` |
| 22/08/2026 | Uma receita pode ser agendada em várias refeições da semana; a nutrição do dia rateia a receita entre os lugares | `docs/interface.md` |
| 22/08/2026 | Lista de mercado sai do localStorage e vai para o Dexie, dentro do backup | `src/db/repo.ts` |
| 16/08/2026 | Cálculo de macros ignora ingredientes com "óleo" (fritura não penetra no prato) | `docs/metas-nutricionais.md` |
| 16/08/2026 | Tabela nutricional sempre por 100 g | `docs/interface.md` |
| 03/08/2026 | Ícones só do Heroicons, sem emoji ou glifo unicode | `CLAUDE.md` |
| 26/07/2026 | Importação por link busca a página por uma cadeia de proxies CORS e faz o parse no navegador (GitHub Pages não roda `api/import.ts`) | `docs/interface.md` |
| 26/07/2026 | Metas de dieta são percentuais da soma de proteína, carboidrato e gordura, não valores absolutos | `docs/metas-nutricionais.md` |
