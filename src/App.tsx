import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  FireIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  ShoppingCartIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import ErrorBoundary from './components/ErrorBoundary';
import { CardListSkeleton } from './components/Skeleton';
import Toaster from './components/Toaster';
import ConfirmHost from './components/ConfirmHost';
import TimersOverlay from './components/TimersOverlay';
import Inicio from './pages/Inicio';

// A tela inicial (o dia) entra no primeiro carregamento; o resto vem sob demanda. Importar e
// Mercado arrastam junto o OCR (tesseract) e o leitor de QR, que sozinhos pesam mais que
// todo o resto do app — carregá-los na abertura atrasava a primeira tela no celular.
const Importar = lazy(() => import('./pages/Importar'));
const Detalhe = lazy(() => import('./pages/Detalhe'));
const PlanoSemana = lazy(() => import('./pages/PlanoSemana'));
const ListaMercado = lazy(() => import('./pages/ListaMercado'));
const Historico = lazy(() => import('./pages/Historico'));
const Receitas = lazy(() => import('./pages/Receitas'));
const Geladeira = lazy(() => import('./pages/Geladeira'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Perfil = lazy(() => import('./pages/Perfil'));
import { ShareReceiver } from './lib/shareReceiver';
import { db } from './db/db';
import { aplicarTema, salvarTema, temaInicial, type Tema } from './lib/theme';
import { onPendentesLista } from './lib/listaStatus';
import { useLembreteValidade, podeAvisarHoje, marcarAvisadoHoje } from './lib/lembretes';
import { statusValidade } from './lib/validade';
import { toast } from './lib/toast';
import { verificarBackupAutomatico } from './lib/backupAutomatico';

// A importação não fica na barra: entra pelo botão "+ Nova" da aba de receitas.
// A barra é só de ícones e flutua em vidro, em duas peças: os quatro destinos do uso diário
// numa pílula e o histórico à parte, num círculo — dado é consulta, não rotina. O ícone
// ativo ganha uma pílula de fundo, que é o que o olho procura.
const navItens = [
  { to: '/', label: 'Início', icon: HomeIcon, ativoEm: ['/'] },
  { to: '/receitas', label: 'Receitas', icon: BookOpenIcon, ativoEm: ['/receitas'] },
  { to: '/plano', label: 'Semana', icon: CalendarDaysIcon, ativoEm: ['/plano'] },
  // Mercado e geladeira dividem a mesma aba (o seletor flutuante troca entre os dois).
  { to: '/geladeira', label: 'Mercado e geladeira', icon: ShoppingCartIcon, ativoEm: ['/geladeira', '/lista'] },
];

function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => temaInicial());

  useEffect(() => {
    aplicarTema(tema);
  }, []);

  function alternar() {
    setTema((atual) => {
      const novo: Tema = atual === 'dark' ? 'light' : 'dark';
      salvarTema(novo);
      return novo;
    });
  }

  return [tema, alternar];
}

function NavBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const localizacaoAtual = useRef(location);
  localizacaoAtual.current = location;
  const [tema, alternarTema] = useTema();
  const [listaPendente, setListaPendente] = useState(0);
  const [lembreteValidade] = useLembreteValidade();
  const geladeira = useLiveQuery(() => db.geladeira.toArray(), []);

  useEffect(() => onPendentesLista(setListaPendente), []);

  useEffect(() => {
    void verificarBackupAutomatico();
  }, []);

  // Aviso in-app (equivalente, no PWA/web, à notificação nativa agendada em Geladeira.tsx):
  // confere uma vez por dia se algo está vencido ou perto de vencer.
  useEffect(() => {
    if (!lembreteValidade || !geladeira || !podeAvisarHoje()) return;
    const criticos = geladeira.filter((g) => g.validade && statusValidade(g.validade) !== 'ok');
    if (criticos.length === 0) return;
    marcarAvisadoHoje();
    toast(
      `${criticos.length} ${criticos.length === 1 ? 'item vencendo' : 'itens vencendo'} na geladeira.`,
      'info',
      { rotulo: 'Ver', onClick: () => navigate('/geladeira') },
    );
  }, [lembreteValidade, geladeira, navigate]);

  // Gesto/botão de voltar do Android: navega no histórico do app em vez de sair,
  // e só fecha o app quando já está na tela inicial (comportamento nativo esperado).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (localizacaoAtual.current.pathname === '/') {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [navigate]);

  // Recebe links/textos compartilhados de outros apps (folha de compartilhamento do Android)
  // e manda direto pra tela de importar. Só existe implementação nativa (Android); no PWA
  // registerPlugin() nem chega a ser chamado.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = ShareReceiver.addListener('shareReceived', ({ text }) => {
      navigate('/importar', { state: { sharedText: text } });
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [navigate]);

  // Na tela de uma receita a barra do app some: a própria tela tem uma barra fixa, com
  // voltar e as ações da receita, e duas barras empilhadas comeriam metade da altura útil.
  const telaDeReceita = location.pathname.startsWith('/receita/');

  const badges: Record<string, number> = {
    '/geladeira': listaPendente,
  };
  const historicoAtivo = location.pathname.startsWith('/historico');

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      {!telaDeReceita && (
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-brand-50/80 px-4 py-3 backdrop-blur dark:border-stone-700 dark:bg-stone-900/80">
        <FireIcon className="size-7 text-brand-600 dark:text-brand-400" />
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-700 dark:text-brand-300">Dumbfood</h1>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/importar"
            aria-label="Nova receita"
            title="Nova receita"
            className="rounded-full p-2 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-stone-800"
          >
            <PlusIcon className="size-5" />
          </Link>
          <button
            onClick={alternarTema}
            aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="rounded-full p-2 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-stone-800"
          >
            {tema === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
          </button>
          <Link
            to="/config"
            aria-label="Configurações"
            title="Configurações"
            className="rounded-full p-2 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-stone-800"
          >
            <Cog6ToothIcon className="size-5" />
          </Link>
          <Link
            to="/perfil"
            aria-label="Perfil e metas"
            title="Perfil e metas"
            className="rounded-full p-2 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-stone-800"
          >
            <UserCircleIcon className="size-5" />
          </Link>
        </div>
      </header>
      )}

      <main className="flex-1 px-4 py-4 pb-28">
        <ErrorBoundary>
        <Suspense fallback={<CardListSkeleton />}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/receita/:id" element={<Detalhe />} />
          <Route path="/geladeira" element={<Geladeira />} />
          <Route path="/plano" element={<PlanoSemana />} />
          <Route path="/lista" element={<ListaMercado />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/config" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      <Toaster />
      <ConfirmHost />
      <TimersOverlay />

      <nav className="fixed inset-x-0 bottom-3 z-30 mx-auto flex max-w-2xl items-center gap-2 px-3 pb-[env(safe-area-inset-bottom)]">
        <ul className="flex flex-1 items-center rounded-full border border-white/60 bg-white/60 p-1 shadow-lg backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/60">
          {navItens.map((n) => {
            const ativo = n.ativoEm.some((p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)));
            return (
              <li key={n.to} className="flex-1">
                <Link
                  to={n.to}
                  aria-label={n.label}
                  title={n.label}
                  aria-current={ativo ? 'page' : undefined}
                  className={`relative flex items-center justify-center rounded-full py-2.5 transition-colors ${
                    ativo
                      ? 'bg-brand-200 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
                      : 'text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span className="relative">
                    <n.icon className="size-6" />
                    <NavBadge n={badges[n.to] ?? 0} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <NavLink
          to="/historico"
          aria-label="Histórico"
          title="Histórico"
          className={`flex size-14 flex-shrink-0 items-center justify-center rounded-full border border-white/60 shadow-lg backdrop-blur-md dark:border-stone-700/60 ${
            historicoAtivo
              ? 'bg-brand-200 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
              : 'bg-white/60 text-stone-700 dark:bg-stone-900/60 dark:text-stone-300'
          }`}
        >
          <ChartBarIcon className="size-6" />
        </NavLink>
      </nav>
    </div>
  );
}
