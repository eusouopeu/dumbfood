// Leitura de código de barras de produto (EAN/UPC) e identificação do que foi lido.
//
// A infraestrutura de câmera já existia para o QR da nota fiscal (LeitorQr); aqui muda
// só o formato procurado. A diferença é que o jsQR, a reserva do QR, não lê código de
// barras linear — então, sem `BarcodeDetector` no aparelho, o caminho é digitar o
// número, e a tela avisa isso em vez de mostrar uma câmera que nunca vai reconhecer nada.
//
// A identificação tenta, nesta ordem: o que já foi lido antes neste aparelho (tabela
// `codigos`) e o Open Food Facts, base pública e aberta, com CORS liberado.

import type { Nutrientes100g } from './nutrition';

export const FORMATOS_BARRAS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

/** true quando o aparelho consegue decodificar código de barras pela câmera. */
export function leitorBarrasDisponivel(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (window as any).BarcodeDetector === 'function';
}

/**
 * Dígito verificador de EAN-8/EAN-13/UPC-A. Um código lido torto (ou digitado errado)
 * falha aqui antes de virar consulta de rede e item errado na despensa.
 */
export function eanValido(codigo: string): boolean {
  const d = codigo.trim();
  if (!/^\d+$/.test(d) || ![8, 12, 13].includes(d.length)) return false;
  const digitos = d.split('').map(Number);
  const verificador = digitos.pop()!;
  // Da direita para a esquerda, pesos alternam 3 e 1.
  const soma = digitos
    .reverse()
    .reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verificador;
}

export interface ProdutoCodigo {
  codigo: string;
  nome: string;
  marca?: string;
  /** Tabela nutricional por 100 g, quando a base informa. */
  nutrientes?: Nutrientes100g;
  /** Sódio por 100 g em mg, quando informado (entra na avaliação de qualidade). */
  sodioMg?: number;
}

const URL_OFF = 'https://world.openfoodfacts.org/api/v2/product';
const TIMEOUT_MS = 12_000;

function numero(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** Consulta o Open Food Facts. Devolve null quando o produto não está na base. */
export async function buscarProdutoOpenFoodFacts(codigo: string): Promise<ProdutoCodigo | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const campos = 'product_name,product_name_pt,brands,nutriments';
    const res = await fetch(`${URL_OFF}/${encodeURIComponent(codigo)}.json?fields=${campos}`, {
      signal: abort.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: number;
      product?: { product_name?: string; product_name_pt?: string; brands?: string; nutriments?: Record<string, unknown> };
    };
    const p = json.product;
    const nome = (p?.product_name_pt || p?.product_name || '').trim();
    if (!p || !nome) return null;
    const n = p.nutriments ?? {};
    // O Open Food Facts guarda sódio em gramas; o app trabalha em mg.
    const sodioMg = numero(n['sodium_100g']) * 1000 || numero(n['salt_100g']) * 400;
    return {
      codigo,
      nome,
      marca: p.brands?.split(',')[0]?.trim() || undefined,
      nutrientes: {
        kcal: numero(n['energy-kcal_100g']),
        gorduraTotal: numero(n['fat_100g']),
        gorduraSaturada: numero(n['saturated-fat_100g']),
        colesterolMg: numero(n['cholesterol_100g']) * 1000,
        carboidrato: numero(n['carbohydrates_100g']),
        acucares: numero(n['sugars_100g']),
        proteina: numero(n['proteins_100g']),
        fibra: numero(n['fiber_100g']),
      },
      ...(sodioMg > 0 ? { sodioMg } : {}),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
