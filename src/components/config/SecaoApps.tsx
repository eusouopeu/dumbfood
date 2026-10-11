// Configurações › Nexo e Brita: o que o dumbfood troca com os outros apps do Pedro, no mesmo
// celular e sem internet (lib/compartilharNexo.ts, compartilharBrita.ts, avisosNexo.ts).

import { useEffect, useState } from 'react';
import { CalendarDaysIcon, ExclamationTriangleIcon, HeartIcon } from '@heroicons/react/24/outline';
import Secao from '../Secao';
import { useEnviarBrita, useEnviarNexo, useReceberNexo } from '../../lib/preferencias';
import { TEXTO_ERRO_NEXO, sincronizarAvisosNexo, useAvisosNexo } from '../../lib/avisosNexo';

function Linha({
  icone: Icone,
  titulo,
  texto,
  ligado,
  onChange,
}: {
  icone: typeof HeartIcon;
  titulo: string;
  texto: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Icone className="size-5 flex-shrink-0 text-brand-500" />
      <span className="flex-1">
        <span className="block font-medium">{titulo}</span>
        <span className="block text-xs text-stone-500 dark:text-stone-400">{texto}</span>
      </span>
      <input type="checkbox" className="h-5 w-5 flex-shrink-0 accent-brand-500" checked={ligado} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SecaoApps() {
  const [enviarNexo, setEnviarNexo] = useEnviarNexo();
  const [enviarBrita, setEnviarBrita] = useEnviarBrita();
  const [receberNexo, setReceberNexo] = useReceberNexo();
  const avisos = useAvisosNexo();
  const [estado, setEstado] = useState('');

  useEffect(() => {
    if (!receberNexo) return setEstado('');
    sincronizarAvisosNexo(true)
      .then((r) => setEstado(r.erro ? TEXTO_ERRO_NEXO[r.erro] : ''))
      .catch((e) => setEstado((e as Error).message));
  }, [receberNexo]);

  return (
    <Secao chave="cfg-nexo" titulo="Nexo e Brita" subtitulo="troca com os outros apps, sem internet" padraoAberta={false}>
      <div className="space-y-3">
        <Linha
          icone={HeartIcon}
          titulo="Enviar refeições ao Nexo"
          texto="O que você registra como comido nos últimos 14 dias, com os ingredientes das receitas."
          ligado={enviarNexo}
          onChange={setEnviarNexo}
        />
        <Linha
          icone={ExclamationTriangleIcon}
          titulo="Receber avisos do Nexo"
          texto="Alergias da ficha de emergência e o alimento de um teste de eliminação: as receitas que os contêm ganham um alerta."
          ligado={receberNexo}
          onChange={setReceberNexo}
        />
        {receberNexo && (estado || avisos.length > 0) && (
          <p className="pl-8 text-xs text-stone-500 dark:text-stone-400">
            {avisos.length > 0 ? `Evitar: ${avisos.map((a) => `${a.termo} (${a.motivo})`).join(', ')}` : estado}
          </p>
        )}
        <Linha
          icone={CalendarDaysIcon}
          titulo="Enviar ao Brita"
          texto="Kcal do dia contra a meta, o cardápio do plano e o que está acabando aparecem na agenda do Brita."
          ligado={enviarBrita}
          onChange={setEnviarBrita}
        />
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Tudo fica no celular: o Android só entrega ao Nexo e ao Brita instalados por você (conferidos pela assinatura).
        </p>
      </div>
    </Secao>
  );
}
