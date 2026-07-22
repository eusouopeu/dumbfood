import { NavLink, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Receitas from './pages/Receitas';
import Importar from './pages/Importar';
import Detalhe from './pages/Detalhe';
import PlanoSemana from './pages/PlanoSemana';
import ListaMercado from './pages/ListaMercado';

const navItens = [
  { to: '/', label: 'Receitas', icon: '📖', end: true },
  { to: '/importar', label: 'Importar', icon: '➕', end: false },
  { to: '/plano', label: 'Semana', icon: '🗓️', end: false },
  { to: '/lista', label: 'Mercado', icon: '🛒', end: false },
];

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-brand-50/80 px-4 py-3 backdrop-blur">
        <span className="text-2xl">🍳</span>
        <h1 className="text-lg font-extrabold tracking-tight text-brand-700">dumbfood</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Receitas />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/receita/:id" element={<Detalhe />} />
          <Route path="/plano" element={<PlanoSemana />} />
          <Route path="/lista" element={<ListaMercado />} />
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
                <span className="text-xl">{n.icon}</span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
