// Importação de receita a partir de um link de vídeo (TikTok e Instagram Reels).
//
// Vídeo de rede social não publica `schema.org/Recipe`: a receita mora na legenda, e
// muitas vezes só num comentário do próprio autor ("receita nos comentários"). O que dá
// para tirar da página, sem login, é:
//   - a legenda (`desc` no JSON que o TikTok embute na página, ou `og:description`);
//   - o endereço do arquivo de vídeo (`downloadAddr`/`playAddr`, ou `og:video`);
//   - o autor, para saber qual comentário é dele.
//
// Este módulo é puro (HTML/string -> dados) para rodar igual no navegador e no teste;
// a parte de rede está em `videoRecipeClient.ts`.

import { decodeEntities } from './decodeEntities';

export type PlataformaVideo = 'tiktok' | 'instagram';

/** Reconhece o link como vídeo de uma plataforma suportada (ou null). */
export function detectarPlataformaVideo(url: string): PlataformaVideo | null {
  const u = url.trim().toLowerCase();
  if (/(^|\/\/|\.)(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//.test(u)) return 'tiktok';
  if (/instagram\.com\/(reel|reels|p|tv)\//.test(u)) return 'instagram';
  return null;
}

export interface DadosVideo {
  /** Id do vídeo na plataforma, quando dá para extrair (usado para buscar comentários). */
  id?: string;
  /** Nome de usuário de quem publicou. */
  autor?: string;
  /** Legenda completa do post. */
  legenda: string;
  /** Título sugerido (quando a plataforma publica um separado da legenda). */
  titulo?: string;
  /** Endereço direto do arquivo de vídeo, quando exposto na página. */
  videoUrl?: string;
  /** Imagem de capa, usada como imagem da receita. */
  capa?: string;
}

/** Id do vídeo do TikTok a partir da URL (`/video/<id>`), quando o link é o longo. */
export function extrairIdTikTok(url: string): string | undefined {
  return url.match(/\/video\/(\d{5,})/)?.[1];
}

function metaConteudo(html: string, propriedade: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propriedade}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const alternativa = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${propriedade}["']`,
    'i',
  );
  const bruto = html.match(re)?.[1] ?? html.match(alternativa)?.[1];
  return bruto ? decodeEntities(bruto) : undefined;
}

/** Primeiro valor de uma chave dentro de um JSON grande, sem precisar tipar a árvore toda. */
function buscarChave(objeto: unknown, chave: string, profundidade = 0): unknown {
  if (profundidade > 12 || objeto === null || typeof objeto !== 'object') return undefined;
  const registro = objeto as Record<string, unknown>;
  if (chave in registro && registro[chave] !== undefined) return registro[chave];
  for (const valor of Object.values(registro)) {
    const achado = buscarChave(valor, chave, profundidade + 1);
    if (achado !== undefined) return achado;
  }
  return undefined;
}

function jsonEmbutido(html: string, id: string): unknown {
  const m = html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, 'i'));
  if (!m) return undefined;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return undefined;
  }
}

/**
 * Lê da página do vídeo tudo que serve para montar a receita. Tenta primeiro o JSON que
 * a plataforma embute (mais completo e com a legenda inteira) e cai nas metatags `og:`
 * quando ele não vem — é o caso do Instagram deslogado e de páginas servidas por proxy.
 */
export function extrairDadosDoVideo(html: string, plataforma: PlataformaVideo): DadosVideo {
  const dados: DadosVideo = { legenda: '' };

  const embutido =
    jsonEmbutido(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__') ?? jsonEmbutido(html, 'SIGI_STATE');
  if (embutido) {
    const item = buscarChave(embutido, 'itemStruct') ?? embutido;
    const desc = buscarChave(item, 'desc');
    if (typeof desc === 'string') dados.legenda = desc.replace(/\\n/g, '\n');
    const id = buscarChave(item, 'id');
    if (typeof id === 'string') dados.id = id;
    const autor = buscarChave(item, 'uniqueId');
    if (typeof autor === 'string') dados.autor = autor;
    const video = buscarChave(item, 'video');
    const download = buscarChave(video, 'downloadAddr');
    const play = buscarChave(video, 'playAddr');
    if (typeof download === 'string' && download) dados.videoUrl = download;
    else if (typeof play === 'string' && play) dados.videoUrl = play;
    const capa = buscarChave(video, 'cover');
    if (typeof capa === 'string') dados.capa = capa;
  }

  // As metatags completam o que faltou (e são tudo que existe no Instagram sem login).
  if (!dados.legenda) {
    const descricao = metaConteudo(html, 'og:description') ?? metaConteudo(html, 'description');
    if (descricao) dados.legenda = descricao;
  }
  if (!dados.videoUrl) {
    dados.videoUrl =
      metaConteudo(html, 'og:video:secure_url') ??
      metaConteudo(html, 'og:video:url') ??
      metaConteudo(html, 'og:video') ??
      html.match(/"(?:video_url|playbackUrl)"\s*:\s*"([^"]+\.mp4[^"]*)"/i)?.[1]?.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  }
  if (!dados.capa) dados.capa = metaConteudo(html, 'og:image');
  if (!dados.autor && plataforma === 'instagram') {
    dados.autor = html.match(/"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/i)?.[1];
  }

  const titulo = metaConteudo(html, 'og:title');
  if (titulo) dados.titulo = tituloLimpo(titulo, plataforma);

  return dados;
}

/**
 * O `og:title` das duas plataformas vem com sufixo de marca ("... | TikTok") e, no
 * Instagram, com o perfil na frente. Sobra o nome do prato, que é o que serve de título.
 */
function tituloLimpo(titulo: string, plataforma: PlataformaVideo): string {
  let t = titulo.replace(/\s*[|·]\s*(TikTok|Instagram).*$/i, '');
  if (plataforma === 'instagram') t = t.replace(/^.*?\bon Instagram:\s*/i, '').replace(/^["“](.*)["”]$/, '$1');
  return t.trim();
}

export interface ComentarioVideo {
  autor: string;
  texto: string;
}

/** Quantas linhas do texto parecem item de receita (têm quantidade ou unidade). */
function linhasDeIngrediente(texto: string): number {
  return texto
    .split(/\r?\n/)
    .filter((l) =>
      /\d/.test(l) ||
      /[½¼¾⅓⅔⅛]/.test(l) ||
      /\b(x[íi]cara|colher|pitada|a gosto|dente|lata|pacote|copo|punhado|ma[çc]o|ramo|fio)\b/i.test(l),
    ).length;
}

/**
 * Qual texto vale como receita: a legenda, quando ela já traz a lista; senão o
 * comentário do próprio autor que mais parece uma lista de ingredientes — é a prática
 * comum ("receita completa nos comentários") e sem isso o import volta vazio.
 */
export function escolherTextoDeReceita(
  legenda: string,
  comentarios: ComentarioVideo[],
  autor: string | undefined,
): string {
  const naLegenda = linhasDeIngrediente(legenda);
  if (naLegenda >= 3) return legenda;

  const doAutor = comentarios
    .filter((c) => !autor || c.autor.toLowerCase() === autor.toLowerCase())
    .map((c) => ({ texto: c.texto, pontos: linhasDeIngrediente(c.texto) }))
    .sort((a, b) => b.pontos - a.pontos)[0];

  if (doAutor && doAutor.pontos > naLegenda) {
    // A legenda ainda pode ter o nome do prato: entra antes da lista do comentário.
    return legenda.trim() ? `${legenda.trim()}\n${doAutor.texto}` : doAutor.texto;
  }
  return legenda;
}
