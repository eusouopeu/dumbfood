// Importa os preços de uma nota fiscal de mercado por dois caminhos:
//
//  1. QR Code da NFC-e (preferido): o QR aponta para a consulta na SEFAZ, onde a nota
//     está estruturada — item, quantidade, unidade e valor unitário exatos. Precisa de
//     internet, mas não erra leitura.
//  2. Foto + OCR no aparelho (tesseract.js), para cupom sem QR legível ou sem rede.
//
// Nos dois casos o usuário revisa antes de importar; o destino é o mesmo de
// "Atualizar preços" (db.precos).

import { useRef, useState } from 'react';
import { CameraIcon, CheckIcon, QrCodeIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { extrairCandidatos, candidatosParaPrecos } from '../lib/ocrNota';
import { itensNfceParaPrecos, parseQrNfce, urlConsultaPorChave } from '../lib/nfce';
import { buscarItensDaNota } from '../lib/nfceClient';
import { importarPrecos } from '../db/repo';
import { formatBRL } from '../lib/prices';
import { toast } from '../lib/toast';
import LeitorQr, { leitorQrDisponivel } from './LeitorQr';
import type { PrecoItem } from '../types';

type Etapa = 'inicial' | 'qr' | 'buscando' | 'lendo' | 'revisao';

const ROTULO_UNIDADE: Record<PrecoItem['unidade'], string> = { kg: 'por kg', l: 'por L', unidade: 'por un.' };

export default function EscanearNota({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('inicial');
  const [progresso, setProgresso] = useState(0);
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [totalNota, setTotalNota] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkQr, setLinkQr] = useState('');

  async function lerNotaPelaUrl(texto: string) {
    const qr = parseQrNfce(texto);
    // Cupom que traz só a chave de acesso: o portal do estado sai dos dois primeiros
    // dígitos dela, então a consulta continua sendo possível sem a URL do QR.
    const alvo = qr?.url || (qr?.chave ? urlConsultaPorChave(qr.chave) : undefined);
    if (!qr || !alvo) {
      setErro(
        qr?.chave
          ? 'Li a chave de acesso, mas não reconheci o estado da nota. Cole aqui o endereço da consulta.'
          : 'Esse QR Code não é de uma nota fiscal (NFC-e).',
      );
      setEtapa('inicial');
      return;
    }
    setEtapa('buscando');
    setErro(null);
    try {
      const nota = await buscarItensDaNota(alvo);
      if (nota.itens.length === 0) {
        setErro('A consulta abriu, mas não trouxe itens legíveis. Tente pela foto da nota.');
        setEtapa('inicial');
        return;
      }
      setPrecos(itensNfceParaPrecos(nota.itens));
      setTotalNota(nota.total);
      setEtapa('revisao');
    } catch (e) {
      setErro(`Não foi possível consultar a nota: ${(e as Error).message}`);
      setEtapa('inicial');
    }
  }

  async function processarImagem(file: File) {
    setEtapa('lendo');
    setProgresso(0);
    setErro(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgresso(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const achados = extrairCandidatos(data.text);
      if (achados.length === 0) {
        setErro('Não achei itens com preço legível nessa foto. Tente uma foto mais nítida, bem enquadrada na nota.');
        setEtapa('inicial');
        return;
      }
      setPrecos(candidatosParaPrecos(achados));
      setTotalNota(null);
      setEtapa('revisao');
    } catch {
      setErro('Não foi possível ler a imagem. Verifique sua conexão (o leitor de texto é baixado na primeira vez) e tente de novo.');
      setEtapa('inicial');
    }
  }

  function atualizarPreco(idx: number, campo: 'item' | 'precoUnitario', valor: string) {
    setPrecos((prev) =>
      prev.map((p, i) =>
        i === idx
          ? campo === 'precoUnitario'
            ? { ...p, precoUnitario: Number(valor.replace(',', '.')) || 0 }
            : { ...p, item: valor }
          : p,
      ),
    );
  }

  async function confirmarImportacao() {
    const validos = precos.filter((p) => p.item.trim() && p.precoUnitario > 0);
    if (validos.length === 0) {
      toast('Nenhum item válido para importar.', 'erro');
      return;
    }
    const n = await importarPrecos(validos);
    toast(`${n} preço(s) importado(s) da nota.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-stone-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-700">
          <h3 className="text-base font-bold">Importar nota fiscal</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {etapa === 'inicial' && (
            <div className="space-y-2.5">
              {erro && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">{erro}</p>}

              <div className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
                <p className="text-sm font-semibold">
                  <QrCodeIcon className="mr-1 inline size-4 text-brand-500" /> QR Code da nota
                </p>
                {leitorQrDisponivel() ? (
                  <button onClick={() => setEtapa('qr')} className="btn-primary w-full py-1.5 text-sm">
                    <QrCodeIcon className="size-4" /> Abrir a câmera
                  </button>
                ) : (
                  <p className="text-xs text-stone-400 dark:text-stone-500">Sem leitor de QR neste aparelho — cole o link abaixo.</p>
                )}
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (linkQr.trim()) lerNotaPelaUrl(linkQr);
                  }}
                >
                  <input
                    className="input py-1.5 text-sm"
                    placeholder="ou cole o link do QR"
                    value={linkQr}
                    onChange={(e) => setLinkQr(e.target.value)}
                  />
                  <button type="submit" className="btn-outline flex-shrink-0 py-1.5 text-sm">
                    Ler
                  </button>
                </form>
              </div>

              <div className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
                <p className="text-sm font-semibold">
                  <CameraIcon className="mr-1 inline size-4 text-stone-400" /> Foto da nota
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Sem internet; funciona melhor com boa luz.</p>
                <button onClick={() => fileRef.current?.click()} className="btn-outline w-full py-1.5 text-sm">
                  <CameraIcon className="size-4" /> Tirar foto ou escolher da galeria
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processarImagem(e.target.files[0])}
                />
              </div>
            </div>
          )}

          {etapa === 'qr' && <LeitorQr onLer={lerNotaPelaUrl} onCancelar={() => setEtapa('inicial')} />}

          {etapa === 'buscando' && (
            <div className="space-y-2 py-4 text-center">
              <div className="mx-auto size-6 animate-spin rounded-full border-4 border-stone-200 border-t-brand-500 dark:border-stone-700 dark:border-t-brand-400" />
              <p className="text-xs text-stone-500 dark:text-stone-400">Consultando a nota na Fazenda…</p>
            </div>
          )}

          {etapa === 'lendo' && (
            <div className="space-y-2 py-4 text-center">
              <div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Lendo a nota… {progresso}%</p>
            </div>
          )}

          {etapa === 'revisao' && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500 dark:text-stone-400">Confira os itens antes de importar.</p>
              <ul className="space-y-1.5">
                {precos.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 p-2">
                    <input
                      className="input min-w-0 flex-1 py-1 text-sm"
                      value={p.item}
                      onChange={(e) => atualizarPreco(idx, 'item', e.target.value)}
                    />
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span className="text-xs text-stone-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input w-16 py-1 text-right text-sm"
                        value={String(p.precoUnitario).replace('.', ',')}
                        onChange={(e) => atualizarPreco(idx, 'precoUnitario', e.target.value)}
                      />
                      <span className="w-10 text-xs text-stone-400 dark:text-stone-500">{ROTULO_UNIDADE[p.unidade]}</span>
                    </div>
                    <button
                      onClick={() => setPrecos((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`remover ${p.item}`}
                      className="flex-shrink-0 text-stone-400 hover:text-red-600 dark:text-stone-500"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {precos.length === 0 && (
                <p className="rounded-xl bg-stone-50 p-3 text-center text-sm text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                  Todos os itens foram removidos.
                </p>
              )}
            </div>
          )}
        </div>

        {etapa === 'revisao' && (
          <div className="flex-shrink-0 border-t border-stone-100 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-stone-700">
            {totalNota !== null && (
              <p className="mb-1.5 text-center text-xs text-stone-400 dark:text-stone-500">
                Total da nota: {formatBRL(totalNota)}
              </p>
            )}
            <button onClick={confirmarImportacao} className="btn-primary w-full">
              <CheckIcon className="size-4" /> Importar {precos.length} preço(s)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
