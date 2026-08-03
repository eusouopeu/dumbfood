import { useEffect } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CubeIcon,
  FireIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import ErrorBoundary from './components/ErrorBoundary';
import Receitas from './pages/Receitas';
import Importar from './pages/Importar';
import Detalhe from './pages/Detalhe';
import PlanoSemana from './pages/PlanoSemana';
import ListaMercado from './pages/ListaMercado';
import Historico from './pages/Historico';
import Geladeira from './pages/Geladeira';
import { ShareReceiver } from './lib/shareReceiver';

// A importação não fica na barra: entra pelo botão "+ Nova" da aba de receitas.
const navItens = [
  { to: '/', label: 'Receitas', icon: BookOpenIcon, end: true },
  { to: '/geladeira', label: 'Geladeira', icon: CubeIcon, end: false },
  { to: '/plano', label: 'Semana', icon: CalendarDaysIcon, end: false },
  { to: '/lista', label: 'Mercado', icon: ShoppingCartIcon, end: false },
  { to: '/historico', label: 'Histórico', icon: ChartBarIcon, end: false },
];

export default function App() {
  const navigate = useNavigate();

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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-brand-50/80 px-4 py-3 backdrop-blur">
        <FireIcon className="size-7 text-brand-600" />
        <h1 className="text-lg font-extrabold tracking-tight text-brand-700">dumbfood</h1>
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

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-2xl border-t border-stone-200 bg-white/95 backdrop-blur">
        <ul className="flex">
          {navItens.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                    isActive ? 'text-brand-600' : 'text-stone-500'
                  }`
                }
              >
                <n.icon className="size-5" />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
