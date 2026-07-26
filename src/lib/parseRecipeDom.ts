// Extração de receita direto da marcação da página, para sites que não publicam
// schema.org/Recipe em JSON-LD.
//
// É o caso de dois dos sites pedidos: o Panelinha entrega HTML completo mas sem
// dados estruturados, e a Panelaterapia marca os posts como "Article". Em ambos a
// receita está em listas (<ul>/<ol>) logo abaixo de um título — que é o que este
// módulo procura.
//
// Puro (string -> dados), sem DOM nem rede, para rodar igual no navegador e no teste.

import type { RecipeYield, YieldType } from '../types';
import { decodeEntities } from './decodeEntities';

/** Trecho relevante da página: um título ou uma lista, na ordem em que aparecem. */
type Bloco =
  | { tipo: 'titulo'; pos: number; texto: string }
  | { tipo: 'lista'; pos: number; fim: number; itens: string[] };

const UNIDADE_RE =
  /x[íi]cara|colher|copo|pitada|dente|gramas?\b|\bg\b|\bkg\b|\bml\b|\bl\b|litro|lata|pacote|ma[çc]o|ramo|fatia|folha|a gosto|\bq\.b\.?/i;
const NUMERO_RE = /^\s*(?:\d|[½⅓⅔¼¾⅕⅖⅗⅘⅛]|meia?\s|meio\s|uma?\s|dois\s|duas\s|tr[êe]s\s|quatro\s|cinco\s)/i;

/** Remove tudo que não é conteúdo legível antes de procurar as listas. */
function limparHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
}

function textoDeHtml(fragmento: string): string {
  return decodeEntities(fragmento.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lê títulos (h1–h6) e listas (ul/ol) na ordem do documento. */
function extrairBlocos(html: string): Bloco[] {
  const blocos: Bloco[] = [];

  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const texto = textoDeHtml(m[2]);
    if (texto) blocos.push({ tipo: 'titulo', pos: m.index ?? 0, texto });
  }

  for (const m of html.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const itens = Array.from(m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
      .map((li) => textoDeHtml(li[1]))
      .filter(Boolean);
    if (itens.length > 0) {
      blocos.push({ tipo: 'lista', pos: m.index ?? 0, fim: (m.index ?? 0) + m[0].length, itens });
    }
  }

  return blocos.sort((a, b) => a.pos - b.pos);
}

/**
 * Uma lista parece de ingredientes quando tem itens curtos e a maioria começa com
 * quantidade ou cita uma unidade — o que descarta menus de navegação, listas de
 * links e blocos de comentários.
 */
function pareceListaDeIngredientes(itens: string[]): boolean {
  if (itens.length < 3 || itens.length > 40) return false;
  if (itens.some((i) => i.length > 160)) return false;
  const bons = itens.filter((i) => NUMERO_RE.test(i) || UNIDADE_RE.test(i)).length;
  return bons / itens.length >= 0.6;
}

const TITULO_INGREDIENTES = /ingredientes|como fazer|voc[êe] vai precisar/i;
const TITULO_PREPARO = /modo de (?:preparo|fazer)|preparo|instru[çc][õo]es|como preparar|passo a passo/i;

/**
 * Junta a primeira lista de ingredientes com as que vêm logo em seguida — receitas
 * com "massa" e "cobertura" trazem uma lista por parte. O limite de distância evita
 * capturar as listas de variações/substituições que aparecem mais abaixo no post.
 */
const DISTANCIA_MAX_ENTRE_LISTAS = 3000;

function coletarIngredientes(blocos: Bloco[]): string[] {
  const listas = blocos.filter((b): b is Extract<Bloco, { tipo: 'lista' }> => b.tipo === 'lista');
  const primeira = listas.findIndex((l) => pareceListaDeIngredientes(l.itens));
  if (primeira === -1) return [];

  const itens = [...listas[primeira].itens];
  let fimAnterior = listas[primeira].fim;
  for (const lista of listas.slice(primeira + 1)) {
    if (lista.pos - fimAnterior > DISTANCIA_MAX_ENTRE_LISTAS) break;
    if (!pareceListaDeIngredientes(lista.itens)) continue;
    itens.push(...lista.itens);
    fimAnterior = lista.fim;
  }
  return itens;
}

/** Passos do preparo: todas as listas entre o título "modo de preparo" e o título seguinte. */
function coletarPreparo(blocos: Bloco[]): string[] {
  const idx = blocos.findIndex((b) => b.tipo === 'titulo' && TITULO_PREPARO.test(b.texto));
  if (idx === -1) return [];
  const passos: string[] = [];
  for (const bloco of blocos.slice(idx + 1)) {
    if (bloco.tipo === 'titulo') break;
    passos.push(...bloco.itens);
  }
  return passos.filter((p) => p.length > 2);
}

function metaConteudo(html: string, propriedade: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propriedade}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const direto = html.match(re);
  if (direto) return decodeEntities(direto[1]);
  // Alguns temas invertem a ordem dos atributos.
  const invertido = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${propriedade}["']`, 'i'),
  );
  return invertido ? decodeEntities(invertido[1]) : undefined;
}

function extrairTitulo(html: string): string | undefined {
  // O <h1> costuma trazer o nome da receita; og:title e <title> em blogs vêm
  // com a chamada do post ("Como fazer bolo de cenoura com brigadeiro?").
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const doH1 = h1 ? textoDeHtml(h1[1]) : '';
  const og = metaConteudo(html, 'og:title');
  const tag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const bruto = (doH1 && !TITULO_INGREDIENTES.test(doH1) ? doH1 : undefined) ??
    og ??
    (tag ? textoDeHtml(tag[1]) : undefined);
  if (!bruto) return undefined;
  // Tira o sufixo do site ("Bolo de cenoura - TudoGostoso").
  return bruto.split(/\s+[|–—]\s+|\s+-\s+(?=[A-ZÀ-Ú])/)[0].trim();
}

/** Procura "8 porções" / "serve 4 pessoas" no texto da página. */
export function extrairRendimento(texto: string): RecipeYield {
  const m = texto.match(/(\d+)\s*(?:a\s*\d+\s*)?(por[çc][õo]es|por[çc][ãa]o|pessoas?|unidades?|fatias?|peda[çc]os?)/i);
  if (!m) return { valor: 1, tipo: 'porcoes' };
  const baixo = m[2].toLowerCase();
  const tipo: YieldType = /pessoa/.test(baixo) ? 'pessoas' : /por/.test(baixo) ? 'porcoes' : 'unidades';
  const valor = Number(m[1]);
  return { valor: valor > 0 ? valor : 1, tipo };
}

export interface ReceitaDom {
  titulo?: string;
  imagem?: string;
  ingredientes: string[];
  modoPreparo: string[];
  rendimento: RecipeYield;
}

/** Extrai o que der da marcação da página; `ingredientes` vazio significa que não deu. */
export function parseRecipeFromDom(html: string): ReceitaDom {
  const limpo = limparHtml(html);
  const blocos = extrairBlocos(limpo);
  const ingredientes = coletarIngredientes(blocos);
  return {
    titulo: extrairTitulo(html),
    imagem: metaConteudo(html, 'og:image'),
    ingredientes,
    modoPreparo: coletarPreparo(blocos),
    rendimento: extrairRendimento(textoDeHtml(limpo).slice(0, 20000)),
  };
}
