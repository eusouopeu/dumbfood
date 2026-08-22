import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Dev-only middleware that mirrors the serverless function in `api/import.ts`,
// so `npm run dev` can import recipes by URL without a separate serverless host.
function importApiDevPlugin(): Plugin {
  return {
    name: 'dumbfood-import-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/import', async (req, res) => {
        try {
          const reqUrl = new URL(req.url ?? '', 'http://localhost');
          const target = reqUrl.searchParams.get('url');
          res.setHeader('content-type', 'application/json');
          if (!target) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Parâmetro "url" é obrigatório.' }));
            return;
          }
          // Mesmo cache/limite da função serverless, para o dev reproduzir o comportamento real.
          const cacheMod = await server.ssrLoadModule('/src/lib/importCache.ts');
          const cacheada = cacheMod.lerDoCache(target);
          if (cacheada) {
            res.statusCode = 200;
            res.setHeader('x-cache', 'HIT');
            res.end(JSON.stringify(cacheada));
            return;
          }
          const limite = cacheMod.registrarRequisicao(req.socket?.remoteAddress ?? 'dev');
          if (!limite.permitido) {
            res.statusCode = 429;
            res.setHeader('retry-after', String(limite.esperarSegundos));
            res.end(JSON.stringify({ error: `Muitas importações seguidas. Tente de novo em ${limite.esperarSegundos}s.` }));
            return;
          }
          const { fetchAndParseRecipe } = await server.ssrLoadModule('/src/lib/fetchRecipe.ts');
          const recipe = await fetchAndParseRecipe(target);
          if (!recipe) {
            res.statusCode = 422;
            res.end(JSON.stringify({ error: 'Não foi possível extrair uma receita desta página.' }));
            return;
          }
          cacheMod.gravarNoCache(target, recipe);
          res.statusCode = 200;
          res.setHeader('x-cache', 'MISS');
          res.end(JSON.stringify(recipe));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

// Dev-only middleware equivalente a `api/nfce.ts`: lê a NFC-e do portal da Fazenda
// a partir da URL do QR Code do cupom.
function nfceApiDevPlugin(): Plugin {
  return {
    name: 'dumbfood-nfce-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/nfce', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        try {
          const reqUrl = new URL(req.url ?? '', 'http://localhost');
          const target = reqUrl.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Parâmetro "url" é obrigatório.' }));
            return;
          }
          const cacheMod = await server.ssrLoadModule('/src/lib/importCache.ts');
          const limite = cacheMod.registrarRequisicao(req.socket?.remoteAddress ?? 'dev');
          if (!limite.permitido) {
            res.statusCode = 429;
            res.end(JSON.stringify({ error: `Muitas consultas seguidas. Tente de novo em ${limite.esperarSegundos}s.` }));
            return;
          }
          const { fetchAndParseNfce } = await server.ssrLoadModule('/src/lib/fetchNfce.ts');
          const nota = await fetchAndParseNfce(target);
          if (nota.itens.length === 0) {
            res.statusCode = 422;
            res.end(JSON.stringify({ error: 'Não foi possível ler os itens dessa nota.' }));
            return;
          }
          res.statusCode = 200;
          res.end(JSON.stringify(nota));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

// O build para o APK (Capacitor) é diferente do build para o GitHub Pages: os arquivos
// são servidos da raiz do próprio pacote, e o service worker do PWA não tem função
// dentro de um app instalado — quem cuida da atualização ali é o próprio APK.
const paraApk = process.env.DUMBFOOD_APK === '1';

export default defineConfig(({ command }) => ({
  // GitHub Pages serve o build em /<repo>/, mas o dev server deve continuar na raiz.
  base: command === 'build' && !paraApk ? '/dumbfood/' : '/',
  plugins: [
    react(),
    importApiDevPlugin(),
    nfceApiDevPlugin(),
    ...(paraApk ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'dumbfood — receitas e lista de mercado',
        short_name: 'dumbfood',
        description:
          'Importe receitas, reescale quantidades e gere uma lista de mercado unificada por gôndola.',
        theme_color: '#f97316',
        background_color: '#fffbf5',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    })]),
  ],
}));
