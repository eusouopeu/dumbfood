// Placeholders de carregamento no formato dos cards reais, para reduzir a
// sensação de travamento entre abrir uma tela e o Dexie responder.

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700 ${className}`} />;
}

export function CardListSkeleton({ linhas = 4 }: { linhas?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <li key={i} className="card flex gap-3 p-3">
          <Bloco className="h-16 w-16 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <Bloco className="h-4 w-2/3" />
            <Bloco className="h-3 w-1/2" />
            <Bloco className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LinhaSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <Bloco key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
