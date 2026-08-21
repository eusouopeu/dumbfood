// Player do vídeo da receita dentro do modo de preparo — o caso típico é a receita de
// TikTok, em que o preparo está no vídeo e não em texto. O arquivo fica no próprio
// aparelho (IndexedDB), então toca offline, sem depender do app de origem.

import { useRef, useState } from 'react';
import { ArrowUpTrayIcon, TrashIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { definirVideoDaReceita, salvarVideo } from '../db/repo';
import { useVideoUrl } from '../lib/video';
import { confirmar } from '../lib/confirm';
import { toast } from '../lib/toast';
import { hapticLeve } from '../lib/haptics';
import type { Recipe } from '../types';

export default function VideoReceita({ recipe }: { recipe: Recipe }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { url, carregando } = useVideoUrl(recipe.videoId);
  const [salvando, setSalvando] = useState(false);

  async function escolherVideo(file: File) {
    setSalvando(true);
    try {
      const videoId = await salvarVideo(file);
      await definirVideoDaReceita(recipe, videoId);
      hapticLeve();
      toast('Vídeo adicionado à receita!');
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    const ok = await confirmar('Remover o vídeo desta receita?', { textoConfirmar: 'Remover', perigo: true });
    if (!ok) return;
    await definirVideoDaReceita(recipe, undefined);
    toast('Vídeo removido.');
  }

  const seletor = (
    <input
      ref={fileRef}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={(e) => e.target.files?.[0] && escolherVideo(e.target.files[0])}
    />
  );

  if (!recipe.videoId) {
    return (
      <div className="mb-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={salvando}
          className="btn-outline w-full"
        >
          <VideoCameraIcon className="size-4" /> {salvando ? 'Salvando vídeo…' : 'Adicionar vídeo do preparo'}
        </button>
        {seletor}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {carregando ? (
        <div className="h-64 w-full animate-pulse rounded-xl bg-stone-200 dark:bg-stone-700" />
      ) : url ? (
        // Vídeo de TikTok é vertical: limita a altura para não empurrar o resto da receita
        // para fora da tela, e centraliza sobre fundo escuro como no app de origem.
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[70vh] w-full rounded-xl bg-black object-contain"
        />
      ) : (
        <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          O vídeo desta receita não está mais no aparelho. Importe o arquivo de novo.
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={salvando} className="btn-outline h-8 px-2 text-xs">
          <ArrowUpTrayIcon className="size-3.5" /> Trocar vídeo
        </button>
        <button onClick={remover} className="btn-outline h-8 px-2 text-xs text-red-600 dark:text-red-400">
          <TrashIcon className="size-3.5" /> Remover
        </button>
      </div>
      {seletor}
    </div>
  );
}
