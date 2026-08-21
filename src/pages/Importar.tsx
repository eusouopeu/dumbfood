import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { importarPorUrl, montarPorTexto } from '../lib/importClient';
import { salvarReceita, salvarVideo, definirVideoDaReceita } from '../db/repo';
import { extrairLegenda } from '../lib/ocrLegenda';
import { formatTamanho } from '../lib/video';
import LerLegenda from '../components/LerLegenda';
import type { YieldType } from '../types';

type Aba = 'url' | 'texto' | 'video';

export default function Importar() {
  const [aba, setAba] = useState<Aba>('url');
  const navigate = useNavigate();
  const location = useLocation();

  // URL
  const [url, setUrl] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Texto
  const [titulo, setTitulo] = useState('');
  const [rendValor, setRendValor] = useState(4);
  const [rendTipo, setRendTipo] = useState<YieldType>('porcoes');
  const [ingredientes, setIngredientes] = useState('');
  const [preparo, setPreparo] = useState('');
  const [tempo, setTempo] = useState<number>(0);

  // Vídeo (TikTok e afins)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [linkVideo, setLinkVideo] = useState('');

  async function importarUrl(entrada: string = url) {
    setErro(null);
    setCarregando(true);
    try {
      const nova = await importarPorUrl(entrada.trim());
      const salva = await salvarReceita(nova);
      navigate(`/receita/${salva.id}`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  // Chegou aqui por um link compartilhado de outro app (folha de compartilhamento do
  // Android, ver App.tsx + ShareReceiverPlugin): preenche e já dispara a importação.
  useEffect(() => {
    const compartilhado = (location.state as { sharedText?: string } | null)?.sharedText;
    if (!compartilhado) return;
    navigate(location.pathname, { replace: true, state: null });
    // Link de TikTok/Reels não tem receita em texto na página: não adianta tentar
    // importar por URL. Abre direto o fluxo de vídeo, já com o link preenchido.
    if (/tiktok\.com|instagram\.com\/(reel|p)\//i.test(compartilhado)) {
      setAba('video');
      setLinkVideo(compartilhado.trim());
      return;
    }
    setAba('url');
    setUrl(compartilhado);
    importarUrl(compartilhado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importarTexto() {
    setErro(null);
    const nova = montarPorTexto({
      titulo,
      rendimentoValor: rendValor,
      rendimentoTipo: rendTipo,
      ingredientesTexto: ingredientes,
      modoPreparoTexto: preparo,
      tempoPreparoMin: tempo,
      fonteUrl: aba === 'video' ? linkVideo : undefined,
    });
    if (nova.ingredientes.length === 0) {
      setErro('Cole ao menos um ingrediente.');
      return;
    }
    const salva = await salvarReceita(nova);
    // O vídeo é salvo depois da receita: se o arquivo falhar (tamanho, formato), a
    // receita já está guardada e o usuário pode anexar o vídeo direto na tela dela.
    if (videoFile) {
      try {
        const videoId = await salvarVideo(videoFile);
        await definirVideoDaReceita(salva, videoId);
      } catch (e) {
        setErro((e as Error).message);
        return;
      }
    }
    navigate(`/receita/${salva.id}`);
  }

  /** Preenche o formulário com o que der para separar da legenda lida/colada. */
  function aplicarLegenda(texto: string) {
    const { titulo: t, ingredientes: ings, preparo: passos } = extrairLegenda(texto);
    if (ings.length === 0 && passos.length === 0) {
      setErro('Não achei ingredientes nessa legenda. Cole o texto manualmente abaixo.');
      return;
    }
    setErro(null);
    if (t && !titulo.trim()) setTitulo(t);
    if (ings.length > 0) setIngredientes((atual) => [atual.trim(), ings.join('\n')].filter(Boolean).join('\n'));
    if (passos.length > 0) setPreparo((atual) => [atual.trim(), passos.join('\n')].filter(Boolean).join('\n'));
  }

  return (
    <div className="space-y-4">
      {/* A tela não está mais na barra de navegação, então precisa da própria saída. */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
        <ArrowLeftIcon className="size-4" /> Voltar para receitas
      </Link>
      <h2 className="text-xl font-bold">Importar receita</h2>

      <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
        <button
          onClick={() => setAba('url')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aba === 'url' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          Por link
        </button>
        <button
          onClick={() => setAba('texto')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aba === 'texto' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          Colar texto
        </button>
        <button
          onClick={() => setAba('video')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aba === 'video' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}
        >
          Vídeo
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}

      {aba === 'url' ? (
        <div className="card space-y-3 p-4">
          <label className="block text-sm font-medium">URL da receita</label>
          <input
            className="input"
            placeholder="https://www.tudogostoso.com.br/receita/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
          />
          <button onClick={() => importarUrl()} disabled={!url.trim() || carregando} className="btn-primary w-full">
            {carregando ? 'Buscando…' : 'Importar do link'}
          </button>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Funciona com TudoGostoso, Panelinha, Receiteria, Panelaterapia e a maioria dos blogs de receita. A
            página é buscada por um intermediário público, então pode levar alguns segundos. Se não funcionar,
            use “Colar texto”.
          </p>
        </div>
      ) : (
        <>
        {aba === 'video' && (
          <div className="card space-y-3 p-4">
            <h3 className="section-heading text-sm">Vídeo da receita</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Receita de TikTok: baixe o vídeo pelo próprio app (“Salvar vídeo”) e escolha o arquivo
              aqui. Ele fica guardado no aparelho e toca dentro do modo de preparo, mesmo sem internet.
            </p>
            <label className="btn-outline w-full cursor-pointer justify-center">
              <VideoCameraIcon className="size-4" />
              {videoFile ? 'Trocar vídeo' : 'Escolher vídeo do aparelho'}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {videoFile && (
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {videoFile.name} · {formatTamanho(videoFile.size)}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium">Link do vídeo (opcional)</label>
              <input
                className="input"
                inputMode="url"
                placeholder="https://www.tiktok.com/@perfil/video/..."
                value={linkVideo}
                onChange={(e) => setLinkVideo(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Ingredientes pela legenda</p>
              <LerLegenda onTexto={aplicarLegenda} />
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Tire um print da legenda do vídeo: o texto é lido no aparelho e cai nos campos abaixo
                para você revisar. Também dá para colar a legenda direto no campo de ingredientes.
              </p>
            </div>
          </div>
        )}
        <div className="card space-y-3 p-4">
          <div>
            <label className="block text-sm font-medium">Título</label>
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <label className="block text-sm font-medium">Rende</label>
              <input
                type="number"
                min={1}
                className="input"
                value={rendValor}
                onChange={(e) => setRendValor(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium">Tipo</label>
              <select className="input" value={rendTipo} onChange={(e) => setRendTipo(e.target.value as YieldType)}>
                <option value="porcoes">porções</option>
                <option value="pessoas">pessoas</option>
                <option value="unidades">unidades</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium">Tempo (min)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={tempo || ''}
                onChange={(e) => setTempo(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Ingredientes (um por linha)</label>
            <textarea
              className="input min-h-[140px]"
              placeholder={'2 xícaras de farinha\n1 colher de chá de sal\n3 ovos'}
              value={ingredientes}
              onChange={(e) => setIngredientes(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Modo de preparo (opcional)</label>
            <textarea
              className="input min-h-[100px]"
              placeholder={aba === 'video' ? 'Deixe vazio se o preparo está só no vídeo.' : undefined}
              value={preparo}
              onChange={(e) => setPreparo(e.target.value)}
            />
          </div>
          <button onClick={importarTexto} className="btn-primary w-full">
            Salvar receita
          </button>
        </div>
        </>
      )}
    </div>
  );
}
