// Extração de ingredientes a partir do texto de uma legenda de vídeo de receita
// (TikTok, Reels e afins) — digitada, colada ou lida por OCR de um print.
//
// Legenda de rede social não é lista de compras: vem com hashtag, arroba, chamada
// para engajamento ("salva pra fazer depois"), emoji de bullet e o preparo misturado
// aos ingredientes. Este módulo separa o que é ingrediente do que é ruído, sem tentar
// ser esperto demais: na dúvida, mantém a linha, porque o usuário revisa antes de salvar.

/** Marcadores de lista usados em legenda (emoji, traço, ponto) no começo da linha. */
const RE_MARCADOR = /^[\s\-–—•*·▪️◦✅✔️☑️➡️👉🔸🔹⭐️🌟💛🤍❤️🔥]+/u;
/** Hashtags e arrobas, que nunca fazem parte do ingrediente. */
const RE_HASHTAG = /(^|\s)[#@][\p{L}\p{N}_]+/gu;
/** Emoji solto no meio/fim da linha. */
const RE_EMOJI = /[\p{Extended_Pictographic}️]/gu;

/** Cabeçalhos que anunciam o começo da lista de ingredientes. */
const RE_CABECALHO_INGREDIENTES = /^(ingredientes?|voc[eê] vai precisar|lista de compras|materiais)\b.*$/i;
/** Cabeçalhos que anunciam o fim da lista e o começo do preparo. */
const RE_CABECALHO_PREPARO = /^(modo de preparo|preparo|como fazer|passo a passo|instru[cç][oõ]es|montagem)\b.*$/i;

/** Frases de engajamento e assinatura de perfil, que aparecem soltas na legenda. */
const RUIDO = [
  'salva essa receita', 'salva ai', 'salva aí', 'salve essa', 'comenta', 'comente',
  'me segue', 'siga', 'segue o perfil', 'link na bio', 'compartilha', 'marca alguem',
  'marca alguém', 'receita completa no', 'deixa o like', 'curte', 'inscreva',
  'bora fazer', 'anota ai', 'anota aí', 'clique no link', 'perfil', 'stories',
];

function limpar(linha: string): string {
  return linha
    .replace(RE_MARCADOR, '')
    .replace(RE_HASHTAG, ' ')
    .replace(RE_EMOJI, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ehRuido(linha: string): boolean {
  const lower = linha.toLowerCase();
  if (RUIDO.some((r) => lower.includes(r))) return true;
  // Linha que sobrou só com pontuação, ou curta demais para ser um ingrediente.
  return limparPontuacao(linha).length < 2;
}

function limparPontuacao(s: string): string {
  return s.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Uma linha "parece ingrediente" quando tem número, fração ou unidade reconhecível. */
function pareceIngrediente(linha: string): boolean {
  if (/\d/.test(linha)) return true;
  if (/[½¼¾⅓⅔⅛]/.test(linha)) return true;
  return /\b(x[íi]cara|colher|pitada|a gosto|fatia|dente|lata|pacote|copo|punhado|ma[çc]o|ramo|gota|fio)\b/i.test(linha);
}

export interface LegendaExtraida {
  /** Linhas de ingrediente, uma por linha, prontas para o parser de ingredientes. */
  ingredientes: string[];
  /** Linhas de preparo, quando a legenda traz o passo a passo depois dos ingredientes. */
  preparo: string[];
  /** Primeira linha aproveitável da legenda, sugerida como título. */
  titulo: string;
}

/**
 * Separa a legenda em título, ingredientes e preparo.
 *
 * Quando a legenda traz o cabeçalho "Ingredientes"/"Modo de preparo", ele manda: tudo
 * entre os dois é ingrediente. Sem cabeçalho nenhum, cai na heurística — linha com
 * quantidade ou unidade é ingrediente, o resto vira preparo.
 */
export function extrairLegenda(texto: string): LegendaExtraida {
  const linhas = texto
    .split(/\r?\n/)
    .map(limpar)
    .filter((l) => l.length > 0 && !ehRuido(l));

  const ingredientes: string[] = [];
  const preparo: string[] = [];
  let titulo = '';
  let secao: 'nenhuma' | 'ingredientes' | 'preparo' = 'nenhuma';

  for (const linha of linhas) {
    if (RE_CABECALHO_INGREDIENTES.test(linha)) {
      secao = 'ingredientes';
      continue;
    }
    if (RE_CABECALHO_PREPARO.test(linha)) {
      secao = 'preparo';
      continue;
    }

    if (secao === 'ingredientes') {
      ingredientes.push(linha);
      continue;
    }
    if (secao === 'preparo') {
      preparo.push(linha.replace(/^\d+[.)]\s*/, ''));
      continue;
    }

    // Antes de qualquer cabeçalho: a primeira linha "de texto" costuma ser o nome do prato.
    if (!titulo && !pareceIngrediente(linha)) {
      titulo = linha;
      continue;
    }
    if (pareceIngrediente(linha)) ingredientes.push(linha);
    else preparo.push(linha.replace(/^\d+[.)]\s*/, ''));
  }

  return { ingredientes, preparo, titulo };
}
