// Refeições para o Nexo (diário de saúde do Pedro), no mesmo celular e sem internet.
//
// O dumbfood monta um pacote com o que foi comido nos últimos dias e o entrega ao plugin
// nativo `Compartilhar`, que o guarda na área privada do app; o `CompartilharProvider`
// (Android) só o devolve ao Nexo, conferido por nome de pacote e assinatura do APK. O Nexo
// lê ao abrir e transforma cada item num registro de alimento — os ingredientes das
// receitas entram também, para a análise pegar "leite" mesmo dentro de um prato.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { dataDaChave, somarDias } from './consumo';
import type { Ingredient, RegistroConsumo } from '../types';

export interface ItemNexo {
  id: string;
  dia: string;
  /** Quando foi comido (ms): o horário do registro, ou o típico da refeição se lançado em outro dia. */
  hora: number;
  refeicao: string;
  nome: string;
  porcoes: number;
  kcal: number;
  ingredientes: string[];
}

export interface PacoteNexo {
  app: 'dumbfood';
  versao: 1;
  gerado: number;
  /** Dias cobertos (inclusive): o Nexo apaga do lado de lá o que sumiu daqui nesse intervalo. */
  de: string;
  ate: string;
  itens: ItemNexo[];
}

const HORA_TIPICA: Record<string, [number, number]> = { cafe: [8, 0], almoco: [12, 30], lanche: [16, 0], jantar: [20, 0] };

function horaDoItem(r: RegistroConsumo): number {
  const criado = new Date(r.criadoEm);
  const dia = dataDaChave(r.dia);
  if (criado.toDateString() === dia.toDateString()) return r.criadoEm;
  const [h, m] = HORA_TIPICA[r.refeicao] ?? [15, 0];
  dia.setHours(h, m, 0, 0);
  return dia.getTime();
}

export function pacoteParaNexo(
  consumo: RegistroConsumo[],
  receitas: { id: string; ingredientes: Pick<Ingredient, 'item'>[] }[],
  rotulos: Record<string, string>,
  hoje: string,
  dias = 14,
): PacoteNexo {
  const de = somarDias(hoje, -(dias - 1));
  const porId = new Map(receitas.map((r) => [r.id, r]));
  const itens = consumo
    .filter((r) => r.dia >= de && r.dia <= hoje)
    .map((r): ItemNexo => {
      const ing = r.recipeId ? (porId.get(r.recipeId)?.ingredientes ?? []) : [];
      return {
        id: r.id,
        dia: r.dia,
        hora: horaDoItem(r),
        refeicao: rotulos[r.refeicao] ?? r.refeicao,
        nome: r.nome,
        porcoes: r.porcoes,
        kcal: Math.round(r.nutrientes.kcal),
        ingredientes: [...new Set(ing.map((i) => i.item.trim()).filter(Boolean))],
      };
    })
    .sort((a, b) => a.hora - b.hora);
  return { app: 'dumbfood', versao: 1, gerado: Date.now(), de, ate: hoje, itens };
}

interface CompartilharPlugin {
  publicarNexo(o: { json: string | null }): Promise<void>;
}

const Compartilhar = registerPlugin<CompartilharPlugin>('Compartilhar');

/** Publica o pacote (ou apaga, com null). Falha silenciosa: é um extra. */
export function publicarParaNexo(p: PacoteNexo | null): void {
  if (!Capacitor.isNativePlatform()) return;
  Compartilhar.publicarNexo({ json: p ? JSON.stringify(p) : null }).catch(() => {});
}
