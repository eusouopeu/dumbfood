import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  HomeIcon,
  StarIcon as StarOutlineIcon,
  VideoCameraIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CalendarDaysIcon as CalendarSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
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
  definirNotas,
} from '../db/repo';
import { combinarReceita } from '../lib/geladeira';
import { resolveGondola } from '../lib/aisles';
import { scaleIngredients, fatorParaRendimento } from '../lib/scale';
import { type MedidaModo } from '../lib/measures';
import { detectPreheat } from '../lib/preheat';
import { unitDefByCanonical } from '../lib/units';
import { pesoEmGramas } from '../lib/weight';
import { capitalizar, nomeItem, rotuloRendimento, formatTempo } from '../lib/format';
import { calcularNutricaoTotal, dividirPorPorcoes } from '../lib/nutrition';
import { calcularMicroTotal, coberturaMicro, dividirMicro } from '../lib/micronutrientes';
import { custoReceita, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { toast } from '../lib/toast';
import { confirmar } from '../lib/confirm';
import { hapticForte, hapticLeve } from '../lib/haptics';
import Secao from '../components/Secao';
import ListaIngredientes from '../components/receita/ListaIngredientes';
import ControleReescala, { type Modo } from '../components/receita/ControleReescala';
import { TabelaNutricional, TabelaMicronutrientes } from '../components/receita/TabelasNutricionais';
import VideoReceita, { type VideoReceitaHandle } from '../components/VideoReceita';
import RestricaoModal from '../components/RestricaoModal';
import TimerFab from '../components/TimerFab';
import type { Ingredient, YieldType } from '../types';

/** Estilo comum dos botões da barra da receita: todos em laranja, menos o de excluir. */
const ICONE_BARRA =
  'rounded-full p-1.5 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-stone-800';

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
  const precos = useLiveQuery(() => db.precos.toArray(), []);

  const [modo, setModo] = useState<Modo>('rendimento');
  const [alvoRend, setAlvoRend] = useState<number | null>(null);
  const [tipoRend, setTipoRend] = useState<YieldType | null>(null);
  const [refIngIdx, setRefIngIdx] = useState<number>(-1);
  const [alvoGramas, setAlvoGramas] = useState<number>(0);
  // Padrão em g/L assim que a receita é aberta/importada; o usuário pode trocar para original/recipiente.
  const [medidaModo, setMedidaModo] = useState<MedidaModo>('metrico');
  const [novaTag, setNovaTag] = useState('');
  const [tamanho, setTamanho] = useState<TamanhoLeitura>(() => tamanhoSalvo());
  const [restricaoAberta, setRestricaoAberta] = useState(false);
  const [notas, setNotas] = useState('');
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

  // Trocas de ingrediente feitas na hora do preparo ("acabou o leite"): valem só para
  // esta visita à receita e entram antes da reescala, então a tabela nutricional, os
  // micronutrientes e o custo já saem com o substituto.
  const [trocas, setTrocas] = useState<Record<number, string>>({});
  useEffect(() => {
    setTrocas({});
  }, [recipe?.id]);

  function trocarIngrediente(indice: number, substituto: string | null) {
    setTrocas((atual) => {
      const novo = { ...atual };
      if (substituto === null) delete novo[indice];
      else novo[indice] = substituto;
      return novo;
    });
    hapticLeve();
  }

  useEffect(() => {
    setNotas(recipe?.notas ?? '');
  }, [recipe?.id]);

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

  const comTrocas: Ingredient[] = recipe.ingredientes.map((ing, i) =>
    trocas[i] === undefined ? ing : { ...ing, item: trocas[i], gondola: resolveGondola(trocas[i]) },
  );
  const escalados = scaleIngredients(comTrocas, fator);
  const totalTrocas = Object.keys(trocas).length;
  const noPlano = plano.itens.find((i) => i.recipeId === recipe.id);
  const tempo = formatTempo(recipe.tempoPreparoMin);
  const pesoTotalG = escalados.reduce((soma, ing) => soma + (pesoEmGramas(ing.item, ing.quantidade, ing.unidade) ?? 0), 0);
  // Tabela nutricional sempre por 100 g, independente do rendimento da receita.
  const nutriPor100g = dividirPorPorcoes(calcularNutricaoTotal(escalados), pesoTotalG / 100);
  const microPor100g = dividirMicro(calcularMicroTotal(escalados), pesoTotalG / 100);
  const cobertura = coberturaMicro(escalados);
  const listaPrecos = [...(precos ?? []), ...PRECOS_BASE];
  const custo = custoReceita(escalados, listaPrecos);
  const custoPorcao = alvo > 0 ? custo.total / alvo : 0;

  async function salvarComoPadrao() {
    if (!recipe) return;
    await redefinirRendimentoPadrao(recipe, alvo, tipo);
    setAlvoRend(null);
    setTipoRend(null);
    setModo('rendimento');
  }

  /**
   * Fecha o ciclo geladeira -> receita: os ingredientes que estavam na geladeira e foram
   * usados nesta receita deixam de estar disponíveis. Fica na barra do topo, para registrar
   * a qualquer momento depois de cozinhar.
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

  async function salvarNotas() {
    if (!recipe) return;
    if ((recipe.notas ?? '') === notas.trim()) return;
    await definirNotas(recipe, notas);
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
            onClick={() => {
              hapticLeve();
              alternarFavorito(recipe);
            }}
            aria-label={recipe.favorito ? 'Remover dos favoritos' : 'Favoritar receita'}
            title={recipe.favorito ? 'Remover dos favoritos' : 'Favoritar'}
            className={ICONE_BARRA}
          >
            {recipe.favorito ? <StarSolidIcon className="size-6" /> : <StarOutlineIcon className="size-6" />}
          </button>
          <button
            onClick={() => setRestricaoAberta(true)}
            aria-label="Ajustar para restrição alimentar"
            title="Ajustar para restrição alimentar"
            className={ICONE_BARRA}
          >
            <ArrowsRightLeftIcon className="size-6" />
          </button>
          <button
            onClick={() => videoRef.current?.escolherArquivo()}
            aria-label={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            title={recipe.videoId ? 'Trocar vídeo do preparo' : 'Adicionar vídeo do preparo'}
            className={ICONE_BARRA}
          >
            <VideoCameraIcon className="size-6" />
          </button>
          <button
            onClick={darBaixaNaGeladeira}
            aria-label="Dar baixa na geladeira dos ingredientes usados"
            title="Dar baixa na geladeira"
            className={ICONE_BARRA}
          >
            <HomeIcon className="size-6" />
          </button>
          {noPlano ? (
            <button
              onClick={async () => {
                await removerDoPlano(recipe.id);
                toast('Removida da semana.');
              }}
              aria-label="Remover da semana"
              title="Remover da semana"
              className={ICONE_BARRA}
            >
              <CalendarSolidIcon className="size-6" />
            </button>
          ) : (
            <button
              onClick={async () => {
                await definirNoPlano(recipe.id, fator);
                toast('Adicionada à semana!');
              }}
              aria-label="Adicionar à semana"
              title="Adicionar à semana"
              className={ICONE_BARRA}
            >
              <CalendarDaysIcon className="size-6" />
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
            {custo.cobertos > 0 && (
              <>
                {' · '}
                <span title={custo.cobertos < custo.totalItens ? `Preço de ${custo.cobertos} de ${custo.totalItens} ingredientes` : undefined}>
                  ≈ {formatBRL(custo.total)}{custo.cobertos < custo.totalItens ? '+' : ''} ({formatBRL(custoPorcao)}/{rotuloRendimento(tipo, 1)})
                </span>
              </>
            )}
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
      </div>

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

      <ControleReescala
        modo={modo}
        onModo={setModo}
        alvo={alvo}
        onAlvo={setAlvoRend}
        tipo={tipo}
        onTipo={setTipoRend}
        massIngredientes={massIngredientes}
        refIngIdx={refIngIdx}
        onRefIng={setRefIngIdx}
        alvoGramas={alvoGramas}
        onAlvoGramas={setAlvoGramas}
        fator={fator}
        noPlano={!!noPlano}
        onAtualizarNaSemana={async () => {
          await definirNoPlano(recipe.id, fator);
          hapticLeve();
          toast('Quantidade atualizada na semana.');
        }}
        onSalvarComoPadrao={salvarComoPadrao}
      />

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
        {totalTrocas > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
            <span className="flex-1">
              {totalTrocas} {totalTrocas === 1 ? 'ingrediente trocado' : 'ingredientes trocados'} — valores e custo
              recalculados.
            </span>
            <button onClick={() => setTrocas({})} className="font-semibold underline">
              desfazer
            </button>
          </div>
        )}
        <ListaIngredientes
          ingredientes={escalados}
          medidaModo={medidaModo}
          tamanhoFonte={TAMANHOS_LEITURA[tamanho]}
          trocas={trocas}
          onTrocar={trocarIngrediente}
        />
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

      {/* Anotação livre: ajustes e observações de quem realmente fez a receita — o
          site de origem nunca fica 100% fiel ao uso real. */}
      <Secao chave="notas" titulo="Minhas notas" subtitulo={notas ? undefined : 'vazio'}>
        <textarea
          className="input min-h-24 resize-y"
          placeholder="Ex.: fiz com metade do açúcar, rendeu menos que o anunciado…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={salvarNotas}
        />
      </Secao>

      {escalados.length > 0 && (
        <>
          <TabelaNutricional nutri={nutriPor100g} />
          <TabelaMicronutrientes micro={microPor100g} cobertura={cobertura} />
        </>
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

      <TimerFab tituloSugerido={capitalizar(recipe.titulo)} />
    </div>
  );
}
