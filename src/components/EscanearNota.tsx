// Escaneia uma foto de nota fiscal (câmera ou galeria), reconhece o texto por OCR
// no próprio dispositivo (tesseract.js) e propõe itens/preços para revisão antes
// de importar — mesmo destino de "Atualizar preços" (db.precos), só que sem
// precisar passar a nota por um serviço externo primeiro.

import { useRef, useState } from 'react';
import { CameraIcon, CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { extrairCandidatos, candidatosParaPrecos, type CandidatoOcr } from '../lib/ocrNota';
import { importarPrecos } from '../db/repo';
import { formatBRL } from '../lib/prices';
import { toast } from '../lib/toast';

type Etapa = 'inicial' | 'lendo' | 'revisao';

export default function EscanearNota({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('inicial');
  const [progresso, setProgresso] = useState(0);
  const [candidatos, setCandidatos] = useState<CandidatoOcr[]>([]);
  const [erro, setErro] = useState<string | null>(null);

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
      setCandidatos(achados);
      setEtapa('revisao');
    } catch {
      setErro('Não foi possível ler a imagem. Verifique sua conexão (o leitor de texto é baixado na primeira vez) e tente de novo.');
      setEtapa('inicial');
    }
  }

  function atualizarCandidato(idx: number, campo: 'item' | 'preco', valor: string) {
    setCandidatos((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, [campo]: campo === 'preco' ? Number(valor.replace(',', '.')) || 0 : valor } : c,
      ),
    );
  }

  function removerCandidato(idx: number) {
    setCandidatos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function confirmarImportacao() {
    const validos = candidatos.filter((c) => c.item.trim() && c.preco > 0);
    if (validos.length === 0) {
      toast('Nenhum item válido para importar.', 'erro');
      return;
    }
    const n = await importarPrecos(candidatosParaPrecos(validos));
    toast(`${n} preço(s) importado(s) da nota.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-stone-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-700">
        <h3 className="text-lg font-bold">Escanear nota fiscal</h3>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">
          <XMarkIcon className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {etapa === 'inicial' && (
          <div className="card space-y-3 p-6 text-center">
            <CameraIcon className="mx-auto size-10 text-brand-400 dark:text-brand-300" />
            <p className="font-semibold">Fotografe a nota fiscal</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              O texto é lido no próprio aparelho. Funciona melhor com boa luz e a nota esticada, sem dobras.
            </p>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button onClick={() => fileRef.current?.click()} className="btn-primary w-full">
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
        )}

        {etapa === 'lendo' && (
          <div className="card space-y-3 p-6 text-center">
            <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">Lendo o texto da nota… {progresso}%</p>
          </div>
        )}

        {etapa === 'revisao' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Confira os itens lidos antes de importar — a leitura automática erra às vezes. Ajuste nome/preço ou remova o que não for item.
            </p>
            <ul className="space-y-2">
              {candidatos.map((c, idx) => (
                <li key={idx} className="flex items-center gap-2 rounded-xl bg-stone-50 dark:bg-stone-800 p-2.5">
                  <input
                    className="input min-w-0 flex-1 py-1.5 text-sm"
                    value={c.item}
                    onChange={(e) => atualizarCandidato(idx, 'item', e.target.value)}
                  />
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <span className="text-xs text-stone-400">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input w-20 py-1.5 text-right text-sm"
                      value={c.preco.toString().replace('.', ',')}
                      onChange={(e) => atualizarCandidato(idx, 'preco', e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removerCandidato(idx)}
                    aria-label={`remover ${c.item}`}
                    className="flex-shrink-0 text-stone-400 hover:text-red-600 dark:text-stone-500"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {candidatos.length === 0 && (
              <p className="card p-4 text-center text-sm text-stone-500 dark:text-stone-400">Todos os itens foram removidos.</p>
            )}
          </div>
        )}
      </div>

      {etapa === 'revisao' && (
        <div className="flex-shrink-0 border-t border-stone-100 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-stone-700">
          <p className="mb-2 text-center text-xs text-stone-400 dark:text-stone-500">
            Total lido: {formatBRL(candidatos.reduce((s, c) => s + c.preco, 0))}
          </p>
          <button onClick={confirmarImportacao} className="btn-primary w-full">
            <CheckIcon className="size-4" /> Importar {candidatos.length} preço(s)
          </button>
        </div>
      )}
    </div>
  );
}
