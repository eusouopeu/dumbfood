// Configurações › Cozinha, academia e hortifrúti (lib/lugares.ts).

import { useState } from 'react';
import { BellAlertIcon, MapPinIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import Secao from '../Secao';
import {
  Lugares,
  RAIO_PADRAO,
  lugaresDisponiveis,
  useConfigLugares,
  useEstadoLugares,
  type ConfigLugares,
  type Ponto,
} from '../../lib/lugares';
import { pedirPermissaoNotificacoes } from '../../lib/notifications';
import { toast } from '../../lib/toast';

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-5 w-5 flex-shrink-0 accent-brand-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function MarcarPonto({
  ponto,
  raioPadrao,
  onMarcar,
}: {
  ponto?: Ponto;
  raioPadrao: number;
  onMarcar: (p: Ponto) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  async function marcar() {
    setBuscando(true);
    try {
      const pos = await Lugares.posicaoAtual();
      // O raio nunca fica menor que o erro do GPS naquele momento.
      onMarcar({ lat: pos.lat, lng: pos.lng, raio: Math.max(ponto?.raio ?? raioPadrao, Math.ceil(pos.precisao)) });
      toast(`Lugar marcado (precisão de ${Math.round(pos.precisao)} m).`, 'sucesso');
    } catch (e) {
      toast(`Não deu para pegar a localização: ${(e as Error).message}`, 'erro');
    } finally {
      setBuscando(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button onClick={marcar} disabled={buscando} className="btn-outline py-1 text-xs">
        <MapPinIcon className="size-4" /> {buscando ? 'Buscando GPS…' : ponto ? 'Marcar de novo aqui' : 'Estou aqui: marcar'}
      </button>
      {ponto && (
        <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
          raio
          <input
            type="number"
            min={15}
            max={500}
            value={ponto.raio}
            onChange={(e) => onMarcar({ ...ponto, raio: Math.max(15, Number(e.target.value) || raioPadrao) })}
            className="input w-16 py-0.5 text-center"
          />
          m
        </label>
      )}
    </div>
  );
}

export default function SecaoLugares() {
  const [config, salvar] = useConfigLugares();
  const [estado, atualizarEstado] = useEstadoLugares();
  const nativo = lugaresDisponiveis();

  function mudar<K extends keyof ConfigLugares>(chave: K, patch: Partial<ConfigLugares[K]>) {
    salvar({ ...config, [chave]: { ...config[chave], ...patch } });
  }

  async function ligar<K extends 'cozinha' | 'academia' | 'hortifruti'>(chave: K, ativo: boolean) {
    if (ativo && nativo && !(await pedirPermissaoNotificacoes())) {
      toast('Permissão de notificação negada.', 'erro');
      return;
    }
    mudar(chave, { ativo } as Partial<ConfigLugares[K]>);
  }

  const semPermissao = nativo && estado && (!estado.localizacao || !estado.segundoPlano);

  return (
    <Secao chave="cfg-lugares" titulo="Cozinha, academia e hortifrúti" subtitulo="lembretes por GPS e por dia" padraoAberta={false}>
      <div className="space-y-4 text-sm">
        {!nativo && <p className="text-xs text-stone-500 dark:text-stone-400">Só no app Android: o navegador não vigia o GPS com o app fechado.</p>}

        {nativo && estado && !estado.playServices && (
          <p className="text-xs text-red-600 dark:text-red-400">Este aparelho não tem Google Play services: as cercas de GPS não funcionam.</p>
        )}

        {semPermissao && (
          <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            <p>
              Para avisar com o app fechado, o Android precisa da localização <b>o tempo todo</b>. O GPS fica com o
              sistema (cercas do Google), sem rastrear você: só chega aviso ao ficar na cozinha ou sair da academia.
            </p>
            <div className="flex flex-wrap gap-2">
              {!estado.localizacao ? (
                <button onClick={() => Lugares.pedirLocalizacao().then(atualizarEstado)} className="btn-outline py-1 text-xs">
                  Permitir localização
                </button>
              ) : (
                <button onClick={() => Lugares.pedirSegundoPlano()} className="btn-outline py-1 text-xs">
                  Permitir o tempo todo
                </button>
              )}
              <button onClick={() => Lugares.abrirAjustes()} className="btn-ghost py-1 text-xs">
                Abrir ajustes do app
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <BellAlertIcon className="size-5 flex-shrink-0 text-brand-500" />
            <span className="flex-1">
              <span className="block font-medium">Na cozinha, lembrar de registrar</span>
              <span className="block text-xs text-stone-500 dark:text-stone-400">
                Depois de 1 min no lugar marcado. Não repete antes do intervalo nem se você acabou de registrar.
              </span>
            </span>
            <Toggle label="Lembrar na cozinha" checked={config.cozinha.ativo} onChange={(v) => ligar('cozinha', v)} />
          </label>
          {config.cozinha.ativo && (
            <div className="space-y-2 pl-8">
              <MarcarPonto ponto={config.cozinha.ponto} raioPadrao={RAIO_PADRAO.cozinha} onMarcar={(ponto) => mudar('cozinha', { ponto })} />
              <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-700">
                {(['notificacao', 'alarme'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => mudar('cozinha', { modo: m })}
                    className={`flex-1 rounded-md py-1 font-semibold ${config.cozinha.modo === m ? 'bg-white shadow-sm dark:bg-stone-800' : 'text-stone-500 dark:text-stone-400'}`}
                  >
                    {m === 'notificacao' ? 'Notificação' : 'Alarme até desligar'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                das
                <input type="time" className="input w-24 py-0.5" value={config.cozinha.inicio} onChange={(e) => mudar('cozinha', { inicio: e.target.value })} />
                às
                <input type="time" className="input w-24 py-0.5" value={config.cozinha.fim} onChange={(e) => mudar('cozinha', { fim: e.target.value })} />
                · a cada
                <input
                  type="number"
                  min={15}
                  className="input w-16 py-0.5 text-center"
                  value={config.cozinha.intervaloMin}
                  onChange={(e) => mudar('cozinha', { intervaloMin: Math.max(15, Number(e.target.value) || 90) })}
                />
                min no mínimo
              </div>
              {nativo && (
                <button onClick={() => Lugares.testarAviso({ modo: config.cozinha.modo })} className="btn-ghost py-1 text-xs">
                  Testar agora
                </button>
              )}
              <p className="text-xs text-stone-400 dark:text-stone-500">
                GPS não separa cômodos: o aviso vale para o círculo em volta do ponto marcado. Marque no meio da cozinha e
                use o menor raio que ainda pega o fogão e a geladeira.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-stone-100 pt-3 dark:border-stone-700">
          <label className="flex items-center gap-3">
            <ShoppingBagIcon className="size-5 flex-shrink-0 text-brand-500" />
            <span className="flex-1">
              <span className="block font-medium">Saindo da academia, lembrar do mercado</span>
              <span className="block text-xs text-stone-500 dark:text-stone-400">
                Só quando algo da despensa está acabando ou é dia de hortifrúti. No máximo uma vez a cada 6 h.
              </span>
            </span>
            <Toggle label="Lembrar ao sair da academia" checked={config.academia.ativo} onChange={(v) => ligar('academia', v)} />
          </label>
          {config.academia.ativo && (
            <div className="space-y-2 pl-8">
              <MarcarPonto ponto={config.academia.ponto} raioPadrao={RAIO_PADRAO.academia} onMarcar={(ponto) => mudar('academia', { ponto })} />
              {nativo && (
                <button onClick={() => Lugares.testarAviso({ modo: 'mercado' })} className="btn-ghost py-1 text-xs">
                  Testar aviso
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-stone-100 pt-3 dark:border-stone-700">
          <label className="flex items-center gap-3">
            <ShoppingBagIcon className="size-5 flex-shrink-0 text-emerald-600" />
            <span className="flex-1">
              <span className="block font-medium">Dia de hortifrúti</span>
              <span className="block text-xs text-stone-500 dark:text-stone-400">Desconto ou reposição de frutas e verduras.</span>
            </span>
            <Toggle label="Lembrar do dia de hortifrúti" checked={config.hortifruti.ativo} onChange={(v) => ligar('hortifruti', v)} />
          </label>
          {config.hortifruti.ativo && (
            <div className="space-y-2 pl-8">
              <div className="flex gap-1">
                {DIAS.map((d, i) => {
                  const marcado = config.hortifruti.dias.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        mudar('hortifruti', {
                          dias: marcado ? config.hortifruti.dias.filter((x) => x !== i) : [...config.hortifruti.dias, i].sort(),
                        })
                      }
                      className={`size-8 rounded-full text-xs font-bold ${marcado ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-300'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                às
                <input type="time" className="input w-24 py-0.5" value={config.hortifruti.hora} onChange={(e) => mudar('hortifruti', { hora: e.target.value })} />
                <input
                  className="input min-w-0 flex-1 py-0.5"
                  placeholder="mercado (opcional)"
                  value={config.hortifruti.mercado}
                  onChange={(e) => mudar('hortifruti', { mercado: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Secao>
  );
}
