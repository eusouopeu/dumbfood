// Folha de registro do que foi comido numa refeição.
//
// Quase todo registro é repetição: a mesma receita do plano, ou algo já comido dias
// atrás. Por isso as abas na ordem "Agendado → Recentes → Favoritos → Buscar" — a
// primeira aba costuma bastar, e a busca só existe para o dia fora do roteiro.

import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { capitalizar } from '../../lib/format';
import { calcularNutricaoTotal, dividirPorPorcoes, nutrientesPor100g, type Nutrientes100g } from '../../lib/nutrition';
import { rotuloRefeicao } from '../../lib/agenda';
import { recentes as ultimosRegistros } from '../../lib/consumo';
import { estimarPrato, mensagemErroIA, useIAConfigurada, type PratoEstimado } from '../../lib/ia';
import { salvarPrato } from '../../db/repo';
import { toast } from '../../lib/toast';
import { avisosDosIngredientes, useAvisosNexo, type AvisoNexo } from '../../lib/avisosNexo';
import SelosQualidade from '../receita/SelosQualidade';
import type { PratoSalvo, Recipe, Refeicao, RegistroConsumo } from '../../types';

type Aba = 'agendado' | 'recentes' | 'favoritos' | 'buscar';

const ABAS: { chave: Aba; label: string }[] = [
  { chave: 'agendado', label: 'Agendado' },
  { chave: 'recentes', label: 'Recentes' },
  { chave: 'favoritos', label: 'Favoritos' },
  { chave: 'buscar', label: 'Buscar' },
];

/** Nutrientes de uma porção da receita, como ela está gravada (rendimento base). */
export function nutrientesPorPorcao(recipe: Recipe): Nutrientes100g {
  const total = calcularNutricaoTotal(recipe.ingredientes);
  return dividirPorPorcoes(total, recipe.rendimentoBase.valor || 1);
}

function multiplicar(n: Nutrientes100g, fator: number): Nutrientes100g {
  return {
    kcal: n.kcal * fator,
    gorduraTotal: n.gorduraTotal * fator,
    gorduraSaturada: n.gorduraSaturada * fator,
    colesterolMg: n.colesterolMg * fator,
    carboidrato: n.carboidrato * fator,
    acucares: n.acucares * fator,
    proteina: n.proteina * fator,
    fibra: n.fibra * fator,
  };
}

export default function RegistrarConsumo({
  refeicao,
  rotulo,
  buscaInicial,
  recipes,
  agendadas,
  historico,
  pratos = [],
  onRegistrar,
  onFechar,
}: {
  refeicao: Refeicao;
  /** Rótulo já resolvido (as refeições personalizadas não estão na lista fixa). */
  rotulo?: string;
  /** Texto vindo da barra de adição rápida: abre direto na busca, já filtrada. */
  buscaInicial?: string;
  recipes: Recipe[];
  /** Receitas que o plano marcou para esta refeição neste dia. */
  agendadas: Recipe[];
  /** Consumo já registrado (qualquer dia), para montar a aba Recentes. */
  historico: RegistroConsumo[];
  /** Pratos fora do acervo (estimados pela IA), achados pela busca. */
  pratos?: PratoSalvo[];
  onRegistrar: (dados: { nome: string; recipeId?: string; porcoes: number; nutrientes: Nutrientes100g }) => void;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<Aba>(
    buscaInicial ? 'buscar' : agendadas.length > 0 ? 'agendado' : 'recentes',
  );
  const [busca, setBusca] = useState(buscaInicial ?? '');
  const [porcoes, setPorcoes] = useState(1);
  const iaConfigurada = useIAConfigurada();
  const evitar = useAvisosNexo();
  const [estimando, setEstimando] = useState(false);
  const [estimado, setEstimado] = useState<PratoEstimado | null>(null);

  const recentes = useMemo(() => ultimosRegistros(historico), [historico]);
  const favoritos = useMemo(() => recipes.filter((r) => r.favorito), [recipes]);
  const encontradas = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return recipes.slice(0, 20);
    return recipes.filter((r) => r.titulo.toLowerCase().includes(alvo)).slice(0, 20);
  }, [recipes, busca]);
  const pratosEncontrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return [];
    return pratos.filter((p) => p.nome.toLowerCase().includes(alvo)).slice(0, 10);
  }, [pratos, busca]);

  // O que a busca não acha no acervo, a IA estima (Haiku) e o app guarda como prato.
  async function estimar() {
    const texto = busca.trim();
    if (!texto) return;
    setEstimando(true);
    try {
      setEstimado(await estimarPrato(texto));
    } catch (e) {
      toast(mensagemErroIA(e), 'erro');
    } finally {
      setEstimando(false);
    }
  }

  async function registrarEstimado(p: PratoEstimado) {
    const { nome, porcao, gramas, ingredientes, ...n } = p;
    const nutrientes: Nutrientes100g = {
      kcal: n.kcal,
      gorduraTotal: n.gorduraTotal,
      gorduraSaturada: n.gorduraSaturada,
      colesterolMg: n.colesterolMg,
      carboidrato: n.carboidrato,
      acucares: n.acucares,
      proteina: n.proteina,
      fibra: n.fibra,
    };
    await salvarPrato({ nome, porcao, gramas, ingredientes, nutrientes, origem: 'ia' });
    onRegistrar({ nome, porcoes, nutrientes: multiplicar(nutrientes, porcoes) });
  }

  function registrarReceita(r: Recipe) {
    const porPorcao = nutrientesPorPorcao(r);
    onRegistrar({ nome: r.titulo, recipeId: r.id, porcoes, nutrientes: multiplicar(porPorcao, porcoes) });
  }

  function repetirRegistro(reg: RegistroConsumo) {
    const porPorcaoDoRegistro = multiplicar(reg.nutrientes, 1 / (reg.porcoes || 1));
    onRegistrar({
      nome: reg.nome,
      ...(reg.recipeId ? { recipeId: reg.recipeId } : {}),
      porcoes,
      nutrientes: multiplicar(porPorcaoDoRegistro, porcoes),
    });
  }

  const lista: { chave: string; titulo: string; kcal: number; nutri?: Nutrientes100g; alertas?: AvisoNexo[]; acao: () => void }[] =
    aba === 'recentes'
      ? recentes.map((r) => ({
          chave: r.id,
          titulo: r.nome,
          kcal: r.nutrientes.kcal / (r.porcoes || 1),
          acao: () => repetirRegistro(r),
        }))
      : [
        ...(aba === 'buscar'
          ? pratosEncontrados.map((p) => ({
              chave: p.id,
              titulo: p.nome,
              kcal: p.nutrientes.kcal,
              alertas: avisosDosIngredientes([p.nome, ...p.ingredientes], evitar),
              acao: () => onRegistrar({ nome: p.nome, porcoes, nutrientes: multiplicar(p.nutrientes, porcoes) }),
            }))
          : []),
        ...(aba === 'agendado' ? agendadas : aba === 'favoritos' ? favoritos : encontradas).map((r) => {
          const n = nutrientesPorPorcao(r);
          // O selo lê valores por 100 g (é a base dos limites); o kcal da linha é o da porção.
          return {
            chave: r.id,
            titulo: r.titulo,
            kcal: n.kcal,
            nutri: nutrientesPor100g(r.ingredientes),
            alertas: avisosDosIngredientes(r.ingredientes.map((i) => i.item), evitar),
            acao: () => registrarReceita(r),
          };
        }),
      ];

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h3 className="section-heading flex-1 text-sm">Registrar · {rotulo ?? rotuloRefeicao(refeicao)}</h3>
          <label className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
            porções
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={porcoes}
              onChange={(e) => setPorcoes(Math.max(0.25, Number(e.target.value) || 1))}
              className="input w-16 py-1 text-center text-sm"
            />
          </label>
          <button onClick={onFechar} aria-label="Fechar" className="btn-icon p-2">
            <XMarkIcon className="size-4" />
          </button>
        </div>

        <div className="mx-4 flex gap-0.5 rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-700">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              onClick={() => setAba(a.chave)}
              className={`flex-1 rounded-md px-2 py-1 font-semibold ${
                aba === a.chave ? 'bg-white shadow-sm dark:bg-stone-800' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'buscar' && (
          <div className="relative mx-4 mt-3">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Receita, comida ou marca"
              className="input pl-9"
            />
          </div>
        )}

        {aba === 'buscar' && busca.trim() && (
          <div className="mx-4 mt-2 text-xs">
            {estimado ? (
              <div className="space-y-2 rounded-lg bg-stone-100 p-3 dark:bg-stone-700">
                <p className="text-sm font-semibold">{capitalizar(estimado.nome)}</p>
                <p className="text-stone-500 dark:text-stone-400">
                  {estimado.porcao} · {Math.round(estimado.kcal * porcoes)} kcal · P {Math.round(estimado.proteina * porcoes)} g · C{' '}
                  {Math.round(estimado.carboidrato * porcoes)} g · G {Math.round(estimado.gorduraTotal * porcoes)} g
                </p>
                <p className="text-stone-400 dark:text-stone-500">Estimativa da IA — fica salva para as próximas buscas.</p>
                <div className="flex gap-2">
                  <button onClick={() => registrarEstimado(estimado)} className="btn-primary flex-1 py-1.5 text-sm">
                    Registrar
                  </button>
                  <button onClick={() => setEstimado(null)} className="btn-outline py-1.5 text-sm">
                    Descartar
                  </button>
                </div>
              </div>
            ) : iaConfigurada ? (
              <button
                onClick={estimar}
                disabled={estimando}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-left text-stone-600 disabled:opacity-60 dark:border-stone-600 dark:text-stone-300"
              >
                <SparklesIcon className="size-4 flex-shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1 truncate">
                  {estimando ? 'Estimando…' : `Estimar “${busca.trim()}” com IA`}
                </span>
              </button>
            ) : (
              <p className="text-stone-400 dark:text-stone-500">
                Não achou? Cadastre a chave da IA em Configurações para estimar pratos novos.
              </p>
            )}
          </div>
        )}

        <ul className="mt-2 flex-1 divide-y divide-stone-100 overflow-y-auto px-4 pb-4 dark:divide-stone-700">
          {lista.length === 0 && (
            <li className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">
              {aba === 'agendado'
                ? 'Nada agendado para esta refeição neste dia.'
                : aba === 'recentes'
                  ? 'Nada registrado ainda — os primeiros registros aparecem aqui.'
                  : 'Nenhuma receita encontrada.'}
            </li>
          )}
          {lista.map((l) => (
            <li key={l.chave} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{capitalizar(l.titulo)}</p>
                <p className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <span className="tabular-nums">≈ {Math.round(l.kcal * porcoes).toLocaleString('pt-BR')} kcal</span>
                  {l.nutri && <SelosQualidade nutri={l.nutri} compacto />}
                </p>
                {l.alertas && l.alertas.length > 0 && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Nexo: tem {l.alertas.map((a) => `${a.termo} (${a.motivo})`).join(', ')}
                  </p>
                )}
              </div>
              <button onClick={l.acao} aria-label={`Registrar ${l.titulo}`} className="btn-icon flex-shrink-0 p-2">
                <PlusIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
