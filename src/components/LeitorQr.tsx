// Leitor de QR Code pela câmera.
//
// Dois decodificadores, nessa ordem: `BarcodeDetector`, quando o sistema oferece, e
// `jsQR` como reserva. A reserva não é luxo — o WebView do Android (que é onde o APK
// roda) frequentemente não expõe o BarcodeDetector, e era por isso que o QR do cupom
// impresso simplesmente não abria: o botão da câmera nem aparecia.
//
// A leitura é sempre feita sobre um quadro copiado para <canvas>: passar o <video>
// direto para o detector falha em parte dos WebViews, e o canvas ainda permite recortar
// o centro da imagem, que é onde o QR pequeno do cupom fica.

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/** true quando dá para ler QR pela câmera neste aparelho/navegador. */
export function leitorQrDisponivel(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

const INTERVALO_LEITURA_MS = 250;

type Decodificador = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Promise<string | null>;

/**
 * Monta o decodificador para os formatos pedidos. `jsQR` só entra quando QR está entre
 * eles: ele não lê código de barras linear, e oferecer a câmera sem decodificador é pior
 * que avisar que o aparelho não dá conta.
 */
async function montarDecodificador(formatos: string[]): Promise<Decodificador | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Detector = (window as any).BarcodeDetector;
  if (Detector) {
    try {
      const detector = new Detector({ formats: formatos });
      return async (canvas) => {
        const codigos = await detector.detect(canvas);
        return codigos?.[0]?.rawValue ?? null;
      };
    } catch {
      // Construtor existe mas o formato não é suportado: cai no jsQR.
    }
  }
  if (!formatos.includes('qr_code')) return null;
  const { default: jsQR } = await import('jsqr');
  return async (canvas, ctx) => {
    const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const achado = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'attemptBoth' });
    return achado?.data ?? null;
  };
}

export default function LeitorQr({
  onLer,
  onCancelar,
  formatos = ['qr_code'],
  dica,
  erroCamera,
  alvoLargo = false,
}: {
  onLer: (texto: string) => void;
  onCancelar: () => void;
  /** Formatos aceitos pelo BarcodeDetector; QR por padrão. */
  formatos?: string[];
  /** Texto de orientação sob a câmera. */
  dica?: string;
  /** Mensagem quando a câmera não abre; o padrão fala do QR da nota fiscal. */
  erroCamera?: string;
  /** Moldura deitada, no formato de um código de barras, em vez do quadrado do QR. */
  alvoLargo?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O callback muda a cada render do pai; a ref evita reiniciar a câmera por causa disso.
  const aoLer = useRef(onLer);
  aoLer.current = onLer;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let encerrado = false;
    // Um QR lido é lido: sem esta trava o intervalo continuava disparando e a mesma nota
    // era consultada várias vezes em paralelo.
    let jaLeu = false;

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (encerrado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const decodificar = await montarDecodificador(formatos);
        if (!decodificar) {
          setErro('Este aparelho não sabe ler esse tipo de código pela câmera. Digite o número à mão.');
          return;
        }
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setErro('Este aparelho não conseguiu preparar a leitura. Cole o link do QR Code.');
          return;
        }

        timer = window.setInterval(async () => {
          if (jaLeu) return;
          // Quadro ainda sem dimensão: a câmera não terminou de abrir.
          if (video.readyState < 2 || !video.videoWidth) return;
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const texto = await decodificar(canvas, ctx);
            if (texto && !jaLeu) {
              jaLeu = true;
              aoLer.current(texto);
            }
          } catch {
            // Quadro ilegível (foco, movimento) — a próxima leitura tenta de novo.
          }
        }, INTERVALO_LEITURA_MS);
      } catch {
        setErro(erroCamera ?? 'Não foi possível abrir a câmera. Autorize o acesso ou cole o link do QR Code.');
      }
    }

    iniciar();
    return () => {
      encerrado = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatos.join(',')]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="h-64 w-full object-cover" />
        {/* Alvo: o QR da NFC-e é pequeno e fica no rodapé do cupom — a moldura ajuda a mirar. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`rounded-xl border-4 border-white/70 ${alvoLargo ? 'h-24 w-64' : 'size-40'}`} />
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
        {erro ?? dica ?? 'Aponte para o QR Code impresso no rodapé do cupom. Chegue perto até ele preencher a moldura.'}
      </p>
    </div>
  );
}
