// Selos de qualidade de um alimento/receita, em cima da tabela nutricional já estimada.
//
// A tabela completa responde "quanto tem de cada coisa"; o selo responde "isso é pesado?".
// São perguntas diferentes, e a segunda é a que decide se a receita entra na semana.

import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ESTILO_NOTA, avaliarAlimento } from '../../lib/rating';
import type { Nutrientes100g } from '../../lib/nutrition';
import type { Micronutrientes100g } from '../../lib/micronutrientes';

export default function SelosQualidade({
  nutri,
  micro,
  compacto = false,
  rodape = 'Estimativa a partir dos ingredientes, em base por 100 g — serve para comparar receitas, não substitui o rótulo do produto.',
}: {
  /** Valores por 100 g — é a base em que os limites são definidos. */
  nutri: Nutrientes100g;
  micro?: Partial<Micronutrientes100g>;
  /** Só a pastilha da nota, sem a lista de selos (usado em cartões de lista). */
  compacto?: boolean;
  /** Observação de rodapé; muda quando os valores vêm do rótulo, e não de estimativa. */
  rodape?: string;
}) {
  if (nutri.kcal <= 0) return null;
  const { nota, positivos, negativos } = avaliarAlimento(nutri, micro);
  const estilo = ESTILO_NOTA[nota];

  if (compacto) {
    return (
      <span className={`chip ${estilo.fundo} ${estilo.texto}`}>{estilo.rotulo}</span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`chip ${estilo.fundo} ${estilo.texto}`}>{estilo.rotulo}</span>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          {Math.round(nutri.kcal)} kcal por 100 g
        </span>
      </div>
      {(positivos.length > 0 || negativos.length > 0) && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {positivos.map((s) => (
            <li key={s.chave} className="flex items-center gap-1 text-green-700 dark:text-green-300">
              <CheckIcon className="size-3.5 flex-shrink-0" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
          {negativos.map((s) => (
            <li key={s.chave} className="flex items-center gap-1 text-red-700 dark:text-red-300">
              <XMarkIcon className="size-3.5 flex-shrink-0" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-stone-400 dark:text-stone-500">{rodape}</p>
    </div>
  );
}
