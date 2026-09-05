import { describe, it, expect } from 'vitest';
import { detectarPlataformaVideo, extrairDadosDoVideo, escolherTextoDeReceita } from './videoRecipe';

describe('detectarPlataformaVideo', () => {
  it('reconhece TikTok e Instagram, inclusive links curtos', () => {
    expect(detectarPlataformaVideo('https://www.tiktok.com/@chef/video/7300000000000000000')).toBe('tiktok');
    expect(detectarPlataformaVideo('https://vm.tiktok.com/ZMabc123/')).toBe('tiktok');
    expect(detectarPlataformaVideo('https://www.instagram.com/reel/CxYz123abc/')).toBe('instagram');
    expect(detectarPlataformaVideo('https://www.tudogostoso.com.br/receita/1-bolo')).toBeNull();
  });
});

// Recorte do que o TikTok publica no HTML da página do vídeo.
const paginaTikTok = `
<html><head>
<meta property="og:description" content="descrição curta de og" />
</head><body>
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
${JSON.stringify({
  __DEFAULT_SCOPE__: {
    'webapp.video-detail': {
      itemInfo: {
        itemStruct: {
          id: '7300000000000000000',
          desc: 'Bolo de cenoura\\nIngredientes:\\n3 cenouras médias\\n2 xícaras de açúcar',
          author: { uniqueId: 'chef' },
          video: { playAddr: 'https://v16.tiktok.com/video.mp4', downloadAddr: 'https://v16.tiktok.com/down.mp4' },
        },
      },
    },
  },
})}
</script>
</body></html>`;

describe('extrairDadosDoVideo', () => {
  it('tira legenda, autor e endereço do vídeo do HTML do TikTok', () => {
    const dados = extrairDadosDoVideo(paginaTikTok, 'tiktok');
    expect(dados.legenda).toContain('3 cenouras médias');
    expect(dados.autor).toBe('chef');
    expect(dados.videoUrl).toBe('https://v16.tiktok.com/down.mp4');
    expect(dados.id).toBe('7300000000000000000');
  });

  it('cai no og:description e og:video quando não há JSON embutido (Instagram)', () => {
    const html = `<meta property="og:description" content="2 ovos&#39; e 1 xícara de leite" />
      <meta property="og:video" content="https://cdn.instagram.com/reel.mp4" />
      <meta property="og:title" content="Panqueca simples" />`;
    const dados = extrairDadosDoVideo(html, 'instagram');
    expect(dados.legenda).toContain('2 ovos');
    expect(dados.videoUrl).toBe('https://cdn.instagram.com/reel.mp4');
    expect(dados.titulo).toBe('Panqueca simples');
  });
});

describe('escolherTextoDeReceita', () => {
  it('prefere o comentário do autor quando a legenda não traz ingredientes', () => {
    const legenda = 'Receita completa nos comentários! 🔥';
    const comentarios = [
      { autor: 'outro', texto: 'ficou lindo' },
      { autor: 'chef', texto: 'Ingredientes:\n2 ovos\n1 xícara de leite\n200 g de farinha' },
    ];
    expect(escolherTextoDeReceita(legenda, comentarios, 'chef')).toContain('200 g de farinha');
  });

  it('fica com a legenda quando ela já tem a lista de ingredientes', () => {
    const legenda = 'Ingredientes:\n2 ovos\n1 xícara de leite\n200 g de farinha';
    expect(escolherTextoDeReceita(legenda, [{ autor: 'chef', texto: 'obrigado!' }], 'chef')).toBe(legenda);
  });
});
