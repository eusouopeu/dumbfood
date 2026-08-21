// Lê a legenda de um vídeo de receita a partir de um print (OCR no próprio aparelho,
// tesseract.js — mesmo motor do leitor de nota fiscal). Devolve o texto reconhecido
// para quem chamou separar em ingredientes/preparo.

import { useRef, useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';

export default function LerLegenda({ onTexto }: { onTexto: (texto: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function processar(file: File) {
    setErro(null);
    setProgresso(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgresso(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      if (!data.text.trim()) {
        setErro('Não consegui ler texto nessa imagem. Tente um print mais nítido, com a legenda inteira visível.');
        return;
      }
      onTexto(data.text);
    } catch {
      setErro('Não foi possível ler a imagem. Verifique a conexão (o leitor é baixado na primeira vez) e tente de novo.');
    } finally {
      setProgresso(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={progresso !== null}
        className="btn-outline w-full"
      >
        <PhotoIcon className="size-4" />
        {progresso === null ? 'Ler legenda de um print' : `Lendo… ${progresso}%`}
      </button>
      {progresso !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progresso}%` }} />
        </div>
      )}
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && processar(e.target.files[0])}
      />
    </div>
  );
}
