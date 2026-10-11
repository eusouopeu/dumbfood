// Configurações › Inteligência artificial: a chave da Anthropic, só neste aparelho.

import { useState } from 'react';
import { KeyIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline';
import Secao from '../Secao';
import { gravarChaveIA, lerChaveIA, mensagemErroIA, testarChaveIA, useIAConfigurada } from '../../lib/ia';
import { toast } from '../../lib/toast';

export default function SecaoIA() {
  const configurada = useIAConfigurada();
  const [chave, setChave] = useState('');
  const [testando, setTestando] = useState(false);
  const final = lerChaveIA().slice(-4);

  async function salvar() {
    const anterior = lerChaveIA();
    gravarChaveIA(chave);
    setTestando(true);
    try {
      await testarChaveIA();
      setChave('');
      toast('Chave salva e funcionando.', 'sucesso');
    } catch (e) {
      gravarChaveIA(anterior);
      toast(mensagemErroIA(e), 'erro');
    } finally {
      setTestando(false);
    }
  }

  return (
    <Secao chave="cfg-ia" titulo="Inteligência artificial" subtitulo="pratos novos e lista de mercado" padraoAberta={false}>
      <div className="space-y-3 text-sm">
        <p className="flex gap-3 text-xs text-stone-500 dark:text-stone-400">
          <SparklesIcon className="size-5 flex-shrink-0 text-brand-500" />
          <span>
            Com uma chave da API da Anthropic (Claude Haiku), a busca do registro estima pratos que não estão nas suas
            receitas, e o botão de brilho da lista de mercado arruma quantidades tortas e itens repetidos. A chave fica
            só neste aparelho — fora do backup — e cada uso é cobrado na sua conta da Anthropic.
          </span>
        </p>
        {configurada ? (
          <div className="flex items-center gap-2">
            <KeyIcon className="size-4 text-stone-400" />
            <span className="flex-1 font-mono text-xs">sk-ant-…{final}</span>
            <button
              onClick={() => {
                gravarChaveIA('');
                toast('Chave apagada deste aparelho.');
              }}
              aria-label="Apagar chave"
              title="Apagar chave"
              className="btn-icon p-2 text-red-500"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (chave.trim()) void salvar();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            className="input min-w-0 flex-1"
            placeholder={configurada ? 'Trocar a chave' : 'sk-ant-…'}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
          <button type="submit" disabled={!chave.trim() || testando} className="btn-primary px-3">
            {testando ? 'Testando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </Secao>
  );
}
