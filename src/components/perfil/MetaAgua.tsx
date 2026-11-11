// Perfil › Água: meta diária e tamanho do copo do cartão de água do painel.

import { BeakerIcon } from '@heroicons/react/24/outline';
import { useCopoAgua, useMetaAgua } from '../../lib/agua';

export default function MetaAgua() {
  const [copo, setCopo] = useCopoAgua();
  const [meta, setMeta] = useMetaAgua();
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <BeakerIcon className="size-5 text-brand-500" />
        <h3 className="section-heading text-sm">Água</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs text-stone-500 dark:text-stone-400">Meta diária (ml)</span>
          <input
            className="input py-1.5"
            type="number"
            inputMode="numeric"
            min={250}
            step={250}
            defaultValue={meta}
            onChange={(e) => setMeta(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-stone-500 dark:text-stone-400">Copo (ml)</span>
          <input
            className="input py-1.5"
            type="number"
            inputMode="numeric"
            min={50}
            step={50}
            defaultValue={copo}
            onChange={(e) => setCopo(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
