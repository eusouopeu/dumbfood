// Seletor flutuante da aba Mercado: geladeira e lista de compras são o mesmo assunto
// visto de dois lados — o que já tem em casa e o que falta comprar.

import { CubeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import PilulaAbas from './PilulaAbas';

export default function AbasMercado() {
  return (
    <PilulaAbas
      abas={[
        { to: '/geladeira', label: 'Geladeira', icon: CubeIcon },
        { to: '/lista', label: 'Lista de mercado', icon: ShoppingCartIcon },
      ]}
    />
  );
}
