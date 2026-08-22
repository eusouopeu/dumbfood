// Lista de mercado: o que comprar, quanto deve custar e o registro da compra.
// Todo o cálculo (agregação, embalagens, geladeira, preços) está em lib/useListaCompras.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShareIcon,
  ShoppingCartIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { estiloGondola } from '../lib/aisles';
import { resumoLinha } from '../lib/shoppingList';
import { useListaCompras, type LinhaLista } from '../lib/useListaCompras';
import { useArredondarEmbalagem, useDescontarGeladeira } from '../lib/preferencias';
import { nomeItem } from '../lib/format';
import { pesoEmGramas } from '../lib/weight';
import { parseIngredient } from '../lib/ingredientParser';
import { formatBRL } from '../lib/prices';
import {
  salvarCompra,
  novoId,
  adicionarVariosNaGeladeira,
  atualizarListaEstado,
  type EntradaGeladeira,
} from '../db/repo';
import { confirmar } from '../lib/confirm';
import { useDieta } from '../lib/diet';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import { definirPendentesLista } from '../lib/listaStatus';
import SwipeActions from '../components/SwipeActions';
import { LinhaSkeleton } from '../components/Skeleton';
import EscanearNota from '../components/EscanearNota';
import EditarPrecos from '../components/EditarPrecos';
import OrcamentoCard from '../components/lista/OrcamentoCard';
import ComparativoMercados from '../components/lista/ComparativoMercados';
import FinalizarCompra from '../components/lista/FinalizarCompra';
import type { CompraItem } from '../types';

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

export default function ListaMercado() {
  const [descontarGeladeira] = useDescontarGeladeira();
  const [arredondarEmbalagem] = useArredondarEmbalagem();
  const lista = useListaCompras(descontarGeladeira, arredondarEmbalagem);
  const { estado, secoes, jaTenho, custoPorLinha, total, valorEstimadoTotal } = lista;

  const [dieta, setDieta] = useDieta();
  const [editandoQtd, setEditandoQtd] = useState<string | null>(null);
  const [qtdTexto, setQtdTexto] = useState('');
  const [novoExtraTexto, setNovoExtraTexto] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [editandoPrecos, setEditandoPrecos] = useState(false);

  const comprados = new Set(estado.comprados);

  // Publica quantos itens ainda faltam marcar, para o badge da barra de navegação.
  useEffect(() => {
    const marcados = secoes.reduce((n, s) => n + s.linhas.filter((l) => comprados.has(l.id)).length, 0);
    definirPendentesLista(total - marcados);
    return () => definirPendentesLista(0);
  }, [secoes, estado.comprados, total]);

  if (lista.carregando) return <ListaSkeleton />;

  const todosIds = secoes.flatMap((s) => s.linhas.map((l) => l.id));
  const todosMarcados = todosIds.length > 0 && todosIds.every((id) => comprados.has(id));
  const marcados = todosIds.filter((id) => comprados.has(id)).length;

  function alternarComprado(id: string) {
    hapticLeve();
    atualizarListaEstado((atual) => ({
      comprados: atual.comprados.includes(id)
        ? atual.comprados.filter((x) => x !== id)
        : [...atual.comprados, id],
    }));
  }

  function alternarTodos() {
    hapticLeve();
    atualizarListaEstado({ comprados: todosMarcados ? [] : todosIds });
  }

  function iniciarEdicaoQtd(l: LinhaLista) {
    setEditandoQtd(l.id);
    setQtdTexto(l.rotulo);
  }

  function salvarQtd(l: LinhaLista) {
    const texto = qtdTexto.trim();
    if (!texto) {
      atualizarListaEstado((atual) => {
        const { [l.id]: _removido, ...resto } = atual.overrides;
        return { overrides: resto };
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
    atualizarListaEstado((atual) => ({
      overrides: { ...atual.overrides, [l.id]: { quantidade: parsed.quantidade, unidade: parsed.unidade } },
    }));
    setEditandoQtd(null);
    hapticLeve();
  }

  function adicionarExtra() {
    const texto = novoExtraTexto.trim();
    if (!texto) return;
    const ing = parseIngredient(texto);
    atualizarListaEstado((atual) => ({ extras: [...atual.extras, { ...ing, id: novoId() }] }));
    setNovoExtraTexto('');
  }

  /**
   * Remover pelo arraste: item manual some de vez; item vindo de receita fica escondido
   * só nesta lista (a receita continua no plano, então apagá-lo de verdade não faria
   * sentido — ele voltaria na próxima recalculada).
   */
  function removerLinha(l: LinhaLista) {
    const desfazer = { extras: estado.extras, ocultos: estado.ocultos };
    if (l.manual) {
      const id = l.id.replace('extra:', '');
      atualizarListaEstado((atual) => ({ extras: atual.extras.filter((e) => e.id !== id) }));
    } else {
      atualizarListaEstado((atual) => ({ ocultos: [...atual.ocultos, l.id] }));
    }
    hapticLeve();
    toast(`${nomeItem(l.item)} removido da lista.`, 'sucesso', {
      rotulo: 'Desfazer',
      onClick: () => atualizarListaEstado(desfazer),
    });
  }

  async function copiar() {
    const texto = secoes
      .map((s) => `## ${s.gondola}\n` + s.linhas.map((l) => `- ${l.rotulo} ${nomeItem(l.item)}`).join('\n'))
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
  async function compartilharWhatsApp() {
    const linhas = secoes.map(
      (s) =>
        `*${s.gondola}*\n` +
        s.linhas.map((l) => `${comprados.has(l.id) ? '☑' : '☐'} ${l.rotulo} ${nomeItem(l.item)}`).join('\n'),
    );
    const texto = `*Lista de mercado*\n\n${linhas.join('\n\n')}`;
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

  async function salvarNoHistorico(valorInformado: number | null, mercado: string) {
    const itens: CompraItem[] = [];
    // O que sobra das embalagens compradas (1 kg para uma receita de 700 g) vai para a
    // geladeira junto com o item, para a lista da semana que vem já descontar a sobra.
    const paraGeladeira: EntradaGeladeira[] = [];
    let valorTotalEstimado = 0;
    for (const s of secoes) {
      for (const l of s.linhas) {
        if (!comprados.has(l.id)) continue;
        const { gramas, unidades } = resumoLinha(l);
        const quantidadeG = gramas ?? (unidades !== null ? pesoEmGramas(l.item, unidades, null) : null);
        const custo = custoPorLinha.get(l.id)?.valor ?? null;
        if (custo !== null) valorTotalEstimado += custo;
        itens.push({ item: l.item, gondola: s.gondola, quantidadeG, quantidadeUnidades: unidades, precoEstimado: custo });
        const sobra = l.sobras[0];
        paraGeladeira.push(
          sobra ? { nome: l.item, quantidade: sobra.quantidade, unidade: sobra.unidade } : { nome: l.item },
        );
      }
    }
    if (itens.length === 0) {
      toast('Marque ao menos um item da checklist antes de salvar.', 'erro');
      return;
    }
    await salvarCompra({
      data: Date.now(),
      mercado: mercado || undefined,
      valorTotalReal: valorInformado ?? valorTotalEstimado,
      valorTotalEstimado: Math.round(valorTotalEstimado * 100) / 100,
      itens,
    });
    toast('Compra salva no histórico!');

    // O que acabou de ser comprado está, por definição, na despensa: fecha o ciclo
    // mercado -> geladeira sem obrigar o usuário a redigitar item por item.
    const comSobra = paraGeladeira.filter((i) => i.quantidade != null).length;
    const ok = await confirmar(
      comSobra > 0
        ? `Adicionar os ${itens.length} itens comprados à geladeira? (${comSobra} com a sobra da embalagem)`
        : `Adicionar os ${itens.length} itens comprados à geladeira?`,
      { textoConfirmar: 'Adicionar' },
    );
    if (!ok) return;
    const novos = await adicionarVariosNaGeladeira(paraGeladeira);
    hapticLeve();
    toast(
      novos === 0
        ? 'Todos os itens já estavam na geladeira.'
        : `${novos} ${novos === 1 ? 'item adicionado' : 'itens adicionados'} à geladeira.`,
    );
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
        <MacroResumoCard titulo="" real={lista.nutriTotal} dieta={dieta} />
      </div>

      <OrcamentoCard valorEstimado={valorEstimadoTotal} />

      <ComparativoMercados comparacao={lista.comparacao} />

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
        <button onClick={() => setEscaneando(true)} aria-label="Importar nota fiscal" title="Importar nota fiscal" className="btn-icon">
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
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Arraste um item para a direita para editar a quantidade, ou para a esquerda para removê-lo.
          </p>

          {secoes.map((s) => {
            const estilo = estiloGondola(s.gondola);
            return (
              <div key={s.gondola} className={`card overflow-hidden border-2 ${estilo.borda}`}>
                <div className={`px-4 py-2 text-sm font-bold ${estilo.header}`}>{s.gondola}</div>
                <ul>
                  {s.linhas.map((l) => {
                    const isChecked = comprados.has(l.id);
                    const custo = custoPorLinha.get(l.id);
                    return (
                      <SwipeActions key={l.id} onRemover={() => removerLinha(l)} onEditar={() => iniciarEdicaoQtd(l)}>
                        <li className="flex items-center gap-3 border-t border-stone-100 bg-white px-4 py-2.5 dark:border-stone-700 dark:bg-stone-800">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-brand-500"
                            checked={isChecked}
                            onChange={() => alternarComprado(l.id)}
                            aria-label={`Marcar ${nomeItem(l.item)} como comprado`}
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
                              onClick={() => alternarComprado(l.id)}
                              className={`min-w-0 flex-1 text-left ${
                                isChecked
                                  ? 'text-stone-400 line-through dark:text-stone-500'
                                  : l.manual
                                    ? 'text-stone-400 dark:text-stone-500'
                                    : ''
                              }`}
                            >
                              <span className="font-semibold">{l.rotulo}</span> <span>{nomeItem(l.item)}</span>
                              {l.origens.length > 1 && (
                                <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">({l.origens.length} receitas)</span>
                              )}
                            </button>
                          )}
                          {editandoQtd !== l.id && (
                            /* Preço vindo da tabela embutida fica em itálico e mais claro,
                               para não passar por valor conferido em nota fiscal. */
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
                              {custo?.foraDoPadrao === 'alto' && (
                                <ExclamationTriangleIcon
                                  className="size-3.5 flex-shrink-0 text-amber-500"
                                  aria-label="Preço bem acima da mediana histórica deste item"
                                />
                              )}
                              {custo?.valor != null ? formatBRL(custo.valor) : '—'}
                            </div>
                          )}
                        </li>
                      </SwipeActions>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {jaTenho.length > 0 && (
            <div className="card space-y-2 p-4">
              <div className="flex items-center gap-2">
                <CubeIcon className="size-4 text-brand-500" />
                <h3 className="section-heading text-sm">Você já tem ({jaTenho.length})</h3>
              </div>
              <ul className="space-y-1 text-sm text-stone-500 dark:text-stone-400">
                {jaTenho.map((l) => (
                  <li key={l.id} className="flex gap-2">
                    <span className="font-semibold">{l.rotulo}</span>
                    <span className="min-w-0 flex-1 truncate">{nomeItem(l.item)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Fora da lista e das somas porque está na geladeira.
              </p>
            </div>
          )}

          <FinalizarCompra
            total={total}
            marcados={marcados}
            pesoTotal={lista.pesoTotal}
            valorEstimado={valorEstimadoTotal}
            mercadosConhecidos={lista.mercadosConhecidos}
            onSalvar={salvarNoHistorico}
          />
        </>
      )}

      {escaneando && <EscanearNota onClose={() => setEscaneando(false)} />}
      {editandoPrecos && (
        <EditarPrecos itens={lista.itensParaPrecos} precos={lista.listaPrecos} onClose={() => setEditandoPrecos(false)} />
      )}
    </div>
  );
}
