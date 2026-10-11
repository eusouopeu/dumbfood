// IA (Claude Haiku) para o que o app não sabe sozinho: estimar um prato que não está no
// acervo e arrumar linhas da lista de mercado que saíram tortas da soma das receitas.
//
// A chave da Anthropic fica só neste aparelho, fora do prefixo `dumbfood:` — de propósito,
// para não entrar no backup JSON (que vai para o Drive, para o e-mail...). A chamada sai
// direto do app para a API, sem servidor no meio; quem paga é a chave do próprio Pedro.

import Anthropic from '@anthropic-ai/sdk';
import { useEffect, useState } from 'react';

/** Modelo pedido pelo Pedro: suficiente para estimativa e limpeza de texto, e barato. */
export const MODELO_IA = 'claude-haiku-5-5';

// Sem o prefixo `dumbfood:` → fica fora do backup (ver PREFIXO_PREFERENCIAS em repo.ts).
const KEY_CHAVE = 'dumbfoodIA:chave';
const EVENTO = 'dumbfood-ia-chave';

export function lerChaveIA(): string {
  try {
    return localStorage.getItem(KEY_CHAVE) ?? '';
  } catch {
    return '';
  }
}

export function gravarChaveIA(chave: string): void {
  const limpa = chave.trim();
  if (limpa) localStorage.setItem(KEY_CHAVE, limpa);
  else localStorage.removeItem(KEY_CHAVE);
  window.dispatchEvent(new Event(EVENTO));
}

/** true quando há chave gravada; reage a gravar/apagar em outra tela. */
export function useIAConfigurada(): boolean {
  const [ok, setOk] = useState(() => lerChaveIA() !== '');
  useEffect(() => {
    const atualizar = () => setOk(lerChaveIA() !== '');
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);
  return ok;
}

function cliente(): Anthropic {
  const apiKey = lerChaveIA();
  if (!apiKey) throw new Error('Cadastre a chave da Anthropic em Configurações › Inteligência artificial.');
  // A chave é do próprio usuário e o app roda só no aparelho dele: não há servidor para escondê-la.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 });
}

/** Mensagem curta, em português, para o toast. */
export function mensagemErroIA(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Chave da Anthropic recusada. Confira em Configurações.';
  if (e instanceof Anthropic.RateLimitError) return 'Limite da API atingido. Tente de novo em instantes.';
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a API da Anthropic.';
  if (e instanceof Anthropic.APIError) return `A API respondeu com erro (${e.status ?? '?'}).`;
  return e instanceof Error ? e.message : 'Falha ao consultar a IA.';
}

/** Uma pergunta com resposta em JSON validado pelo esquema (structured outputs). */
async function perguntarJSON<T>(sistema: string, pergunta: string, schema: Record<string, unknown>): Promise<T> {
  const resposta = await cliente().messages.create({
    model: MODELO_IA,
    max_tokens: 8000,
    system: sistema,
    messages: [{ role: 'user', content: pergunta }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
  });
  if (resposta.stop_reason === 'refusal') throw new Error('A IA recusou o pedido.');
  if (resposta.stop_reason === 'max_tokens') throw new Error('A resposta da IA veio cortada. Tente com menos itens.');
  const texto = resposta.content.find((b) => b.type === 'text');
  if (!texto || texto.type !== 'text') throw new Error('A IA não respondeu.');
  return JSON.parse(texto.text) as T;
}

/** Confere se a chave funciona, com a menor chamada possível. */
export async function testarChaveIA(): Promise<void> {
  await cliente().messages.create({
    model: MODELO_IA,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'ok' }],
    output_config: { effort: 'low' },
  });
}

// ---------------------------------------------------------------- prato estimado

/** Prato estimado pela IA, por UMA porção. */
export interface PratoEstimado {
  nome: string;
  /** Como a porção foi entendida, ex.: "1 prato raso (≈ 350 g)". */
  porcao: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gorduraTotal: number;
  gorduraSaturada: number;
  acucares: number;
  fibra: number;
  colesterolMg: number;
  ingredientes: string[];
}

const NUM = { type: 'number' } as const;
const SCHEMA_PRATO = {
  type: 'object',
  additionalProperties: false,
  required: [
    'nome',
    'porcao',
    'gramas',
    'kcal',
    'proteina',
    'carboidrato',
    'gorduraTotal',
    'gorduraSaturada',
    'acucares',
    'fibra',
    'colesterolMg',
    'ingredientes',
  ],
  properties: {
    nome: { type: 'string' },
    porcao: { type: 'string' },
    gramas: NUM,
    kcal: NUM,
    proteina: NUM,
    carboidrato: NUM,
    gorduraTotal: NUM,
    gorduraSaturada: NUM,
    acucares: NUM,
    fibra: NUM,
    colesterolMg: NUM,
    ingredientes: { type: 'array', items: { type: 'string' } },
  },
};

const SISTEMA_PRATO = `Você estima a composição nutricional de pratos e alimentos comidos no Brasil.
Responda por UMA porção típica do que foi descrito (se a descrição disser a quantidade, use-a).
Use a TACO/USDA como referência mental; valores em gramas, colesterol em mg, energia em kcal.
"nome" é o nome curto e limpo do prato, em português, com inicial minúscula.
"porcao" descreve a porção em palavras simples com o peso aproximado, ex.: "1 prato (≈ 350 g)".
"ingredientes" lista os ingredientes principais em minúsculas e no singular (ex.: "arroz", "feijão", "ovo"),
inclusive alérgenos óbvios (leite, ovo, trigo), sem quantidades.`;

function numeroValido(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Estima um prato descrito em texto livre ("marmita de frango com batata doce"). */
export async function estimarPrato(descricao: string): Promise<PratoEstimado> {
  const r = await perguntarJSON<PratoEstimado>(SISTEMA_PRATO, descricao.trim(), SCHEMA_PRATO);
  return {
    ...r,
    nome: r.nome.trim() || descricao.trim(),
    gramas: numeroValido(r.gramas),
    kcal: numeroValido(r.kcal),
    proteina: numeroValido(r.proteina),
    carboidrato: numeroValido(r.carboidrato),
    gorduraTotal: numeroValido(r.gorduraTotal),
    gorduraSaturada: numeroValido(r.gorduraSaturada),
    acucares: numeroValido(r.acucares),
    fibra: numeroValido(r.fibra),
    colesterolMg: numeroValido(r.colesterolMg),
    ingredientes: (r.ingredientes ?? []).map((i) => i.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------- lista de mercado

/** O que vai para a IA: só o necessário para entender a linha. */
export interface LinhaParaIA {
  id: string;
  item: string;
  rotulo: string;
}

/** Correção sugerida para uma linha. `juntarEm` = esta linha some e soma na outra. */
export interface CorrecaoLinha {
  id: string;
  quantidade: number | null;
  unidade: 'g' | 'ml' | 'unidade' | null;
  juntarEm: string | null;
  motivo: string;
}

const SCHEMA_LISTA = {
  type: 'object',
  additionalProperties: false,
  required: ['correcoes'],
  properties: {
    correcoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'quantidade', 'unidade', 'juntarEm', 'motivo'],
        properties: {
          id: { type: 'string' },
          quantidade: { type: ['number', 'null'] },
          unidade: { type: ['string', 'null'], enum: ['g', 'ml', 'unidade', null] },
          juntarEm: { type: ['string', 'null'] },
          motivo: { type: 'string' },
        },
      },
    },
  },
};

const SISTEMA_LISTA = `Você revisa uma lista de mercado brasileira gerada pela soma automática de receitas.
Cada linha tem id, item e rótulo (a quantidade somada). Algumas saem tortas, por exemplo:
"2 unidades de 1 xícara de arroz" (unidade sem sentido), "0.75 ml de água" (quantidade irrisória ou sem sentido de comprar),
ou o mesmo produto em duas linhas ("leite" e "leite morno").
Devolva SÓ as linhas que precisam de correção:
- quantidade/unidade: o total que faz sentido COMPRAR, em g, ml ou unidade (converta xícara, colher etc.);
  quantidade null quando não dá para estimar ou é "a gosto";
- juntarEm: o id da linha que absorve esta (mesmo produto com outro nome); a linha que absorve recebe
  a soma na própria correção; null quando não junta;
- água de torneira, gelo e "água morna/quente" não se compram: proponha juntarEm null, quantidade null e
  motivo começando com "remover:".
"motivo" é uma frase curta em português. Não invente linhas nem ids.`;

export async function corrigirLista(linhas: LinhaParaIA[]): Promise<CorrecaoLinha[]> {
  if (linhas.length === 0) return [];
  const r = await perguntarJSON<{ correcoes: CorrecaoLinha[] }>(
    SISTEMA_LISTA,
    JSON.stringify(linhas),
    SCHEMA_LISTA,
  );
  const ids = new Set(linhas.map((l) => l.id));
  // A IA não cria linha nem aponta para id que não existe; juntar em si mesma não faz sentido.
  return r.correcoes
    .filter((c) => ids.has(c.id))
    .map((c) => ({ ...c, juntarEm: c.juntarEm && ids.has(c.juntarEm) && c.juntarEm !== c.id ? c.juntarEm : null }));
}
