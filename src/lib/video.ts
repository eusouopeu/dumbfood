// Leitura do vídeo guardado no dispositivo: transforma o blob do IndexedDB numa URL
// temporária para o <video>, e revoga essa URL quando o componente sai de cena
// (sem isso, cada visita à receita vaza alguns megabytes de memória).

import { useEffect, useState } from 'react';
import { db } from '../db/db';

export function useVideoUrl(videoId: string | undefined): { url: string | null; nome: string; carregando: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; nome: string; carregando: boolean }>({
    url: null,
    nome: '',
    carregando: !!videoId,
  });

  useEffect(() => {
    if (!videoId) {
      setEstado({ url: null, nome: '', carregando: false });
      return;
    }
    let cancelado = false;
    let criada: string | null = null;
    setEstado({ url: null, nome: '', carregando: true });

    db.videos.get(videoId).then((video) => {
      if (cancelado || !video) {
        if (!cancelado) setEstado({ url: null, nome: '', carregando: false });
        return;
      }
      criada = URL.createObjectURL(video.blob);
      setEstado({ url: criada, nome: video.nome, carregando: false });
    });

    return () => {
      cancelado = true;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [videoId]);

  return estado;
}

/** Tamanho legível ("12,4 MB"), para avisar quanto o vídeo ocupa no aparelho. */
export function formatTamanho(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
