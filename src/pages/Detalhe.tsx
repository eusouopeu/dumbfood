import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArchiveBoxArrowDownIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  StarIcon as StarOutlineIcon,
  VideoCameraIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import {
  definirNoPlano,
  removerDoPlano,
  removerReceita,
  redefinirRendimentoPadrao,
  definirTags,
  adicionarTags,
  alternarFavorito,
  baixarDaGeladeira,
} from '../db/repo';
import { combinarReceita } from '../lib/geladeira';
import { scaleIngredients, fatorParaRendimento } from '../lib/scale';
import { formatQtdUnidadeAbrev, formatDecimal } from '../lib/displayQty';
import { padronizarMedida, type MedidaModo } from '../lib/measures';
import { detectPreheat } from '../lib/preheat';
import { unitDefByCanonical } from '../lib/units';
import { pesoEmGramas } from '../lib/weight';
import { capitalizar, nomeItem, rotuloRendimento, formatTempo } from '../lib/format';
import { calcularNutricaoTotal, dividirPorPorcoes, percentualVD } from '../lib/nutrition';
import { CAMPOS_MICRO, calcularMicroTotal, coberturaMicro, dividirMicro, percentualVDMicro } from '../lib/micronutrientes';
import { toast } from '../lib/toast';
import { confirmar } from '../lib/confirm';
import { hapticForte, hapticLeve } from '../lib/haptics';
import CookMode from '../components/CookMode';
import Secao from '../components/Secao';
import VideoReceita, { type VideoReceitaHandle } from '../components/VideoReceita';
import RestricaoModal from '../components/RestricaoModal';
import type { YieldType } from '../types';

type Modo = 'rendimento' | 'grama';

const TAMANHOS_LEITURA = { md: 16, lg: 19, xl: 22 } as const;
type TamanhoLeitura = keyof typeof TAMANHOS_LEITURA;
const TAMANHO_KEY = 'dumbfood:tamanhoLeitura';

function tamanhoSalvo(): TamanhoLeitura {
  const v = localStorage.getItem(TAMANHO_KEY);
  return v === 'md' || v === 'lg' || v === 'xl' ? v : 'md';
}

export default function Detalhe() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const plano = usePlano();

  const [modo, setModo] = useState<Modo>('rendimento');
  const [alvoRend, setAlvoRend] = useState<number | null>(null);
  const [tipoRend, setTipoRend] = useState<YieldType | null>(null);
  const [refIngIdx, setRefIngIdx] = useState<number>(-1);
  const [alvoGramas, setAlvoGramas] = useState<number>(0);
  // Padrão em g/L assim que a receita é aberta/importada; o usuário pode trocar para original/recipiente.
  const [medidaModo, setMedidaModo] = useState<MedidaModo>('metrico');
  const [novaTag, setNovaTag] = useState('');
  const [tamanho, setTamanho] = useState<TamanhoLeitura>(() => tamanhoSalvo());
  const [cozinhando, setCozinhando] = useState(false);
  const [restricaoAberta, setRestricaoAberta] = useState(false);
  const videoRef = useRef<VideoReceitaHandle>(null);

  function mudarTamanho(t: TamanhoLeitura) {
    setTamanho(t);
    localStorage.setItem(TAMANHO_KEY, t);
  }

  const massIngredientes = useMemo(() => {
    if (!recipe) return [] as { idx: number; label: string; baseG: number }[];
    return recipe.ingredientes
      .map((ing, idx) => {
        const def = ing.unidade ? unitDefByCanonical(ing.unidade) : undefined;
        if (def?.dimension === 'massa' && ing.quantidade) {
          return { idx, label: ing.item, baseG: ing.quantidade * def.toBase };
        }
        return null;
      })
      .filter((x): x is { idx: number; label: string; baseG: number } => x !== null);
  }, [recipe]);

  const preheat = useMemo(() => (recipe ? detectPreheat(recipe.modoPreparo) : null), [recipe]);

  if (recipe === undefined)
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-700" />
        <div className="h-44 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-700" />
        <div className="h-32 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-700" />
      </div>
    );
  if (recipe === null)
    return (
      <div className="space-y-3">
        <p>Receita não encontrada.</p>
        <Link to="/" className="btn-ghost">
          Voltar
        </Link>
      </div>
    );

  const base = recipe.rendimentoBase;
  const alvo = alvoRend ?? base.valor;
  const tipo = tipoRend ?? base.tipo;

  let fator = 1;
  if (modo === 'rendimento') {
    fator = fatorParaRendimento(base, alvo);
  } else if (modo === 'grama' && refIngIdx >= 0 && alvoGramas > 0) {
    const ref = massIngredientes.find((m) => m.idx === refIngIdx);
    if (ref && ref.baseG > 0) fator = alvoGramas / ref.baseG;
  }

  const escalados = scaleIngredients(recipe.ingredientes, fator);
  const noPlano = plano.itens.find((i) => i.recipeId === recipe.id);
  const tempo = formatTempo(recipe.tempoPreparoMin);
  const pesoTotalG = escalados.reduce((soma, ing) => soma + (pesoEmGramas(ing.item, ing.quantidade, ing.unidade) ?? 0), 0);
  // Tabela nutricional sempre por 100 g, independente do rendimento da receita.
  const nutriPor100g = dividirPorPorcoes(calcularNutricaoTotal(escalados), pesoTotalG / 100);
  const microPor100g = dividirMicro(calcularMicroTotal(escalados), pesoTotalG / 100);
  const cobertura = coberturaMicro(escalados);

  async function salvarComoPadrao() {
    if (!recipe) return;
    await redefinirRendimentoPadrao(recipe, alvo, tipo);
    setAlvoRend(null);
    setTipoRend(null);
    setModo('rendimento');
  }

  /**
   * Fecha o ciclo geladeira -> receita: os ingredientes que estavam na geladeira e foram
   * usados nesta receita deixam de estar disponíveis. Fica na barra do topo (e não só no
   * fim do modo cozinha) para dar para registrar também quando se cozinhou sem o app.
   */
  async function darBaixaNaGeladeira() {
    if (!recipe) return;
    const geladeira = await db.geladeira.toArray();
    const { usados } = combinarReceita(recipe, geladeira);
    if (usados.length === 0) {
      toast('Nenhum ingrediente desta receita está na geladeira.', 'info');
      return;
    }
    const nomes = geladeira.filter((g) => usados.includes(g.itemKey)).map((g) => nomeItem(g.nome));
    const ok = await confirmar(
      `Dar baixa na geladeira dos ingredientes usados? (${nomes.join(', ')})`,
      { textoConfirmar: 'Dar baixa' },
    );
    if (!ok) return;
    const n = await baixarDaGeladeira(usados);
    hapticLeve();
    toast(`${n} ${n === 1 ? 'item removido' : 'itens removidos'} da geladeira.`);
  }

  async function addTag() {
    const t = novaTag.trim();
    if (!recipe || !t) return;
    await adicionarTags(recipe, [t]);
    setNovaTag('');
  }

  return (
    <div className="space-y-4">
      {/* Barra da receita: fica fixa no topo (a barra geral do app some nesta tela) e
          concentra as ações que antes ocupavam botões largos no meio do conteúdo. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-1 border-b border-stone-200 bg-brand-50/90 px-4 py-2.5 backdrop-blur dark:border-stone-700 dark:bg-stone-900/90">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400">
          <ArrowLeftIcon className="size-4" /> Receitas
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setRestricaoAberta(true)}
            aria-label="Ajustar para restrição alimentar"
            title="Ajustar para restrição alimentar"
            className="rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800"
          >
            <ArrowsRightLeftIcon className="size-6" />
          </button>
          <button
            onClick={() => videoRef.current?.escolherArquivo()}
            aria-label={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            title={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            className={`rounded-full p-1.5 hover:bg-brand-100 dark:hover:bg-stone-800 ${
              recipe.videoId ? 'text-brand-600 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            <VideoCameraIcon className="size-6" />
          </button>
          <button
            onClick={darBaixaNaGeladeira}
            aria-label="Dar baixa na geladeira dos ingredientes usados"
            title="Dar baixa na geladeira"
            className="rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800"
          >
            <ArchiveBoxArrowDownIcon className="size-6" />
          </button>
          {noPlano ? (
            <button
              onClick={async () => {
                await removerDoPlano(recipe.id);
                toast('Removida da semana.');
              }}
              aria-label="Remover da semana"
              title="Remover da semana"
              className="rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800"
            >
              <CheckCircleIcon className="size-6" />
            </button>
          ) : (
            <button
              onClick={async () => {
                await definirNoPlano(recipe.id, fator);
                toast('Adicionada à semana!');
              }}
              aria-label="Adicionar à semana"
              title="Adicionar à semana"
              className="rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800"
            >
              <PlusIcon className="size-6" />
            </button>
          )}
          <button
            onClick={async () => {
              const ok = await confirmar('Excluir esta receita? Essa ação não pode ser desfeita.', {
                textoConfirmar: 'Excluir',
                perigo: true,
              });
              if (ok) {
                await removerReceita(recipe.id);
                hapticForte();
                toast('Receita excluída.');
                navigate('/');
              }
            }}
            aria-label="Excluir receita"
            title="Excluir receita"
            className="rounded-full p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-stone-800"
          >
            <XCircleIcon className="size-6" />
          </button>
        </div>
      </div>

      {recipe.imagem && <img src={recipe.imagem} alt="" className="h-44 w-full rounded-2xl object-cover" />}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-snug">{capitalizar(recipe.titulo)}</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Rende {base.valor} {rotuloRendimento(base.tipo, base.valor)}
            {tempo ? ` · ${tempo}` : ''}
            {recipe.fonteUrl && (
              <>
                {' · '}
                <a href={recipe.fonteUrl} target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline">
                  fonte
                </a>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            hapticLeve();
            alternarFavorito(recipe);
          }}
          aria-label={recipe.favorito ? 'Remover dos favoritos' : 'Favoritar receita'}
          className="flex-shrink-0 rounded-full p-1.5 text-amber-400 hover:bg-amber-50 dark:hover:bg-stone-800"
        >
          {recipe.favorito ? <StarSolidIcon className="size-7" /> : <StarOutlineIcon className="size-7 text-stone-300 dark:text-stone-600" />}
        </button>
      </div>

      {recipe.modoPreparo.length > 0 && (
        <button onClick={() => setCozinhando(true)} className="btn-primary w-full">
          <PlayCircleIcon className="size-5" /> Modo cozinha
        </button>
      )}

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {recipe.tags.map((t) => (
          <span key={t} className="chip gap-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
            {t}
            <button
              onClick={() => definirTags(recipe, recipe.tags.filter((x) => x !== t))}
              className="text-brand-500 dark:text-brand-400 hover:text-brand-700"
              aria-label={`remover ${t}`}
            >
              <XMarkIcon className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          className="input h-7 w-28 py-0 text-xs"
          placeholder="+ tag"
          value={novaTag}
          onChange={(e) => setNovaTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
        />
      </div>

      {/* Controle de reescala */}
      <div className="card space-y-3 p-4">
        <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
          <button
            onClick={() => setModo('rendimento')}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${modo === 'rendimento' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
          >
            Por porção/pessoa
          </button>
          <button
            onClick={() => setModo('grama')}
            disabled={massIngredientes.length === 0}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold disabled:opacity-40 ${modo === 'grama' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
          >
            Por grama
          </button>
        </div>

        {modo === 'rendimento' ? (
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <button className="btn-outline h-9 w-9 !px-0" onClick={() => setAlvoRend(Math.max(1, alvo - 1))}>
                <MinusIcon className="mx-auto size-4" />
              </button>
              <input
                type="number"
                min={1}
                className="input w-16 text-center"
                value={alvo}
                onChange={(e) => setAlvoRend(Math.max(1, Number(e.target.value)))}
              />
              <button className="btn-outline h-9 w-9 !px-0" onClick={() => setAlvoRend(alvo + 1)}>
                <PlusIcon className="mx-auto size-4" />
              </button>
            </div>
            <select className="input flex-1" value={tipo} onChange={(e) => setTipoRend(e.target.value as YieldType)}>
              <option value="porcoes">porções</option>
              <option value="pessoas">pessoas</option>
              <option value="unidades">unidades</option>
            </select>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-stone-500 dark:text-stone-400">Ingrediente de referência</label>
              <select className="input" value={refIngIdx} onChange={(e) => setRefIngIdx(Number(e.target.value))}>
                <option value={-1}>escolha…</option>
                {massIngredientes.map((m) => (
                  <option key={m.idx} value={m.idx}>
                    {nomeItem(m.label)} ({m.baseG} g)
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-stone-500 dark:text-stone-400">Tenho (g)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={alvoGramas || ''}
                onChange={(e) => setAlvoGramas(Number(e.target.value))}
              />
            </div>
          </div>
        )}
        {Math.abs(fator - 1) > 0.001 && (
          <div className="flex justify-end">
            <button onClick={salvarComoPadrao} className="btn-ghost h-7 py-0 text-xs">
              Salvar como padrão
            </button>
          </div>
        )}
      </div>

      {/* Ingredientes escalados */}
      <Secao chave="ingredientes" titulo="Ingredientes" subtitulo={`${escalados.length} itens`}>
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* Tamanho de leitura: útil para ler a receita a distância do fogão. */}
            <div className="flex gap-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
              {(Object.keys(TAMANHOS_LEITURA) as TamanhoLeitura[]).map((t) => (
                <button
                  key={t}
                  onClick={() => mudarTamanho(t)}
                  aria-label={`Tamanho de texto ${t === 'md' ? 'padrão' : t === 'lg' ? 'grande' : 'extra grande'}`}
                  className={`rounded-md px-2 py-1 font-bold ${tamanho === t ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
                  style={{ fontSize: t === 'md' ? 11 : t === 'lg' ? 13 : 15 }}
                >
                  A
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5 text-xs">
              {(['metrico', 'recipiente'] as MedidaModo[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMedidaModo(m)}
                  className={`rounded-md px-2 py-1 font-semibold ${medidaModo === m ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
                >
                  {m === 'metrico' ? 'g / L' : 'Recipientes'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ul className="space-y-3.5">
          {escalados.map((ing, i) => {
            const med = padronizarMedida(ing.item, ing.quantidade, ing.unidade, medidaModo);
            return (
              <li key={i} className="flex items-baseline gap-3 leading-relaxed" style={{ fontSize: TAMANHOS_LEITURA[tamanho] }}>
                <span className="w-24 flex-shrink-0 text-right font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                  {formatQtdUnidadeAbrev(med.quantidade, med.unidade)}
                </span>
                <span>{nomeItem(ing.item)}</span>
              </li>
            );
          })}
        </ul>
      </Secao>

      {/* Faça antes de começar: passo de pré-aquecimento, resumido (sem emoji nem citação da etapa) */}
      {preheat && (
        <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 p-3 text-amber-900 dark:text-amber-200 shadow-sm">
          <p className="text-sm font-bold">Antes de começar:</p>
          <p className="mt-1 text-sm font-bold">
            Pré-aqueça o forno
            {preheat.temperatura && (
              <span className="ml-2 rounded-full bg-amber-200 dark:bg-amber-800/60 px-2 py-0.5 text-xs">{preheat.temperatura}</span>
            )}
            {preheat.duracao && (
              <span className="ml-1 rounded-full bg-amber-200 dark:bg-amber-800/60 px-2 py-0.5 text-xs">{preheat.duracao}</span>
            )}
          </p>
        </div>
      )}

      {/* Sempre visível: receita de vídeo chega sem passos em texto, e é aqui que o
          usuário anexa (ou troca) o vídeo do preparo. */}
      <Secao
        chave="preparo"
        titulo="Modo de preparo"
        subtitulo={
          recipe.secoesPreparo && recipe.secoesPreparo.length > 0
            ? `${recipe.secoesPreparo.length} partes · ${recipe.modoPreparo.length} passos`
            : recipe.modoPreparo.length > 0
              ? `${recipe.modoPreparo.length} passos`
              : recipe.videoId
                ? 'vídeo'
                : 'sem passos'
        }
      >
        <VideoReceita ref={videoRef} recipe={recipe} embutido={false} />
        {recipe.secoesPreparo && recipe.secoesPreparo.length > 0 ? (
          /* Receita em partes (massa + recheio): cada parte mantém a própria numeração,
             que é como ela aparece no site de origem. */
          <div className="space-y-5">
            {recipe.secoesPreparo.map((sec, s) => (
              <div key={s}>
                {sec.titulo && (
                  <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                    {sec.titulo}
                  </p>
                )}
                <ol className="space-y-5">
                  {sec.passos.map((p, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 font-extrabold text-brand-600 dark:text-brand-400">{i + 1}.</span>
                      <span className="leading-relaxed" style={{ fontSize: TAMANHOS_LEITURA[tamanho] }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-5">
            {recipe.modoPreparo.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 font-extrabold text-brand-600 dark:text-brand-400">{i + 1}.</span>
                <span className="leading-relaxed" style={{ fontSize: TAMANHOS_LEITURA[tamanho] }}>
                  {p}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Secao>

      {/* Tabela nutricional estimada, a partir de ingredientes-chave */}
      {escalados.length > 0 && (
        <Secao chave="nutricional" titulo="Tabela nutricional" subtitulo="Por 100 g">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-1.5 text-left text-xs font-semibold text-stone-500 dark:text-stone-400">Item</th>
                <th className="py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">100 g</th>
                <th className="w-16 py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">% VD</th>
              </tr>
            </thead>
            <tbody>
              {/* Caloria com casa decimal não ajuda ninguém a decidir nada: arredonda pra cima. */}
              <NutriLinha label="Valor energético" valor={`${Math.ceil(nutriPor100g.kcal)} kcal`} vd={percentualVD('kcal', nutriPor100g.kcal)} />
              <NutriLinha label="Carboidratos" valor={`${formatDecimal(nutriPor100g.carboidrato)} g`} vd={percentualVD('carboidrato', nutriPor100g.carboidrato)} />
              <NutriLinha label="dos quais açúcares" valor={`${formatDecimal(nutriPor100g.acucares)} g`} indent />
              <NutriLinha label="Proteínas" valor={`${formatDecimal(nutriPor100g.proteina)} g`} vd={percentualVD('proteina', nutriPor100g.proteina)} />
              <NutriLinha label="Gorduras totais" valor={`${formatDecimal(nutriPor100g.gorduraTotal)} g`} vd={percentualVD('gorduraTotal', nutriPor100g.gorduraTotal)} />
              <NutriLinha label="saturadas" valor={`${formatDecimal(nutriPor100g.gorduraSaturada)} g`} vd={percentualVD('gorduraSaturada', nutriPor100g.gorduraSaturada)} indent />
              <NutriLinha label="insaturadas" valor={`${formatDecimal(Math.max(0, nutriPor100g.gorduraTotal - nutriPor100g.gorduraSaturada))} g`} indent />
              <NutriLinha label="Colesterol" valor={`${formatDecimal(nutriPor100g.colesterolMg)} mg`} vd={percentualVD('colesterolMg', nutriPor100g.colesterolMg)} />
              <NutriLinha label="Fibra alimentar" valor={`${formatDecimal(nutriPor100g.fibra)} g`} vd={percentualVD('fibra', nutriPor100g.fibra)} last />
            </tbody>
          </table>
        </Secao>
      )}

      {/* Vitaminas e minerais, mesma base de cálculo da tabela nutricional */}
      {escalados.length > 0 && (
        <Secao chave="micronutrientes" titulo="Vitaminas e minerais" subtitulo="Por 100 g">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-1.5 text-left text-xs font-semibold text-stone-500 dark:text-stone-400">Item</th>
                <th className="py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">100 g</th>
                <th className="w-16 py-1.5 text-right text-xs font-semibold text-stone-500 dark:text-stone-400">% VD</th>
              </tr>
            </thead>
            <tbody>
              {CAMPOS_MICRO.map(({ chave, label, unidade }, i) => (
                <NutriLinha
                  key={chave}
                  label={label}
                  valor={`${formatDecimal(microPor100g[chave])} ${unidade}`}
                  vd={percentualVDMicro(chave, microPor100g[chave])}
                  last={i === CAMPOS_MICRO.length - 1}
                />
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
            Estimativa a partir de {cobertura.conhecidos} de {cobertura.total} ingredientes reconhecidos
            (TACO/USDA). O que a tabela não conhece entra como zero, então o valor real tende a ser maior.
          </p>
        </Secao>
      )}

      {/* Ações */}
      {noPlano && (
        <button
          onClick={async () => {
            await definirNoPlano(recipe.id, fator);
            toast('Quantidade atualizada na semana.');
          }}
          className="btn-ghost"
        >
          Atualizar quantidade na semana
        </button>
      )}

      {cozinhando && (
        <CookMode
          titulo={capitalizar(recipe.titulo)}
          passos={recipe.modoPreparo}
          onClose={() => setCozinhando(false)}
        />
      )}

      {restricaoAberta && (
        <RestricaoModal
          recipe={recipe}
          onClose={() => setRestricaoAberta(false)}
          onAplicar={async (novaReceita) => {
            setRestricaoAberta(false);
            toast('Nova versão da receita criada!');
            navigate(`/receita/${novaReceita.id}`);
          }}
        />
      )}
    </div>
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
