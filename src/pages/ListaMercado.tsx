import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { usePlano } from '../db/usePlano';
import { buildShoppingList, resumoLinha, pesoTotalKg } from '../lib/shoppingList';
import { estiloGondola, GONDOLA_ORDER } from '../lib/aisles';
import { capitalizar } from '../lib/format';
import { pesoEmGramas } from '../lib/weight';
import { parseIngredient } from '../lib/ingredientParser';
import { padronizarMedida } from '../lib/measures';
import { formatQtdUnidade } from '../lib/displayQty';
import { calcularNutricaoTotal } from '../lib/nutrition';
import { parseArquivoPrecos, custoLinha, formatBRL } from '../lib/prices';
import { importarPrecos, salvarCompra, novoId } from '../db/repo';
import { useDieta, DIETAS } from '../lib/diet';
import { SeletorDieta, MacroResumoCard } from '../components/MacroResumo';
import type { CompraItem, Ingredient, Recipe, ShoppingLine, ShoppingSection } from '../types';

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

export default function ListaMercado() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const precos = useLiveQuery(() => db.precos.toArray(), []);
  const plano = usePlano();
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked());
  const [extras, setExtras] = useState<ItemExtra[]>(() => loadExtras());
  const [novoExtraTexto, setNovoExtraTexto] = useState('');
  const [valorReal, setValorReal] = useState('');
  const [dieta, setDieta] = useDieta();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(CHECK_KEY, JSON.stringify(Array.from(checked)));
  }, [checked]);
  useEffect(() => {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  }, [extras]);

  const sections = useMemo(() => {
    if (!recipes) return [] as ShoppingSection[];
    const map = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
    return buildShoppingList(plano, map);
  }, [recipes, plano]);

  // Junta as linhas geradas pelas receitas com os itens adicionados manualmente,
  // agrupados por gôndola na mesma ordem. Itens manuais recebem um id próprio
  // (não somam com itens de receita) e ficam marcados para o estilo mais claro.
  const sectionsComExtras = useMemo(() => {
    const porGondola = new Map<string, LinhaLista[]>();
    for (const s of sections) {
      porGondola.set(
        s.gondola,
        s.linhas.map((l) => ({ ...l, id: `${s.gondola}:${l.item}`, manual: false })),
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
      arr.push(linha);
      porGondola.set(ex.gondola, arr);
    }
    return GONDOLA_ORDER.filter((g) => porGondola.has(g)).map((g) => ({ gondola: g, linhas: porGondola.get(g)! }));
  }, [sections, extras]);

  const listaPrecos = precos ?? [];

  const custoPorLinha = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const s of sectionsComExtras) for (const l of s.linhas) m.set(l.id, custoLinha(l, listaPrecos));
    return m;
  }, [sectionsComExtras, listaPrecos]);

  const nutriTotal = useMemo(() => {
    const pseudo: Ingredient[] = sectionsComExtras
      .flatMap((s) => s.linhas)
      .flatMap((l) => l.quantidades.map((q) => ({ raw: '', item: l.item, quantidade: q.quantidade, unidade: q.unidade, gondola: l.gondola })));
    return calcularNutricaoTotal(pseudo);
  }, [sectionsComExtras]);

  if (!recipes) return <p className="text-stone-500">Carregando…</p>;

  const total = sectionsComExtras.reduce((n, s) => n + s.linhas.length, 0);
  const pesoTotal = pesoTotalKg(sectionsComExtras);
  const valorEstimadoTotal = Array.from(custoPorLinha.values()).reduce((s: number, v) => s + (v ?? 0), 0);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function adicionarExtra() {
    const texto = novoExtraTexto.trim();
    if (!texto) return;
    const ing = parseIngredient(texto);
    setExtras((prev) => [...prev, { ...ing, id: novoId() }]);
    setNovoExtraTexto('');
  }

  function removerExtra(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  async function copiar() {
    const texto = sectionsComExtras
      .map(
        (s) =>
          `## ${s.gondola}\n` +
          s.linhas.map((l) => `- ${l.rotulo} ${capitalizar(l.item)}`).join('\n'),
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(texto);
      alert('Lista copiada!');
    } catch {
      alert('Não foi possível copiar.');
    }
  }

  async function atualizarPrecos(file: File) {
    try {
      const conteudo = await file.text();
      const itens = parseArquivoPrecos(conteudo, file.name);
      if (itens.length === 0) {
        alert('Nenhum preço válido encontrado no arquivo.');
        return;
      }
      const n = await importarPrecos(itens);
      alert(`${n} preço(s) atualizado(s).`);
    } catch (e) {
      alert(`Erro ao importar preços: ${(e as Error).message}`);
    }
  }

  async function salvarNoHistorico() {
    const itens: CompraItem[] = [];
    let valorTotalEstimado = 0;
    for (const s of sectionsComExtras) {
      for (const l of s.linhas) {
        if (!checked.has(l.id)) continue;
        const { gramas, unidades } = resumoLinha(l);
        const quantidadeG = gramas ?? (unidades !== null ? pesoEmGramas(l.item, unidades, null) : null);
        const custo = custoPorLinha.get(l.id) ?? null;
        if (custo !== null) valorTotalEstimado += custo;
        itens.push({ item: l.item, gondola: s.gondola, quantidadeG, quantidadeUnidades: unidades, precoEstimado: custo });
      }
    }
    if (itens.length === 0) {
      alert('Marque ao menos um item da checklist antes de salvar.');
      return;
    }
    const valorInformado = Number(valorReal.replace(',', '.'));
    const valorTotalReal = Number.isFinite(valorInformado) && valorInformado > 0 ? valorInformado : valorTotalEstimado;
    await salvarCompra({ data: Date.now(), valorTotalReal, valorTotalEstimado: Math.round(valorTotalEstimado * 100) / 100, itens });
    alert('Compra salva no histórico!');
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
          <h3 className="text-sm font-semibold">Macros da lista</h3>
          <SeletorDieta dieta={dieta} onChange={setDieta} />
        </div>
        <MacroResumoCard titulo="" real={nutriTotal} ideal={DIETAS[dieta]} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={copiar} className="btn-outline">
          ⧉ Copiar
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-outline">
          💲 Atualizar preços
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,application/json,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && atualizarPrecos(e.target.files[0])}
        />
        {checked.size > 0 && (
          <button onClick={() => setChecked(new Set())} className="btn-outline">
            Desmarcar tudo
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
        <button onClick={adicionarExtra} className="btn-outline flex-shrink-0">
          + Adicionar
        </button>
      </div>

      {total === 0 ? (
        <div className="card p-6 text-center text-stone-500">
          Nenhuma receita na semana.{' '}
          <Link to="/plano" className="text-brand-600 underline">
            Selecionar receitas
          </Link>{' '}
          ou adicione itens manualmente acima.
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
                    const custo = custoPorLinha.get(l.id) ?? null;
                    return (
                      <li key={l.id} className="flex items-center gap-3 border-t border-stone-100 px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-brand-500"
                          checked={isChecked}
                          onChange={() => toggle(l.id)}
                        />
                        <div
                          className={`min-w-0 flex-1 ${
                            isChecked ? 'text-stone-400 line-through' : l.manual ? 'text-stone-400' : ''
                          }`}
                        >
                          <span className="font-semibold">{l.rotulo}</span>{' '}
                          <span>{capitalizar(l.item)}</span>
                          {l.origens.length > 1 && (
                            <span className="ml-1 text-xs text-stone-400">({l.origens.length} receitas)</span>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right text-sm tabular-nums text-stone-500">
                          {custo !== null ? formatBRL(custo) : '—'}
                        </div>
                        {l.manual && (
                          <button
                            onClick={() => removerExtra(l.id.replace('extra:', ''))}
                            className="flex-shrink-0 text-stone-400 hover:text-red-600"
                            aria-label={`remover ${l.item}`}
                          >
                            ×
                          </button>
                        )}
                      </li>
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
                <p className="text-xs text-stone-500">ingredientes</p>
              </div>
              <div>
                <p className="text-lg font-bold">{pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</p>
                <p className="text-xs text-stone-500">peso total</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatBRL(valorEstimadoTotal)}</p>
                <p className="text-xs text-stone-500">valor estimado</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-stone-500">Valor real da compra (R$)</label>
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
            <p className="text-xs text-stone-400">
              Considera apenas os itens marcados na checklist ({checked.size} de {total}).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
