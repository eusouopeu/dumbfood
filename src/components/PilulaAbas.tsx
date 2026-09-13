// Seletor flutuante de visões de uma aba (geladeira/lista no Mercado, receitas/dias na
// Semana): uma pílula de ícones no canto de baixo, onde o polegar já está.
//
// Cada ícone é um link de verdade, para o botão voltar do Android e os links internos
// do app continuarem funcionando.

import type { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router-dom';

export interface AbaPilula {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Só ativa no caminho exato (para `/plano` não acender em `/plano/dias`). */
  end?: boolean;
}

export default function PilulaAbas({ abas }: { abas: AbaPilula[] }) {
  return (
    <div className="flex gap-1 rounded-full border border-white/60 bg-white/70 p-1 shadow-lg backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-800/70">
      {abas.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          end={aba.end}
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
