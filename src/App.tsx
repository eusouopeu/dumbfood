import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CubeIcon,
  FireIcon,
  MoonIcon,
  ShoppingCartIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import ErrorBoundary from './components/ErrorBoundary';
import Toaster from './components/Toaster';
import ConfirmHost from './components/ConfirmHost';
import Receitas from './pages/Receitas';
import Importar from './pages/Importar';
import Detalhe from './pages/Detalhe';
import PlanoSemana from './pages/PlanoSemana';
import ListaMercado from './pages/ListaMercado';
import Historico from './pages/Historico';
import Geladeira from './pages/Geladeira';
import { ShareReceiver } from './lib/shareReceiver';
import { db } from './db/db';
import { aplicarTema, salvarTema, temaInicial, type Tema } from './lib/theme';
import { onPendentesLista } from './lib/listaStatus';

// A importação não fica na barra: entra pelo botão "+ Nova" da aba de receitas.
const navItens = [
  { to: '/', label: 'Receitas', icon: BookOpenIcon, end: true },
  { to: '/geladeira', label: 'Geladeira', icon: CubeIcon, end: false },
  { to: '/plano', label: 'Semana', icon: CalendarDaysIcon, end: false },
  { to: '/lista', label: 'Mercado', icon: ShoppingCartIcon, end: false },
  { to: '/historico', label: 'Histórico', icon: ChartBarIcon, end: false },
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
  const [tema, alternarTema] = useTema();
  const geladeiraCount = useLiveQuery(() => db.geladeira.count(), []) ?? 0;
  const [listaPendente, setListaPendente] = useState(0);

  useEffect(() => onPendentesLista(setListaPendente), []);

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

  const badges: Record<string, number> = {
    '/geladeira': geladeiraCount,
    '/lista': listaPendente,
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-brand-50/80 px-4 py-3 backdrop-blur dark:border-stone-700 dark:bg-stone-900/80">
        <FireIcon className="size-7 text-brand-600 dark:text-brand-400" />
        <h1 className="text-lg font-extrabold tracking-tight text-brand-700 dark:text-brand-300">dumbfood</h1>
        <button
          onClick={alternarTema}
          aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          className="ml-auto rounded-full p-2 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-stone-800"
        >
          {tema === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Receitas />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/receita/:id" element={<Detalhe />} />
          <Route path="/geladeira" element={<Geladeira />} />
          <Route path="/plano" element={<PlanoSemana />} />
          <Route path="/lista" element={<ListaMercado />} />
          <Route path="/historico" element={<Historico />} />
        </Routes>
        </ErrorBoundary>
      </main>

      <Toaster />
      <ConfirmHost />

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-2xl border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
        <ul className="flex">
          {navItens.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'
                  }`
                }
              >
                <span className="relative">
                  <n.icon className="size-5" />
                  <NavBadge n={badges[n.to] ?? 0} />
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
