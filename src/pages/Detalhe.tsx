import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { definirNoPlano, redefinirRendimentoPadrao, definirNotas } from '../db/repo';
import { resolveGondola } from '../lib/aisles';
import { scaleIngredients, fatorParaRendimento, ingredientesDeMassa } from '../lib/scale';
import { type MedidaModo } from '../lib/measures';
import { detectPreheat } from '../lib/preheat';
import { pesoEmGramas } from '../lib/weight';
import { capitalizar, rotuloRendimento, formatTempo } from '../lib/format';
import { calcularNutricaoTotal, dividirPorPorcoes } from '../lib/nutrition';
import { calcularMicroTotal, coberturaMicro, dividirMicro } from '../lib/micronutrientes';
import { custoReceita, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import Secao from '../components/Secao';
import BarraReceita from '../components/receita/BarraReceita';
import EditorTags from '../components/receita/EditorTags';
import ModoPreparo from '../components/receita/ModoPreparo';
import ListaIngredientes from '../components/receita/ListaIngredientes';
import ControleReescala, { type Modo } from '../components/receita/ControleReescala';
import { TabelaNutricional, TabelaMicronutrientes } from '../components/receita/TabelasNutricionais';
import SelosQualidade from '../components/receita/SelosQualidade';
import { type VideoReceitaHandle } from '../components/VideoReceita';
import RestricaoModal from '../components/RestricaoModal';
import TimerFab from '../components/TimerFab';
import type { Ingredient, YieldType } from '../types';

const TAMANHOS_LEITURA = { md: 16, lg: 19, xl: 22 } as const;
type TamanhoLeitura = keyof typeof TAMANHOS_LEITURA;
const TAMANHO_KEY = 'dumbfood:tamanhoLeitura';

function tamanhoSalvo(): TamanhoLeitura {
  const v = localStorage.getItem(TAMANHO_KEY);
  return v === 'md' || v === 'lg' || v === 'xl' ? v : 'md';
}

export default function Detalhe() {
  const { id = '' } = useParams();
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
  const [tamanho, setTamanho] = useState<TamanhoLeitura>(() => tamanhoSalvo());
  const [restricaoAberta, setRestricaoAberta] = useState(false);
  const [notas, setNotas] = useState('');
  const videoRef = useRef<VideoReceitaHandle>(null);

  function mudarTamanho(t: TamanhoLeitura) {
    setTamanho(t);
    localStorage.setItem(TAMANHO_KEY, t);
  }

  const massIngredientes = useMemo(() => (recipe ? ingredientesDeMassa(recipe.ingredientes) : []), [recipe]);

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
        <Link to="/receitas" className="btn-ghost">
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

  async function salvarNotas() {
    if (!recipe) return;
    if ((recipe.notas ?? '') === notas.trim()) return;
    await definirNotas(recipe, notas);
  }

  return (
    <div className="space-y-4">
      <BarraReceita
        recipe={recipe}
        noPlano={!!noPlano}
        fator={fator}
        onRestricao={() => setRestricaoAberta(true)}
        onVideo={() => videoRef.current?.escolherArquivo()}
      />

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

      <EditorTags recipe={recipe} />

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

      <ModoPreparo ref={videoRef} recipe={recipe} preheat={preheat} tamanhoFonte={TAMANHOS_LEITURA[tamanho]} />

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
          {/* O selo vem antes da tabela: "é pesado?" é a pergunta que decide se a
              receita entra na semana; os sete números respondem a outra coisa. */}
          <div className="card p-4">
            <h3 className="section-heading mb-2 text-sm">Qualidade nutricional</h3>
            <SelosQualidade nutri={nutriPor100g} micro={microPor100g} />
          </div>
          <TabelaNutricional nutri={nutriPor100g} />
          <TabelaMicronutrientes micro={microPor100g} cobertura={cobertura} />
        </>
      )}

      {restricaoAberta && (
        <RestricaoModal
          recipe={recipe}
          onClose={() => setRestricaoAberta(false)}
          onAplicar={(atualizada) => {
            setRestricaoAberta(false);
            toast(atualizada.restricaoAplicada ? 'Receita ajustada!' : 'Ajuste revertido.');
          }}
        />
      )}

      <TimerFab tituloSugerido={capitalizar(recipe.titulo)} />
    </div>
  );
}
