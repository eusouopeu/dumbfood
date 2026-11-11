// Foto do prato: câmera ou galeria → IA (Claude Haiku) → folha editável → consumo.
//
// Nada entra no consumo sem o toque em "Lançar": a IA erra gramas com facilidade, e o
// registro errado é pior que nenhum. A foto não é guardada — vive só na memória até a
// folha fechar; vai para a API reduzida (lado maior de 1024 px, JPEG).

import { useEffect, useRef, useState } from 'react';
import { CameraIcon, PhotoIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { analisarFotoPrato, mensagemErroIA } from '../../lib/ia';
import { ajustarGramas, dimensoesReduzidas, totalDosItens, type ItemFoto } from '../../lib/fotoPrato';
import { capitalizar } from '../../lib/format';
import { toast } from '../../lib/toast';

type Fase = 'escolher' | 'analisando' | 'revisar';

/** Lê o arquivo, reduz no canvas e devolve o JPEG em base64 (sem o prefixo data:). */
async function reduzirParaJpeg(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export default function FotoPrato({
  rotulo,
  onLancar,
  onFechar,
}: {
  /** Refeição onde os itens vão entrar (só para o título). */
  rotulo: string;
  onLancar: (itens: ItemFoto[]) => void | Promise<void>;
  onFechar: () => void;
}) {
  const [fase, setFase] = useState<Fase>('escolher');
  const [previa, setPrevia] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemFoto[]>([]);
  /** Gramas como texto enquanto o campo está sendo editado (permite apagar e redigitar). */
  const [editando, setEditando] = useState<Record<number, string>>({});
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function analisar(arquivo: File | undefined) {
    if (!arquivo) return;
    setPrevia(URL.createObjectURL(arquivo));
    setFase('analisando');
    try {
      const { itens: achados } = await analisarFotoPrato(await reduzirParaJpeg(arquivo));
      if (achados.length === 0) {
        toast('A IA não reconheceu comida na foto.', 'erro');
        setFase('escolher');
        return;
      }
      setItens(achados);
      setFase('revisar');
    } catch (e) {
      toast(mensagemErroIA(e), 'erro');
      setFase('escolher');
    }
  }

  const total = totalDosItens(itens);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50" onClick={onFechar}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <CameraIcon className="size-5 text-brand-500" />
          <h3 className="section-heading flex-1 text-sm">Foto do prato · {rotulo}</h3>
          <button onClick={onFechar} aria-label="Fechar" className="btn-icon p-2">
            <XMarkIcon className="size-4" />
          </button>
        </div>

        {/* Dois inputs: um abre a câmera direto, o outro a galeria. */}
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => analisar(e.target.files?.[0])} />
        <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => analisar(e.target.files?.[0])} />

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {fase === 'escolher' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => camera.current?.click()} className="btn-primary py-3">
                <CameraIcon className="size-5" /> Câmera
              </button>
              <button onClick={() => galeria.current?.click()} className="btn-outline py-3">
                <PhotoIcon className="size-5" /> Galeria
              </button>
              <p className="col-span-2 text-xs text-stone-400 dark:text-stone-500">
                A IA estima itens e gramas; você confere antes de lançar. A foto não fica salva.
              </p>
            </div>
          )}

          {previa && fase !== 'escolher' && (
            <img src={previa} alt="Prato fotografado" className="max-h-40 w-full rounded-lg object-cover" />
          )}

          {fase === 'analisando' && (
            <p className="py-4 text-center text-sm text-stone-500 dark:text-stone-400">Olhando o prato…</p>
          )}

          {fase === 'revisar' && (
            <>
              <ul className="divide-y divide-stone-100 dark:divide-stone-700">
                {itens.map((item, i) => (
                  <li key={`${item.nome}-${i}`} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{capitalizar(item.nome)}</p>
                      <p className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
                        {fmt(item.kcal)} kcal · P {fmt(item.proteina)} · C {fmt(item.carboidrato)} · G {fmt(item.gorduraTotal)} · F{' '}
                        {fmt(item.fibra)} g
                      </p>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={10}
                        aria-label={`Gramas de ${item.nome}`}
                        value={editando[i] ?? String(Math.round(item.gramas))}
                        onChange={(e) => {
                          const texto = e.target.value;
                          setEditando((ed) => ({ ...ed, [i]: texto }));
                          const g = Number(texto);
                          if (texto !== '' && Number.isFinite(g) && g > 0) {
                            setItens((lista) => lista.map((it, j) => (j === i ? ajustarGramas(it, g) : it)));
                          }
                        }}
                        onBlur={() => setEditando((ed) => {
                          const { [i]: _, ...resto } = ed;
                          return resto;
                        })}
                        className="input w-20 py-1 text-center"
                      />
                      g
                    </label>
                    <button
                      onClick={() => {
                        setItens((lista) => lista.filter((_, j) => j !== i));
                        setEditando({});
                      }}
                      aria-label={`Remover ${item.nome}`}
                      className="btn-icon p-2 text-red-500 dark:text-red-400"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="rounded-lg bg-stone-100 p-2 text-xs tabular-nums dark:bg-stone-700">
                <span className="font-semibold">Total: {fmt(total.kcal)} kcal</span> · {fmt(total.gramas)} g · P {fmt(total.proteina)} · C{' '}
                {fmt(total.carboidrato)} · G {fmt(total.gorduraTotal)} · F {fmt(total.fibra)} g
              </p>
              <div className="flex gap-2">
                <button onClick={() => setFase('escolher')} className="btn-outline flex-1">
                  Outra foto
                </button>
                <button onClick={() => onLancar(itens)} disabled={itens.length === 0} className="btn-primary flex-1">
                  Lançar {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
