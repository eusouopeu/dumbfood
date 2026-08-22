import { describe, it, expect } from 'vitest';
import {
  combinarReceita,
  combinarReceitas,
  ingredienteAtendido,
  receitasParaAproveitar,
  sugestoesDeIngredientes,
} from './geladeira';
import { parseIngredientLines, normalizeItemKey } from './ingredientParser';
import type { GeladeiraItem, Recipe } from '../types';

function geladeira(...nomes: string[]): GeladeiraItem[] {
  return nomes.map((nome, i) => ({ itemKey: normalizeItemKey(nome), nome, adicionadoEm: i }));
}

function receita(titulo: string, linhas: string[]): Recipe {
  return {
    id: titulo,
    titulo,
    rendimentoBase: { valor: 4, tipo: 'porcoes' },
    ingredientes: parseIngredientLines(linhas),
    modoPreparo: [],
    tags: [],
    criadoEm: 0,
  };
}

describe('ingredienteAtendido', () => {
  it('casa nomes iguais', () => {
    expect(ingredienteAtendido('ovo', 'ovo')).toBe(true);
  });

  it('casa plural com singular (chaves já normalizadas)', () => {
    expect(ingredienteAtendido(normalizeItemKey('ovos'), normalizeItemKey('ovo'))).toBe(true);
  });

  it('casa o genérico da geladeira com a especialização da receita', () => {
    expect(ingredienteAtendido('tomate', 'tomate italiano')).toBe(true);
  });

  it('casa o específico da geladeira com o genérico da receita', () => {
    expect(ingredienteAtendido('cebola roxa', 'cebola')).toBe(true);
  });

  it('não confunde produtos distintos separados por preposição', () => {
    expect(ingredienteAtendido('tomate', 'molho de tomate')).toBe(false);
    expect(ingredienteAtendido('leite', 'leite de coco')).toBe(false);
    expect(ingredienteAtendido('alho', 'alho em po')).toBe(false);
  });

  it('não trata leite condensado como leite', () => {
    expect(ingredienteAtendido('leite', 'leite condensado')).toBe(false);
  });

  it('não casa ingredientes sem relação', () => {
    expect(ingredienteAtendido('arroz', 'feijao')).toBe(false);
  });
});

describe('combinarReceita', () => {
  const omelete = receita('Omelete', ['3 ovos', '1 cebola picada', '50 g de queijo', 'sal a gosto']);

  it('separa o que tem do que falta', () => {
    const r = combinarReceita(omelete, geladeira('ovos', 'sal'));
    expect(r.tem.map((i) => i.item)).toEqual(['ovos', 'sal']);
    expect(r.falta.map((i) => i.item)).toEqual(['cebola', 'queijo']);
  });

  it('calcula a cobertura', () => {
    const r = combinarReceita(omelete, geladeira('ovos', 'sal'));
    expect(r.cobertura).toBeCloseTo(0.5);
  });

  it('reporta quais itens da geladeira foram usados', () => {
    const r = combinarReceita(omelete, geladeira('ovos', 'manteiga'));
    expect(r.usados).toEqual([normalizeItemKey('ovos')]);
  });

  it('conta ingredientes repetidos uma vez só', () => {
    const bolo = receita('Bolo', ['2 xícaras de farinha', '1 colher de farinha para untar', '3 ovos']);
    const r = combinarReceita(bolo, geladeira('farinha'));
    expect(r.tem).toHaveLength(1);
    expect(r.falta).toHaveLength(1);
  });

  it('com a geladeira vazia tudo falta', () => {
    const r = combinarReceita(omelete, []);
    expect(r.tem).toHaveLength(0);
    expect(r.falta).toHaveLength(4);
  });
});

describe('combinarReceitas', () => {
  it('põe na frente quem usa mais itens da geladeira', () => {
    const receitas = [
      receita('Arroz', ['2 xícaras de arroz', '1 litro de água']),
      receita('Omelete', ['3 ovos', '1 cebola', 'sal a gosto']),
    ];
    const r = combinarReceitas(receitas, geladeira('ovos', 'cebola', 'sal'));
    expect(r[0].recipe.titulo).toBe('Omelete');
    expect(r[0].falta).toHaveLength(0);
  });

  it('desempata por menos ingredientes faltando', () => {
    const receitas = [
      receita('Longa', ['3 ovos', '1 cebola', '1 kg de carne', '2 tomates', '100 g de queijo']),
      receita('Curta', ['3 ovos', '1 cebola']),
    ];
    const r = combinarReceitas(receitas, geladeira('ovos', 'cebola'));
    expect(r.map((x) => x.recipe.titulo)).toEqual(['Curta', 'Longa']);
  });
});

describe('sugestoesDeIngredientes', () => {
  const receitas = [
    receita('A', ['3 ovos', '1 cebola']),
    receita('B', ['2 ovos', '1 kg de carne']),
  ];

  it('ordena pelos mais usados na biblioteca', () => {
    expect(sugestoesDeIngredientes(receitas, [])[0].nome).toBe('ovos');
  });

  it('omite o que já está na geladeira', () => {
    const nomes = sugestoesDeIngredientes(receitas, geladeira('ovos')).map((s) => s.nome);
    expect(nomes).not.toContain('ovos');
    expect(nomes).toContain('cebola');
  });

  it('respeita o limite', () => {
    expect(sugestoesDeIngredientes(receitas, [], 2)).toHaveLength(2);
  });
});

describe('receitasParaAproveitar', () => {
  const geladeira: GeladeiraItem[] = [
    { itemKey: 'frango', nome: 'frango', adicionadoEm: 0, validade: 1 },
    { itemKey: 'cebola', nome: 'cebola', adicionadoEm: 0, validade: 999 },
    { itemKey: 'arroz', nome: 'arroz', adicionadoEm: 0 },
  ];
  const vencendo = (g: GeladeiraItem) => g.validade === 1;

  const receita = (id: string, itens: string[]): Recipe => ({
    id,
    titulo: id,
    rendimentoBase: { valor: 1, tipo: 'porcoes' },
    ingredientes: itens.map((item) => ({ raw: item, quantidade: 1, unidade: null, item, gondola: 'Outros' })),
    modoPreparo: [],
    tags: [],
    criadoEm: 0,
  });

  it('só sugere receitas que usam algo em risco', () => {
    const r = receitasParaAproveitar([receita('a', ['frango', 'arroz']), receita('b', ['cebola'])], geladeira, vencendo);
    expect(r.map((x) => x.recipe.id)).toEqual(['a']);
    expect(r[0].vencendo[0].itemKey).toBe('frango');
  });

  it('não sugere nada quando não há item vencendo', () => {
    expect(receitasParaAproveitar([receita('a', ['frango'])], geladeira, () => false)).toEqual([]);
  });

  it('põe na frente a receita que exige menos compras', () => {
    const r = receitasParaAproveitar(
      [receita('longa', ['frango', 'creme de leite', 'vinho']), receita('curta', ['frango', 'arroz'])],
      geladeira,
      vencendo,
    );
    expect(r[0].recipe.id).toBe('curta');
  });
});
