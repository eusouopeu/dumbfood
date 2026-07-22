import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importarPorUrl, montarPorTexto } from '../lib/importClient';
import { salvarReceita } from '../db/repo';
import type { YieldType } from '../types';

type Aba = 'url' | 'texto';

export default function Importar() {
  const [aba, setAba] = useState<Aba>('url');
  const navigate = useNavigate();

  // URL
  const [url, setUrl] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Texto
  const [titulo, setTitulo] = useState('');
  const [rendValor, setRendValor] = useState(4);
  const [rendTipo, setRendTipo] = useState<YieldType>('porcoes');
  const [ingredientes, setIngredientes] = useState('');
  const [preparo, setPreparo] = useState('');

  async function importarUrl() {
    setErro(null);
    setCarregando(true);
    try {
      const nova = await importarPorUrl(url.trim());
      const salva = await salvarReceita(nova);
      navigate(`/receita/${salva.id}`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function importarTexto() {
    const nova = montarPorTexto({
      titulo,
      rendimentoValor: rendValor,
      rendimentoTipo: rendTipo,
      ingredientesTexto: ingredientes,
      modoPreparoTexto: preparo,
    });
    if (nova.ingredientes.length === 0) {
      setErro('Cole ao menos um ingrediente.');
      return;
    }
    const salva = await salvarReceita(nova);
    navigate(`/receita/${salva.id}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Importar receita</h2>

      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        <button
          onClick={() => setAba('url')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aba === 'url' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
        >
          Por link
        </button>
        <button
          onClick={() => setAba('texto')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aba === 'texto' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
        >
          Colar texto
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {aba === 'url' ? (
        <div className="card space-y-3 p-4">
          <label className="block text-sm font-medium">URL da receita</label>
          <input
            className="input"
            placeholder="https://www.tudogostoso.com.br/receita/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
          />
          <button onClick={importarUrl} disabled={!url.trim() || carregando} className="btn-primary w-full">
            {carregando ? 'Buscando…' : 'Importar do link'}
          </button>
          <p className="text-xs text-stone-500">
            Funciona com sites que publicam dados estruturados (TudoGostoso, Panelinha e a maioria dos blogs de
            receita). Se não funcionar, use “Colar texto”.
          </p>
        </div>
      ) : (
        <div className="card space-y-3 p-4">
          <div>
            <label className="block text-sm font-medium">Título</label>
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <label className="block text-sm font-medium">Rende</label>
              <input
                type="number"
                min={1}
                className="input"
                value={rendValor}
                onChange={(e) => setRendValor(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium">Tipo</label>
              <select className="input" value={rendTipo} onChange={(e) => setRendTipo(e.target.value as YieldType)}>
                <option value="porcoes">porções</option>
                <option value="pessoas">pessoas</option>
                <option value="unidades">unidades</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Ingredientes (um por linha)</label>
            <textarea
              className="input min-h-[140px]"
              placeholder={'2 xícaras de farinha\n1 colher de chá de sal\n3 ovos'}
              value={ingredientes}
              onChange={(e) => setIngredientes(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Modo de preparo (opcional)</label>
            <textarea
              className="input min-h-[100px]"
              value={preparo}
              onChange={(e) => setPreparo(e.target.value)}
            />
          </div>
          <button onClick={importarTexto} className="btn-primary w-full">
            Salvar receita
          </button>
        </div>
      )}
    </div>
  );
}
