// Seletor flutuante da aba Mercado: geladeira e lista de compras são o mesmo assunto
// visto de dois lados — o que já tem em casa e o que falta comprar. Fica como uma pílula
// de ícones no canto de baixo, ao lado do botão de adicionar, onde o polegar já está.
//
// Cada ícone é um link de verdade (`/geladeira` e `/lista`), para o botão voltar do
// Android e os links internos do app continuarem funcionando.

import { NavLink } from 'react-router-dom';
import { CubeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';

const ABAS = [
  { to: '/geladeira', label: 'Geladeira', icon: CubeIcon },
  { to: '/lista', label: 'Lista de mercado', icon: ShoppingCartIcon },
];

export default function AbasMercado() {
  return (
    <div className="flex gap-1 rounded-full border border-white/60 bg-white/70 p-1 shadow-lg backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-800/70">
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          aria-label={aba.label}
          title={aba.label}
          className={({ isActive }) =>
            `flex size-11 items-center justify-center rounded-full transition-colors ${
              isActive ? 'bg-brand-500 text-white' : 'text-stone-600 dark:text-stone-300'
            }`
          }
        >
          <aba.icon className="size-5" />
        </NavLink>
      ))}
    </div>
  );
}
