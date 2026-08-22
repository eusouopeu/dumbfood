// Leitor de QR Code pela câmera, usando a API BarcodeDetector do próprio navegador
// (disponível no Chrome/WebView do Android, que é onde o app roda como APK).
// Sem biblioteca de decodificação: seriam centenas de KB para algo que o sistema já faz.

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/** true quando dá para ler QR pela câmera neste aparelho/navegador. */
export function leitorQrDisponivel(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

const INTERVALO_LEITURA_MS = 300;

export default function LeitorQr({ onLer, onCancelar }: { onLer: (texto: string) => void; onCancelar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O callback muda a cada render do pai; a ref evita reiniciar a câmera por causa disso.
  const aoLer = useRef(onLer);
  aoLer.current = onLer;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let encerrado = false;

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (encerrado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          try {
            const codigos = await detector.detect(video);
            const texto = codigos?.[0]?.rawValue;
            if (texto) aoLer.current(texto);
          } catch {
            // Quadro ilegível (foco, movimento) — a próxima leitura tenta de novo.
          }
        }, INTERVALO_LEITURA_MS);
      } catch {
        setErro('Não foi possível abrir a câmera. Autorize o acesso ou cole o link do QR Code.');
      }
    }

    iniciar();
    return () => {
      encerrado = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
        {/* Alvo: o QR da NFC-e é pequeno e fica no rodapé do cupom — a moldura ajuda a mirar. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-40 rounded-xl border-4 border-white/70" />
        </div>
        <button
          onClick={onCancelar}
          aria-label="Fechar câmera"
          className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>
      <p className="text-center text-sm text-stone-500 dark:text-stone-400">
        {erro ?? 'Aponte para o QR Code impresso no rodapé do cupom.'}
      </p>
    </div>
  );
}
