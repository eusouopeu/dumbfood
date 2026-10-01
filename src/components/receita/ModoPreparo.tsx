// Pré-aquecimento e passos do preparo (numerados por parte quando a receita tem várias),
// com o vídeo da receita em cima.

import { forwardRef } from 'react';
import Secao from '../Secao';
import VideoReceita, { type VideoReceitaHandle } from '../VideoReceita';
import type { PreheatInfo } from '../../lib/preheat';
import type { Recipe } from '../../types';

const ModoPreparo = forwardRef<VideoReceitaHandle, { recipe: Recipe; preheat: PreheatInfo | null; tamanhoFonte: number }>(
  function ModoPreparo({ recipe, preheat, tamanhoFonte }, videoRef) {
    return (
      <>
      {/* Faça antes de começar: passo de pré-aquecimento, resumido (sem emoji nem citação da etapa) */}
      {preheat && (
        <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 p-3 text-amber-900 dark:text-amber-200 shadow-sm">
          <p className="text-sm font-bold">Antes de começar:</p>
          <p className="mt-1 text-sm font-bold">
            Pré-aqueça o forno
            {preheat.temperatura && (
              <span className="ml-2 rounded-full bg-amber-200 dark:bg-amber-800/60 px-2 py-0.5 text-xs">{preheat.temperatura}</span>
            )}
            {preheat.duracao && (
              <span className="ml-1 rounded-full bg-amber-200 dark:bg-amber-800/60 px-2 py-0.5 text-xs">{preheat.duracao}</span>
            )}
          </p>
        </div>
      )}

      {/* Sempre visível: receita de vídeo chega sem passos em texto, e é aqui que o
          usuário anexa (ou troca) o vídeo do preparo. */}
      <Secao
        chave="preparo"
        titulo="Modo de preparo"
        subtitulo={
          recipe.secoesPreparo && recipe.secoesPreparo.length > 0
            ? `${recipe.secoesPreparo.length} partes · ${recipe.modoPreparo.length} passos`
            : recipe.modoPreparo.length > 0
              ? `${recipe.modoPreparo.length} passos`
              : recipe.videoId
                ? 'vídeo'
                : 'sem passos'
        }
      >
        <VideoReceita ref={videoRef} recipe={recipe} embutido={false} />
        {recipe.secoesPreparo && recipe.secoesPreparo.length > 0 ? (
          /* Receita em partes (massa + recheio): cada parte mantém a própria numeração,
             que é como ela aparece no site de origem. */
          <div className="space-y-5">
            {recipe.secoesPreparo.map((sec, s) => (
              <div key={s}>
                {sec.titulo && (
                  <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                    {sec.titulo}
                  </p>
                )}
                <ol className="space-y-5">
                  {sec.passos.map((p, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 font-extrabold text-brand-600 dark:text-brand-400">{i + 1}.</span>
                      <span className="leading-relaxed" style={{ fontSize: tamanhoFonte }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-5">
            {recipe.modoPreparo.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 font-extrabold text-brand-600 dark:text-brand-400">{i + 1}.</span>
                <span className="leading-relaxed" style={{ fontSize: tamanhoFonte }}>
                  {p}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Secao>
      </>
    );
  },
);

export default ModoPreparo;
