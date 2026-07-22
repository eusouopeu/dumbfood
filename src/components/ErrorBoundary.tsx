import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  erro: Error | null;
}

/** Evita a tela branca total: mostra a mensagem em vez de derrubar a árvore. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="m-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">Algo deu errado.</p>
          <p className="mt-1 break-words">{this.state.erro.message}</p>
          <button className="btn-outline mt-3" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
