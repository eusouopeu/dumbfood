// Leitura de código de barras de produto, para pôr na despensa o que acabou de sair da
// sacola sem digitar o nome.
//
// A identificação tem três camadas, da mais barata para a mais cara: o que já foi lido
// antes neste aparelho, o Open Food Facts e — quando nenhum dos dois sabe — o próprio
// usuário. O nome que ele digitar fica associado ao código, então o terceiro caso só
// acontece uma vez por produto.

import { useState } from 'react';
import { CheckIcon, MagnifyingGlassIcon, QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import LeitorQr from './LeitorQr';
import { FORMATOS_BARRAS, buscarProdutoOpenFoodFacts, eanValido, leitorBarrasDisponivel } from '../lib/barcode';
import { buscarCodigoBarras, salvarCodigoBarras } from '../db/repo';
import SelosQualidade from './receita/SelosQualidade';
import type { Nutrientes100g } from '../lib/nutrition';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';

type Fase = 'camera' | 'buscando' | 'confirmar';

export default function EscanearProduto({
  onConfirmar,
  onFechar,
}: {
  /** Chamado com o nome do produto identificado/digitado. */
  onConfirmar: (nome: string) => void | Promise<void>;
  onFechar: () => void;
}) {
  const [fase, setFase] = useState<Fase>('camera');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState('');
  const [nutrientes, setNutrientes] = useState<Nutrientes100g | undefined>();
  const [sodioMg, setSodioMg] = useState<number | undefined>();

  async function identificar(lido: string) {
    const limpo = lido.trim();
    setCodigo(limpo);
    if (!eanValido(limpo)) {
      setFase('confirmar');
      setOrigem('Código fora do padrão EAN/UPC — confira o número e o nome.');
      return;
    }
    setFase('buscando');

    const conhecido = await buscarCodigoBarras(limpo);
    if (conhecido) {
      setNome(conhecido.nome);
      setOrigem('Já lido antes neste aparelho.');
      setFase('confirmar');
      return;
    }

    const produto = await buscarProdutoOpenFoodFacts(limpo);
    if (produto) {
      // Marca só entra quando não está no próprio nome ("Nutella (Nutella)" não ajuda ninguém).
      const marcaRedundante =
        !produto.marca || produto.nome.toLowerCase().includes(produto.marca.toLowerCase());
      setNome(marcaRedundante ? produto.nome : `${produto.nome} (${produto.marca})`);
      setOrigem('Open Food Facts');
      setNutrientes(produto.nutrientes);
      setSodioMg(produto.sodioMg);
    } else {
      setOrigem('Produto não encontrado na base pública. Digite o nome — ele fica salvo para a próxima leitura.');
    }
    setFase('confirmar');
  }

  async function confirmar() {
    const limpo = nome.trim();
    if (!limpo) return;
    if (codigo) await salvarCodigoBarras(codigo, limpo);
    hapticLeve();
    await onConfirmar(limpo);
    toast(`${limpo} identificado pelo código ${codigo}.`);
    onFechar();
  }

  const podeUsarCamera = leitorBarrasDisponivel();

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="w-full max-w-2xl space-y-3 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <QrCodeIcon className="size-5 text-brand-500" />
          <h3 className="section-heading flex-1 text-sm">Código de barras</h3>
          <button onClick={onFechar} aria-label="Fechar" className="btn-icon p-2">
            <XMarkIcon className="size-4" />
          </button>
        </div>

        {fase === 'camera' &&
          (podeUsarCamera ? (
            <>
              <LeitorQr
                formatos={FORMATOS_BARRAS}
                alvoLargo
                dica="Aponte para o código de barras da embalagem, na horizontal."
                erroCamera="Não foi possível abrir a câmera. Autorize o acesso ou digite o número do código."
                onLer={identificar}
                onCancelar={onFechar}
              />
              {/* Saída sempre à mão: câmera negada, embalagem amassada ou código
                  ilegível não podem impedir de pôr o item na despensa. */}
              <button onClick={() => setFase('confirmar')} className="btn-outline w-full">
                Digitar o número
              </button>
            </>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Este aparelho não lê código de barras pela câmera. Digite o número abaixo.
            </p>
          ))}

        {fase === 'buscando' && (
          <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">Identificando o produto…</p>
        )}

        {(fase === 'confirmar' || !podeUsarCamera) && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs text-stone-500 dark:text-stone-400">Código</span>
              <span className="flex gap-2">
                <input
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="7891000000000"
                />
                {/* O número digitado merece a mesma identificação do número lido: sem isso,
                    quem não consegue usar a câmera perde a consulta à base pública. */}
                <button
                  onClick={() => identificar(codigo)}
                  disabled={!codigo.trim()}
                  aria-label="Identificar o produto pelo código"
                  title="Identificar"
                  className="btn-icon flex-shrink-0"
                >
                  <MagnifyingGlassIcon className="size-4" />
                </button>
              </span>
            </label>
            <label className="block">
              <span className="block text-xs text-stone-500 dark:text-stone-400">Produto</span>
              <input
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: leite integral"
              />
            </label>
            {origem && <p className="text-xs text-stone-400 dark:text-stone-500">{origem}</p>}
            {nutrientes && (
              <SelosQualidade
                nutri={nutrientes}
                micro={sodioMg !== undefined ? { sodio: sodioMg } : undefined}
                rodape="Valores por 100 g declarados no rótulo, conforme o Open Food Facts."
              />
            )}
            <div className="flex gap-2">
              {podeUsarCamera && (
                <button onClick={() => setFase('camera')} className="btn-outline flex-1">
                  Ler outro
                </button>
              )}
              <button onClick={confirmar} disabled={!nome.trim()} className="btn-primary flex-1">
                <CheckIcon className="size-4" /> Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
