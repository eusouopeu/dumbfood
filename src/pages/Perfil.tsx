// Perfil e metas: quem come, quanto come por dia e como isso se divide entre os macros.
//
// As três coisas ficam na mesma tela porque uma alimenta a outra: mudar o peso muda a
// sugestão de calorias, que muda os gramas de cada macro. Em telas separadas, o efeito
// da edição só apareceria depois de navegar.

import {
  ArrowUturnLeftIcon,
  FireIcon,
  ChartPieIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  ATIVIDADES,
  OBJETIVOS,
  SEXOS,
  kcalSugerida,
  tmb,
  usePerfil,
  type Perfil as PerfilTipo,
} from '../lib/perfil';
import {
  META_MACROS_PADRAO,
  energiaDePercentualEmMassa,
  metaEfetiva,
  useMetaSalva,
} from '../lib/metas';
import { DIETA_ORDEM, DIETAS } from '../lib/diet';
import AjusteMacros from '../components/perfil/AjusteMacros';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';

function CampoNumero({
  rotulo,
  valor,
  sufixo,
  min,
  max,
  step = 1,
  onChange,
}: {
  rotulo: string;
  valor: number | undefined;
  sufixo: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-stone-500 dark:text-stone-400">{rotulo}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={valor ?? ''}
          placeholder="—"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(e.target.value === '' || !Number.isFinite(n) ? undefined : n);
          }}
          className="input py-1.5"
        />
        <span className="text-xs text-stone-400 dark:text-stone-500">{sufixo}</span>
      </span>
    </label>
  );
}

function GrupoOpcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { chave: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-stone-500 dark:text-stone-400">{rotulo}</p>
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-800">
        {opcoes.map((o) => (
          <button
            key={o.chave}
            onClick={() => onChange(o.chave)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 font-semibold ${
              valor === o.chave ? 'bg-white shadow-sm dark:bg-stone-700' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Perfil() {
  const [perfil, setPerfil] = usePerfil();
  const [meta, setMeta] = useMetaSalva();
  const efetiva = metaEfetiva(perfil, meta);
  const sugerida = kcalSugerida(perfil);
  const basal = tmb(perfil);

  function mudar(patch: Partial<PerfilTipo>) {
    setPerfil({ ...perfil, ...patch });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Perfil e metas</h2>

      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <UserCircleIcon className="size-5 text-brand-500" />
          <h3 className="section-heading text-sm">Dados pessoais</h3>
        </div>

        <label className="block">
          <span className="block text-xs text-stone-500 dark:text-stone-400">Nome (opcional)</span>
          <input
            className="input py-1.5"
            value={perfil.nome ?? ''}
            placeholder="Como te chamar"
            onChange={(e) => mudar({ nome: e.target.value || undefined })}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <CampoNumero rotulo="Idade" valor={perfil.idade} sufixo="anos" min={5} max={120} onChange={(v) => mudar({ idade: v })} />
          <CampoNumero rotulo="Peso" valor={perfil.pesoKg} sufixo="kg" min={20} max={400} step={0.1} onChange={(v) => mudar({ pesoKg: v })} />
          <CampoNumero rotulo="Altura" valor={perfil.alturaCm} sufixo="cm" min={80} max={250} onChange={(v) => mudar({ alturaCm: v })} />
        </div>

        <GrupoOpcoes rotulo="Sexo biológico (usado no cálculo do gasto)" opcoes={SEXOS} valor={perfil.sexo} onChange={(v) => mudar({ sexo: v })} />
        <GrupoOpcoes
          rotulo="Nível de atividade"
          opcoes={ATIVIDADES.map((a) => ({ chave: a.chave, label: a.label }))}
          valor={perfil.atividade}
          onChange={(v) => mudar({ atividade: v })}
        />
        <GrupoOpcoes rotulo="Objetivo" opcoes={OBJETIVOS} valor={perfil.objetivo} onChange={(v) => mudar({ objetivo: v })} />

        {basal !== null ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Gasto basal estimado: <span className="font-semibold">{basal.toLocaleString('pt-BR')} kcal/dia</span> (Mifflin-St
            Jeor). Com atividade e objetivo, a sugestão do dia fica em{' '}
            <span className="font-semibold">{sugerida?.toLocaleString('pt-BR')} kcal</span>.
          </p>
        ) : (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Preencha idade, peso e altura para o app estimar seu gasto diário. Sem isso, a meta
            começa em 2.000 kcal.
          </p>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <FireIcon className="size-5 text-brand-500" />
          <h3 className="section-heading text-sm">Calorias por dia</h3>
        </div>

        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="block text-xs text-stone-500 dark:text-stone-400">Meta diária</span>
            <input
              type="number"
              inputMode="numeric"
              min={800}
              max={6000}
              step={10}
              className="input py-1.5 text-lg font-bold tabular-nums"
              value={efetiva.kcal}
              onChange={(e) => {
                const n = Number(e.target.value);
                setMeta({ ...meta, kcal: Number.isFinite(n) && n > 0 ? n : null });
              }}
            />
          </label>
          <span className="pb-2 text-xs text-stone-400 dark:text-stone-500">kcal</span>
          {!efetiva.kcalAutomatica && (
            <button
              onClick={() => {
                setMeta({ ...meta, kcal: null });
                hapticLeve();
                toast('Meta de calorias de volta ao cálculo do perfil.');
              }}
              className="btn-outline h-9 px-2 text-xs"
            >
              <ArrowUturnLeftIcon className="size-3.5" /> Usar sugestão
            </button>
          )}
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          {efetiva.kcalAutomatica
            ? 'Calculada a partir do perfil. Digite um número para fixá-la à mão.'
            : 'Número fixado à mão — não muda quando o perfil muda.'}
        </p>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <ChartPieIcon className="size-5 text-brand-500" />
          <h3 className="section-heading text-sm">Macronutrientes</h3>
        </div>

        <AjusteMacros
          kcal={efetiva.kcal}
          macros={meta.macros}
          travado={meta.travado}
          onMacros={(macros) => setMeta({ ...meta, macros })}
          onTravado={(travado) => setMeta({ ...meta, travado })}
        />

        {/* Pontos de partida e o retorno ao padrão numa só fileira de botões do mesmo tamanho. */}
        <div className="flex flex-nowrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-700">
          {DIETA_ORDEM.map((d) => (
            <button
              key={d}
              onClick={() => {
                setMeta({ ...meta, macros: energiaDePercentualEmMassa(d) });
                hapticLeve();
                toast(`Divisão da dieta ${DIETAS[d].label} aplicada.`);
              }}
              className="btn-outline h-8 px-2 text-xs"
            >
              {DIETAS[d].label}
            </button>
          ))}
          <button
            onClick={() => {
              setMeta({ ...meta, macros: META_MACROS_PADRAO, travado: null });
              hapticLeve();
              toast('Macros de volta ao padrão.');
            }}
            aria-label="Voltar ao original"
            title="Voltar ao original"
            className="btn-outline ml-auto h-8 flex-shrink-0 px-2 text-xs"
          >
            <ArrowUturnLeftIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
