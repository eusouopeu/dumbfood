// Toasts globais: qualquer lugar do app chama toast(...) e o <Toaster/> montado
// uma vez em App.tsx escuta e renderiza. Evita alert()/confirm() bloqueantes.

export interface ToastAcao {
  rotulo: string;
  onClick: () => void;
}

export interface ToastMsg {
  id: number;
  texto: string;
  tipo: 'sucesso' | 'erro' | 'info';
  acao?: ToastAcao;
}

type Listener = (msgs: ToastMsg[]) => void;

let proximoId = 1;
let msgs: ToastMsg[] = [];
const listeners = new Set<Listener>();

function emitir() {
  for (const l of listeners) l(msgs);
}

export function onToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(msgs);
  return () => listeners.delete(listener);
}

export function dispensarToast(id: number): void {
  msgs = msgs.filter((m) => m.id !== id);
  emitir();
}

export function toast(texto: string, tipo: ToastMsg['tipo'] = 'sucesso', acao?: ToastAcao): void {
  const id = proximoId++;
  msgs = [...msgs, { id, texto, tipo, acao }];
  emitir();
  // Toasts com ação (ex.: "Desfazer") ficam mais tempo na tela — o usuário
  // precisa de uma chance real de reagir antes que a remoção seja definitiva.
  setTimeout(() => dispensarToast(id), acao ? 5000 : 3200);
}
