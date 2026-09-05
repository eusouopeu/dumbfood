// Tabela nutricional e de vitaminas/minerais da receita, sempre por 100 g.
// Estimativa a partir da base local (TACO/USDA) dos ingredientes reconhecidos.

import { formatDecimal } from '../../lib/displayQty';
import { percentualVD, type Nutrientes100g } from '../../lib/nutrition';
import {
  CAMPOS_MICRO,
  coberturaMicro,
  percentualVDMicro,
  type Micronutrientes100g,
} from '../../lib/micronutrientes';
import Secao from '../Secao';

export function TabelaNutricional({ nutri }: { nutri: Nutrientes100g }) {
  return (
    <Secao chave="nutricional" titulo="Tabela nutricional" subtitulo="Por 100 g">
      <table className="w-full text-sm">
        <Cabecalho />
        <tbody>
          {/* Caloria com casa decimal não ajuda ninguém a decidir nada: arredonda pra cima. */}
          <NutriLinha label="Valor energético" valor={`${Math.ceil(nutri.kcal)} kcal`} vd={percentualVD('kcal', nutri.kcal)} />
          <NutriLinha label="Carboidratos" valor={`${formatDecimal(nutri.carboidrato)} g`} vd={percentualVD('carboidrato', nutri.carboidrato)} />
          <NutriLinha label="dos quais açúcares" valor={`${formatDecimal(nutri.acucares)} g`} indent />
          <NutriLinha label="Proteínas" valor={`${formatDecimal(nutri.proteina)} g`} vd={percentualVD('proteina', nutri.proteina)} />
          <NutriLinha label="Gorduras totais" valor={`${formatDecimal(nutri.gorduraTotal)} g`} vd={percentualVD('gorduraTotal', nutri.gorduraTotal)} />
          <NutriLinha label="saturadas" valor={`${formatDecimal(nutri.gorduraSaturada)} g`} vd={percentualVD('gorduraSaturada', nutri.gorduraSaturada)} indent />
          <NutriLinha
            label="insaturadas"
            valor={`${formatDecimal(Math.max(0, nutri.gorduraTotal - nutri.gorduraSaturada))} g`}
            indent
          />
          <NutriLinha label="Colesterol" valor={`${formatDecimal(nutri.colesterolMg)} mg`} vd={percentualVD('colesterolMg', nutri.colesterolMg)} />
          <NutriLinha label="Fibra alimentar" valor={`${formatDecimal(nutri.fibra)} g`} vd={percentualVD('fibra', nutri.fibra)} last />
        </tbody>
      </table>
    </Secao>
  );
}

export function TabelaMicronutrientes({
  micro,
  cobertura,
}: {
  micro: Micronutrientes100g;
  cobertura: ReturnType<typeof coberturaMicro>;
}) {
  return (
    <Secao chave="micronutrientes" titulo="Vitaminas e minerais" subtitulo="Por 100 g">
      <table className="w-full text-sm">
        <Cabecalho />
        <tbody>
          {CAMPOS_MICRO.map(({ chave, label, unidade }, i) => (
            <NutriLinha
              key={chave}
              label={label}
              valor={`${formatDecimal(micro[chave])} ${unidade}`}
              vd={percentualVDMicro(chave, micro[chave])}
              last={i === CAMPOS_MICRO.length - 1}
            />
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
        Estimativa a partir de {cobertura.conhecidos} de {cobertura.total} ingredientes reconhecidos (TACO/USDA). O que
        a tabela não conhece entra como zero, então o valor real tende a ser maior.
      </p>
    </Secao>
  );
}

function Cabecalho() {
  return (
    <thead>
      <tr className="border-b border-stone-200 dark:border-stone-700">
        <th className="py-1.5 text-left text-xs font-semibold text-stone-500 dark:text-stone-400">Item</th>
        <th className="py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">100 g</th>
        <th className="w-16 py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">% VD</th>
      </tr>
    </thead>
  );
}

function NutriLinha({
  label,
  valor,
  vd,
  indent,
  last,
}: {
  label: string;
  valor: string;
  vd?: number;
  indent?: boolean;
  last?: boolean;
}) {
  return (
    <tr className={last ? '' : 'border-b border-stone-100 dark:border-stone-700'}>
      <td className={`py-1.5 ${indent ? 'pl-4 text-stone-500 dark:text-stone-400' : 'font-medium'}`}>{label}</td>
      <td className="py-1.5 text-right tabular-nums">{valor}</td>
      <td className="w-16 py-1.5 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">
        {vd !== undefined ? `${formatDecimal(vd)}%` : ''}
      </td>
    </tr>
  );
}
