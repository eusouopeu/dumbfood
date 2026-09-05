// Parte de rede da importação por link de vídeo (TikTok/Reels).
//
// Mesma estratégia do resto do app: o navegador não alcança essas páginas direto (CORS),
// então tudo passa pela cadeia de proxies públicos de `fetchViaProxy`. Nada aqui é
// garantido — a plataforma pode bloquear o proxy, exigir login ou mudar o HTML. Por isso
// cada etapa degrada sozinha: sem vídeo, ainda vem a legenda; sem legenda, o usuário
// segue pelo print/OCR, que continua existindo.

import { PROXIES, buscarHtmlViaProxy } from './fetchViaProxy';
import {
  detectarPlataformaVideo,
  extrairDadosDoVideo,
  extrairIdTikTok,
  escolherTextoDeReceita,
  type ComentarioVideo,
  type DadosVideo,
  type PlataformaVideo,
} from './videoRecipe';

export interface ReceitaDeVideo extends DadosVideo {
  plataforma: PlataformaVideo;
  /** Texto escolhido para virar a receita (legenda ou comentário do autor). */
  texto: string;
  /** Arquivo do vídeo, quando deu para baixar por algum proxy. */
  arquivo?: File;
  /** O que não deu certo, para a tela explicar em vez de falhar em silêncio. */
  avisos: string[];
}

/** Teto do download automático: acima disso o vídeo não deveria entrar no IndexedDB. */
const TAMANHO_MAX_DOWNLOAD = 100 * 1024 * 1024;

/**
 * Comentários do post. O TikTok responde a este endpoint sem assinatura para boa parte
 * dos vídeos públicos; quando recusa, a importação segue só com a legenda.
 */
async function buscarComentarios(id: string): Promise<ComentarioVideo[]> {
  const alvo = `https://www.tiktok.com/api/comment/list/?aweme_id=${id}&count=30&cursor=0`;
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy.url(alvo), { headers: proxy.headers });
      if (!res.ok) continue;
      const corpo = await res.json();
      const lista = Array.isArray(corpo?.comments) ? corpo.comments : [];
      const comentarios = lista
        .map((c: Record<string, unknown>) => ({
          autor: String((c.user as Record<string, unknown> | undefined)?.unique_id ?? ''),
          texto: String(c.text ?? ''),
        }))
        .filter((c: ComentarioVideo) => c.texto);
      if (comentarios.length > 0) return comentarios;
    } catch {
      // Proxy fora do ar ou resposta que não é JSON: tenta o próximo.
    }
  }
  return [];
}

/** Baixa o arquivo do vídeo por proxy. Devolve undefined quando nenhum proxy entrega. */
async function baixarVideo(videoUrl: string, nome: string): Promise<File | undefined> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy.url(videoUrl), { headers: proxy.headers });
      if (!res.ok) continue;
      const tipo = res.headers.get('content-type') ?? '';
      // Proxy que devolve HTML está entregando página de erro, não vídeo.
      if (tipo.includes('text/html')) continue;
      const blob = await res.blob();
      if (blob.size < 10_000 || blob.size > TAMANHO_MAX_DOWNLOAD) continue;
      return new File([blob], nome, { type: blob.type || 'video/mp4' });
    } catch {
      // Próximo proxy.
    }
  }
  return undefined;
}

/**
 * Traz da página do vídeo a legenda (ou o comentário do autor com a receita) e, quando
 * possível, o próprio arquivo do vídeo para tocar offline dentro do modo de preparo.
 */
export async function importarPorLinkDeVideo(entrada: string): Promise<ReceitaDeVideo> {
  const url = entrada.trim();
  const plataforma = detectarPlataformaVideo(url);
  if (!plataforma) throw new Error('Esse link não é de um vídeo do TikTok nem do Instagram.');

  const avisos: string[] = [];
  const { html } = await buscarHtmlViaProxy(url, (pagina) => {
    const d = extrairDadosDoVideo(pagina, plataforma);
    return Boolean(d.legenda || d.videoUrl);
  });

  const dados = extrairDadosDoVideo(html, plataforma);
  dados.id = dados.id ?? extrairIdTikTok(url);

  let comentarios: ComentarioVideo[] = [];
  if (plataforma === 'tiktok' && dados.id) {
    comentarios = await buscarComentarios(dados.id);
    if (comentarios.length === 0) avisos.push('Não consegui ler os comentários do vídeo.');
  }

  const texto = escolherTextoDeReceita(dados.legenda, comentarios, dados.autor);
  if (!texto.trim()) avisos.push('A legenda veio vazia — cole o texto da receita abaixo.');

  let arquivo: File | undefined;
  if (dados.videoUrl) {
    arquivo = await baixarVideo(dados.videoUrl, `${plataforma}-${dados.id ?? 'video'}.mp4`);
    if (!arquivo) avisos.push('Não consegui baixar o vídeo. Salve-o pelo app e anexe aqui.');
  } else {
    avisos.push('A página não expôs o arquivo do vídeo.');
  }

  return { ...dados, plataforma, texto, arquivo, avisos };
}
