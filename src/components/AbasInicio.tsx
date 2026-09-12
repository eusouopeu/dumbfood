// Abas da tela inicial: geladeira e mercado são o mesmo assunto visto de dois lados —
// o que já tem em casa e o que falta comprar. Ficam como um seletor no topo, e não como
// dois destinos distantes na barra de baixo, porque quase todo uso alterna entre os dois.
//
// Cada aba é um link de verdade (e não estado local), para o botão voltar do Android,
// o realce da barra inferior e os links internos do app continuarem funcionando.

import { NavLink } from 'react-router-dom';

const ABAS = [
  { to: '/', label: 'Geladeira', end: true },
  { to: '/lista', label: 'Mercado', end: false },
];

export default function AbasInicio() {
  return (
    <div className="flex rounded-xl bg-brand-100/70 p-1 dark:bg-stone-800">
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          end={aba.end}
          className={({ isActive }) =>
            `flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-600'
                : 'text-stone-600 dark:text-stone-300'
            }`
          }
        >
          {aba.label}
        </NavLink>
      ))}
    </div>
  );
}
