// confirmar(...) global: substitui window.confirm() por um modal no estilo do
// app. O <ConfirmHost/> montado uma vez em App.tsx escuta e resolve a Promise.

export interface ConfirmRequest {
  id: number;
  mensagem: string;
  textoConfirmar: string;
  perigo: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ConfirmRequest | null) => void;

let proximoId = 1;
let atual: ConfirmRequest | null = null;
const listeners = new Set<Listener>();

function emitir() {
  for (const l of listeners) l(atual);
}

export function onConfirmRequest(listener: Listener): () => void {
  listeners.add(listener);
  listener(atual);
  return () => listeners.delete(listener);
}

export function responderConfirm(ok: boolean): void {
  atual?.resolve(ok);
  atual = null;
  emitir();
}

export function confirmar(
  mensagem: string,
  opts: { textoConfirmar?: string; perigo?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    atual = {
      id: proximoId++,
      mensagem,
      textoConfirmar: opts.textoConfirmar ?? 'Confirmar',
      perigo: opts.perigo ?? false,
      resolve,
    };
    emitir();
  });
}
