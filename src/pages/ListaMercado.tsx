import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  ShoppingCartIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { buildShoppingList, resumoLinha, pesoTotalKg } from '../lib/shoppingList';
import { estiloGondola, GONDOLA_ORDER } from '../lib/aisles';
import { tendenciaPrecoItem } from '../lib/history';
import { nomeItem } from '../lib/format';
import { pesoEmGramas } from '../lib/weight';
import { parseIngredient, normalizeItemKey } from '../lib/ingredientParser';
import { padronizarMedida } from '../lib/measures';
import { formatQtdUnidade } from '../lib/displayQty';
import { calcularNutricaoTotal } from '../lib/nutrition';
import { custoLinha, buscarPreco, formatBRL } from '../lib/prices';
import { PRECOS_BASE } from '../lib/precosBase';
import { salvarCompra, novoId } from '../db/repo';
import { useDieta } from '../lib/diet';
import { useOrcamento, statusOrcamento } from '../lib/orcamento';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { definirPendentesLista } from '../lib/listaStatus';
import SwipeToDelete from '../components/SwipeToDelete';
import { LinhaSkeleton } from '../components/Skeleton';
import EscanearNota from '../components/EscanearNota';
import EditarPrecos from '../components/EditarPrecos';
import type { CompraItem, Ingredient, Recipe, ShoppingLine, ShoppingSection } from '../types';

function ListaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Lista de mercado</h2>
      </div>
      <LinhaSkeleton linhas={6} />
    </div>
  );
}

const CHECK_KEY = 'dumbfood:comprados';
const EXTRAS_KEY = 'dumbfood:itensExtras';

interface ItemExtra extends Ingredient {
  id: string;
}

interface LinhaLista {
  id: string;
  item: string;
  gondola: string;
  quantidades: ShoppingLine['quantidades'];
  rotulo: string;
  origens: string[];
  manual: boolean;
}

function loadChecked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function loadExtras(): ItemExtra[] {
  try {
    return JSON.parse(localStorage.getItem(EXTRAS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

const QTD_OVERRIDE_KEY = 'dumbfood:itensQtd';

interface QtdOverride {
  quantidade: number | null;
  unidade: string | null;
}

function loadOverrides(): Record<string, QtdOverride> {
  try {
    return JSON.parse(localStorage.getItem(QTD_OVERRIDE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function ListaMercado() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
  const compras = useLiveQuery(() => db.compras.toArray(), []);
  const plano = usePlano();
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked());
  const [extras, setExtras] = useState<ItemExtra[]>(() => loadExtras());
  const [overrides, setOverrides] = useState<Record<string, QtdOverride>>(() => loadOverrides());
  const [editandoQtd, setEditandoQtd] = useState<string | null>(null);
  const [qtdTexto, setQtdTexto] = useState('');
  const [novoExtraTexto, setNovoExtraTexto] = useState('');
  const [valorReal, setValorReal] = useState('');
  const [dieta, setDieta] = useDieta();
  const [orcamento, setOrcamento] = useOrcamento();
  const [orcamentoTexto, setOrcamentoTexto] = useState('');
  const [editandoOrcamento, setEditandoOrcamento] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [editandoPrecos, setEditandoPrecos] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHECK_KEY, JSON.stringify(Array.from(checked)));
  }, [checked]);
  useEffect(() => {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  }, [extras]);
  useEffect(() => {
    localStorage.setItem(QTD_OVERRIDE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const sections = useMemo(() => {
    if (!recipes) return [] as ShoppingSection[];
    const map = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
    return buildShoppingList(plano, map);
  }, [recipes, plano]);

  // Junta as linhas geradas pelas receitas com os itens adicionados manualmente,
  // agrupados por gôndola na mesma ordem. Itens manuais recebem um id próprio
  // (não somam com itens de receita) e ficam marcados para o estilo mais claro.
  // Aplica correções manuais de quantidade (definidas pelo usuário ao editar um item
  // já criado), sobrepondo o valor calculado a partir das receitas/itens manuais.
  const sectionsComExtras = useMemo(() => {
    const aplicarOverride = (l: LinhaLista): LinhaLista => {
      const ov = overrides[l.id];
      if (!ov) return l;
      return {
        ...l,
        quantidades: [{ unidade: ov.unidade, quantidade: ov.quantidade }],
        rotulo: formatQtdUnidade(ov.quantidade, ov.unidade),
      };
    };
    const porGondola = new Map<string, LinhaLista[]>();
    for (const s of sections) {
      porGondola.set(
        s.gondola,
        s.linhas.map((l) => aplicarOverride({ ...l, id: `${s.gondola}:${l.item}`, manual: false })),
      );
    }
    for (const ex of extras) {
      const med = padronizarMedida(ex.item, ex.quantidade, ex.unidade, 'metrico');
      const linha: LinhaLista = {
        id: `extra:${ex.id}`,
        item: ex.item,
        gondola: ex.gondola,
        quantidades: [{ unidade: med.unidade, quantidade: med.quantidade }],
        rotulo: formatQtdUnidade(med.quantidade, med.unidade),
        origens: [],
        manual: true,
      };
      const arr = porGondola.get(ex.gondola) ?? [];
      arr.push(aplicarOverride(linha));
      porGondola.set(ex.gondola, arr);
    }
    return GONDOLA_ORDER.filter((g) => porGondola.has(g)).map((g) => ({ gondola: g, linhas: porGondola.get(g)! }));
  }, [sections, extras, overrides]);

  // Os preços importados pelo usuário vêm primeiro: `buscarPreco` usa o primeiro que casar,
  // então a tabela embutida só entra onde ele ainda não tem nota fiscal.
  const listaPrecos = useMemo(() => [...(precos ?? []), ...PRECOS_BASE], [precos]);

  const custoPorLinha = useMemo(() => {
    const m = new Map<string, { valor: number | null; estimado: boolean; tendencia: 'alta' | 'baixa' | null }>();
    for (const s of sectionsComExtras) {
      for (const l of s.linhas) {
        const fonte = buscarPreco(normalizeItemKey(l.item), listaPrecos);
        m.set(l.id, {
          valor: custoLinha(l, listaPrecos),
          estimado: fonte?.estimado === true,
          tendencia: tendenciaPrecoItem(l.item, compras ?? []),
        });
      }
    }
    return m;
  }, [sectionsComExtras, listaPrecos, compras]);

  // Itens distintos da lista atual (por chave normalizada), para o editor manual de preços.
  const itensParaPrecos = useMemo(() => {
    const vistos = new Set<string>();
    const nomes: string[] = [];
    for (const s of sectionsComExtras) {
      for (const l of s.linhas) {
        const key = normalizeItemKey(l.item);
        if (vistos.has(key)) continue;
        vistos.add(key);
        nomes.push(l.item);
      }
    }
    return nomes;
  }, [sectionsComExtras]);

  const nutriTotal = useMemo(() => {
    const pseudo: Ingredient[] = sectionsComExtras
      .flatMap((s) => s.linhas)
      .flatMap((l) => l.quantidades.map((q) => ({ raw: '', item: l.item, quantidade: q.quantidade, unidade: q.unidade, gondola: l.gondola })));
    return calcularNutricaoTotal(pseudo);
  }, [sectionsComExtras]);

  // Publica quantos itens ainda faltam marcar, para o badge da barra de navegação.
  useEffect(() => {
    const total = sectionsComExtras.reduce((n, s) => n + s.linhas.length, 0);
    const marcados = sectionsComExtras.reduce((n, s) => n + s.linhas.filter((l) => checked.has(l.id)).length, 0);
    definirPendentesLista(total - marcados);
    return () => definirPendentesLista(0);
  }, [sectionsComExtras, checked]);

  if (!recipes) return <ListaSkeleton />;

  const total = sectionsComExtras.reduce((n, s) => n + s.linhas.length, 0);
  const todosIds = sectionsComExtras.flatMap((s) => s.linhas.map((l) => l.id));
  const todosMarcados = todosIds.length > 0 && todosIds.every((id) => checked.has(id));
  const pesoTotal = pesoTotalKg(sectionsComExtras);
  const valorEstimadoTotal = Array.from(custoPorLinha.values()).reduce((s, v) => s + (v.valor ?? 0), 0);
  const statusOrc = orcamento !== null ? statusOrcamento(valorEstimadoTotal, orcamento) : null;

  function definirOrcamento() {
    const n = Number(orcamentoTexto.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      toast('Informe um valor válido.', 'erro');
      return;
    }
    setOrcamento(n);
    setOrcamentoTexto('');
    setEditandoOrcamento(false);
  }

  function toggle(key: string) {
    hapticLeve();
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Toggle: marca todos os itens da lista de uma vez, ou desmarca todos se já estiverem todos marcados.
  function alternarTodos() {
    hapticLeve();
    const todosIds = sectionsComExtras.flatMap((s) => s.linhas.map((l) => l.id));
    const todosMarcados = todosIds.length > 0 && todosIds.every((id) => checked.has(id));
    setChecked(todosMarcados ? new Set() : new Set(todosIds));
  }

  function iniciarEdicaoQtd(l: LinhaLista) {
    setEditandoQtd(l.id);
    setQtdTexto(l.rotulo);
  }

  function salvarQtd(l: LinhaLista) {
    const texto = qtdTexto.trim();
    if (!texto) {
      setOverrides((prev) => {
        const { [l.id]: _removido, ...resto } = prev;
        return resto;
      });
      setEditandoQtd(null);
      hapticLeve();
      return;
    }
    const parsed = parseIngredient(`${texto} de ${l.item}`);
    if (parsed.quantidade === null) {
      toast('Não entendi essa quantidade.', 'erro');
      return;
    }
    setOverrides((prev) => ({ ...prev, [l.id]: { quantidade: parsed.quantidade, unidade: parsed.unidade } }));
    setEditandoQtd(null);
    hapticLeve();
  }

  function adicionarExtra() {
    const texto = novoExtraTexto.trim();
    if (!texto) return;
    const ing = parseIngredient(texto);
    setExtras((prev) => [...prev, { ...ing, id: novoId() }]);
    setNovoExtraTexto('');
  }

  function removerExtra(id: string) {
    const removido = extras.find((e) => e.id === id);
    setExtras((prev) => prev.filter((e) => e.id !== id));
    hapticLeve();
    if (removido) {
      toast(`${nomeItem(removido.item)} removido.`, 'sucesso', {
        rotulo: 'Desfazer',
        onClick: () => setExtras((prev) => [...prev, removido]),
      });
    }
  }

  async function copiar() {
    const texto = sectionsComExtras
      .map(
        (s) =>
          `## ${s.gondola}\n` +
          s.linhas.map((l) => `- ${l.rotulo} ${nomeItem(l.item)}`).join('\n'),
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(texto);
      toast('Lista copiada!');
    } catch {
      toast('Não foi possível copiar.', 'erro');
    }
  }

  // Texto simples (sem markdown) para WhatsApp: *negrito* nos títulos de gôndola,
  // checkbox como ☐/☑ pra dar pra ler numa conversa sem nenhuma formatação especial.
  function textoParaCompartilhar(): string {
    const linhas = sectionsComExtras.map(
      (s) =>
        `*${s.gondola}*\n` +
        s.linhas.map((l) => `${checked.has(l.id) ? '☑' : '☐'} ${l.rotulo} ${nomeItem(l.item)}`).join('\n'),
    );
    return `*Lista de mercado*\n\n${linhas.join('\n\n')}`;
  }

  async function compartilharWhatsApp() {
    const texto = textoParaCompartilhar();
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        // Usuário cancelou o share nativo — nada a fazer.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }

  async function salvarNoHistorico() {
    const itens: CompraItem[] = [];
    let valorTotalEstimado = 0;
    for (const s of sectionsComExtras) {
      for (const l of s.linhas) {
        if (!checked.has(l.id)) continue;
        const { gramas, unidades } = resumoLinha(l);
        const quantidadeG = gramas ?? (unidades !== null ? pesoEmGramas(l.item, unidades, null) : null);
        const custo = custoPorLinha.get(l.id)?.valor ?? null;
        if (custo !== null) valorTotalEstimado += custo;
        itens.push({ item: l.item, gondola: s.gondola, quantidadeG, quantidadeUnidades: unidades, precoEstimado: custo });
      }
    }
    if (itens.length === 0) {
      toast('Marque ao menos um item da checklist antes de salvar.', 'erro');
      return;
    }
    const valorInformado = Number(valorReal.replace(',', '.'));
    const valorTotalReal = Number.isFinite(valorInformado) && valorInformado > 0 ? valorInformado : valorTotalEstimado;
    await salvarCompra({ data: Date.now(), valorTotalReal, valorTotalEstimado: Math.round(valorTotalEstimado * 100) / 100, itens });
    toast('Compra salva no histórico!');
    setValorReal('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Lista de mercado</h2>
        <span className="chip">{total} itens</span>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="section-heading text-sm">Macros da lista</h3>
          <SeletorDieta dieta={dieta} onChange={setDieta} />
        </div>
        <MacroResumoCard titulo="" real={nutriTotal} dieta={dieta} />
      </div>

      <div className="card space-y-2 p-4">
        <div className="relative pr-8">
          <h3 className="section-heading text-sm">Orçamento da semana</h3>
          {orcamento !== null && !editandoOrcamento && (
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-1">
              <button
                onClick={() => {
                  setOrcamentoTexto(String(orcamento));
                  setEditandoOrcamento(true);
                }}
                aria-label="Editar orçamento"
                className="rounded-full p-1 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-stone-800"
              >
                <PencilIcon className="size-4" />
              </button>
              <button
                onClick={() => setOrcamento(null)}
                aria-label="Remover orçamento"
                className="rounded-full p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-stone-800"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          )}
        </div>

        {orcamento === null || editandoOrcamento ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              definirOrcamento();
            }}
          >
            <input
              type="text"
              inputMode="decimal"
              className="input"
              placeholder="Ex.: 250 (R$)"
              value={orcamentoTexto}
              onChange={(e) => setOrcamentoTexto(e.target.value)}
              autoFocus={editandoOrcamento}
            />
            <button type="submit" className="btn-outline flex-shrink-0">
              Definir
            </button>
          </form>
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${Math.min(100, Math.round((valorEstimadoTotal / orcamento) * 100))}%` }}
              />
            </div>
            <p
              className={`text-sm ${
                statusOrc === 'estourado'
                  ? 'font-semibold text-red-600 dark:text-red-400'
                  : statusOrc === 'perto'
                    ? 'font-semibold text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {formatBRL(valorEstimadoTotal)} de {formatBRL(orcamento)} ({Math.round((valorEstimadoTotal / orcamento) * 100)}%)
              {statusOrc === 'estourado' && ' — orçamento estourado'}
              {statusOrc === 'perto' && ' — perto do limite'}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={copiar} aria-label="Copiar lista" title="Copiar" className="btn-icon">
          <ClipboardDocumentIcon className="size-4" />
        </button>
        <button onClick={compartilharWhatsApp} aria-label="Compartilhar no WhatsApp" title="WhatsApp" className="btn-icon">
          <ShareIcon className="size-4" />
        </button>
        <button onClick={() => setEditandoPrecos(true)} aria-label="Atualizar preços" title="Atualizar preços" className="btn-icon">
          <BanknotesIcon className="size-4" />
        </button>
        <button onClick={() => setEscaneando(true)} aria-label="Escanear nota" title="Escanear nota" className="btn-icon">
          <CameraIcon className="size-4" />
        </button>
        {total > 0 && (
          <button
            onClick={alternarTodos}
            aria-label={todosMarcados ? 'Desmarcar tudo' : 'Marcar tudo'}
            title={todosMarcados ? 'Desmarcar tudo' : 'Marcar tudo'}
            className="btn-icon"
          >
            {todosMarcados ? <XCircleIcon className="size-4" /> : <CheckCircleIcon className="size-4" />}
          </button>
        )}
      </div>

      <div className="card flex gap-2 p-3">
        <input
          className="input"
          placeholder='Adicionar item (ex.: "2 kg de arroz")'
          value={novoExtraTexto}
          onChange={(e) => setNovoExtraTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionarExtra()}
        />
        <button onClick={adicionarExtra} aria-label="Adicionar item" title="Adicionar" className="btn-icon flex-shrink-0">
          <PlusIcon className="size-4" />
        </button>
      </div>

      {total === 0 ? (
        <div className="card p-6 text-center">
          <ShoppingCartIcon className="mx-auto mb-1 size-10 text-brand-400 dark:text-brand-300" />
          <p className="font-semibold">Lista vazia</p>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Nenhuma receita na semana ainda, ou adicione itens manualmente acima.
          </p>
          <Link to="/plano" className="btn-primary">
            Selecionar receitas
          </Link>
        </div>
      ) : (
        <>
          {sectionsComExtras.map((s) => {
            const estilo = estiloGondola(s.gondola);
            return (
              <div key={s.gondola} className={`card overflow-hidden border-2 ${estilo.borda}`}>
                <div className={`px-4 py-2 text-sm font-bold ${estilo.header}`}>{s.gondola}</div>
                <ul>
                  {s.linhas.map((l) => {
                    const isChecked = checked.has(l.id);
                    const custo = custoPorLinha.get(l.id);
                    const linha = (
                      <li key={l.manual ? undefined : l.id} className="flex items-center gap-3 border-t border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-brand-500"
                          checked={isChecked}
                          onChange={() => toggle(l.id)}
                        />
                        {editandoQtd === l.id ? (
                          <form
                            className="flex min-w-0 flex-1 items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              salvarQtd(l);
                            }}
                          >
                            <input
                              autoFocus
                              className="input h-7 min-w-0 flex-1 py-0 text-xs"
                              value={qtdTexto}
                              onChange={(e) => setQtdTexto(e.target.value)}
                              placeholder="ex.: 500 g"
                            />
                            <button type="submit" aria-label="Salvar quantidade" className="flex-shrink-0 text-brand-600 dark:text-brand-400">
                              <CheckIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoQtd(null)}
                              aria-label="Cancelar edição"
                              className="flex-shrink-0 text-stone-400 dark:text-stone-500"
                            >
                              <XMarkIcon className="size-4" />
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoQtd(l)}
                            aria-label={`Editar quantidade de ${nomeItem(l.item)}`}
                            className={`min-w-0 flex-1 text-left ${
                              isChecked ? 'text-stone-400 dark:text-stone-500 line-through' : l.manual ? 'text-stone-400 dark:text-stone-500' : ''
                            }`}
                          >
                            <span className="font-semibold">{l.rotulo}</span>{' '}
                            <span>{nomeItem(l.item)}</span>
                            {l.origens.length > 1 && (
                              <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">({l.origens.length} receitas)</span>
                            )}
                          </button>
                        )}
                        {editandoQtd !== l.id && (
                          <>
                            {/* Preço vindo da tabela embutida fica em itálico e mais claro,
                                para não passar por valor conferido em nota fiscal. */}
                            <div
                              className={`flex flex-shrink-0 items-center gap-1 text-right text-sm tabular-nums ${
                                custo?.estimado ? 'italic text-stone-400 dark:text-stone-500' : 'text-stone-500 dark:text-stone-400'
                              }`}
                              title={custo?.estimado ? 'Preço estimado pelo app' : undefined}
                            >
                              {custo?.tendencia === 'alta' && (
                                <ArrowTrendingUpIcon className="size-3.5 flex-shrink-0 text-red-500" aria-label="Preço subiu desde a última compra" />
                              )}
                              {custo?.tendencia === 'baixa' && (
                                <ArrowTrendingDownIcon className="size-3.5 flex-shrink-0 text-green-600" aria-label="Preço caiu desde a última compra" />
                              )}
                              {custo?.valor != null ? formatBRL(custo.valor) : '—'}
                            </div>
                            {l.manual && (
                              <button
                                onClick={() => removerExtra(l.id.replace('extra:', ''))}
                                className="flex-shrink-0 text-stone-400 dark:text-stone-500 hover:text-red-600"
                                aria-label={`remover ${l.item}`}
                              >
                                <XMarkIcon className="size-4" />
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    );
                    return l.manual ? (
                      <SwipeToDelete key={l.id} onDelete={() => removerExtra(l.id.replace('extra:', ''))}>
                        {linha}
                      </SwipeToDelete>
                    ) : (
                      linha
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {/* Resumo + salvar no histórico */}
          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-lg font-bold">{total}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">ingredientes</p>
              </div>
              <div>
                <p className="text-lg font-bold">{pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">peso total</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatBRL(valorEstimadoTotal)}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">valor estimado</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-stone-500 dark:text-stone-400">Valor real da compra (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input"
                  placeholder={valorEstimadoTotal.toFixed(2)}
                  value={valorReal}
                  onChange={(e) => setValorReal(e.target.value)}
                />
              </div>
              <button onClick={salvarNoHistorico} className="btn-primary">
                Salvar no histórico
              </button>
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Considera apenas os itens marcados na checklist ({checked.size} de {total}). Valores em
              itálico são estimativas do app; use “Atualizar preços” para valer os da sua nota fiscal.
            </p>
          </div>
        </>
      )}

      {escaneando && <EscanearNota onClose={() => setEscaneando(false)} />}
      {editandoPrecos && (
        <EditarPrecos itens={itensParaPrecos} precos={listaPrecos} onClose={() => setEditandoPrecos(false)} />
      )}
    </div>
  );
}
