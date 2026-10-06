import { describe, expect, it } from 'vitest';
import { assinatura, centavos, corpoVenda, errosPorItem, temPreco, vendavel, mudarQtd, novaChave, podeSomar, previa, texto2, unidades, type ProdutoVenda } from './venda';

// Valores fictícios do protótipo (s11).
const banner: ProdutoVenda = { id: 1, nome: 'Banner lona 0,80 × 1,20 m', categoria: 'Comunicação visual', preco: 89, estoque: 10 };
const adesivo: ProdutoVenda = { id: 2, nome: 'Adesivo recorte (un)', categoria: 'Adesivos', preco: 12, estoque: null };
const caneca: ProdutoVenda = { id: 6, nome: 'Caneca personalizada', categoria: 'Brindes', preco: 29, estoque: 2 };
// Preços que quebram soma em float.
const p019: ProdutoVenda = { id: 7, nome: 'Item 0,10', categoria: null, preco: 0.1, estoque: null };
const p1999: ProdutoVenda = { id: 8, nome: 'Item 19,99', categoria: null, preco: 19.99, estoque: null };

describe('centavos e texto2', () => {
  it('arredonda para centavos inteiros', () => {
    expect(centavos(89)).toBe(8900);
    expect(centavos(19.99)).toBe(1999);
    expect(1.005 * 100).toBeLessThan(100.5); // a armadilha: Math.round cru daria 100
    expect(centavos(1.005)).toBe(101);
    expect(centavos(89.1)).toBe(8910);
  });
  it('formata com 2 casas e ponto decimal', () => {
    expect(texto2(8900)).toBe('89.00');
    expect(texto2(5)).toBe('0.05');
    expect(texto2(123450)).toBe('1234.50');
    expect(texto2(0)).toBe('0.00');
    expect(texto2(-250)).toBe('-2.50');
  });
});

describe('prévia do total', () => {
  it('soma o carrinho do protótipo: 2 banners + 3 adesivos = R$ 214,00', () => {
    let c = mudarQtd([], banner, 1);
    c = mudarQtd(c, banner, 1);
    c = mudarQtd(c, adesivo, 3);
    expect(previa(c)).toBe(2 * 8900 + 3 * 1200);
    expect(previa(c)).toBe(21400);
    expect(unidades(c)).toBe(5);
  });
  it('não acumula erro de float: 3 × 0,10 = 0,30 e 3 × 19,99 = 59,97', () => {
    expect(0.1 * 3).not.toBe(0.3); // a armadilha existe
    expect(previa([{ produto: p019, qtd: 3 }])).toBe(30);
    expect(previa([{ produto: p1999, qtd: 3 }])).toBe(5997);
    expect(texto2(previa([{ produto: p019, qtd: 3 }, { produto: p1999, qtd: 3 }]))).toBe('60.27');
  });
});

describe('carrinho', () => {
  it('remove o item quando a quantidade chega a 0', () => {
    const c = mudarQtd(mudarQtd([], adesivo, 1), adesivo, -1);
    expect(c).toEqual([]);
  });
  it('não passa do estoque', () => {
    let c = mudarQtd([], caneca, 1);
    c = mudarQtd(c, caneca, 1);
    expect(podeSomar(c, caneca)).toBe(false);
    c = mudarQtd(c, caneca, 1);
    expect(c[0].qtd).toBe(2);
  });
  it('produto sem controle de estoque não tem teto', () => {
    expect(podeSomar([{ produto: adesivo, qtd: 999 }], adesivo)).toBe(true);
  });
  it('produto com estoque 0 não entra', () => {
    expect(mudarQtd([], { ...caneca, estoque: 0 }, 1)).toEqual([]);
  });
});

describe('corpo do envio', () => {
  it('manda preço e quantidade como texto com 2 casas, e a prévia só para conferência', () => {
    const c = mudarQtd(mudarQtd(mudarQtd([], banner, 2), adesivo, 3), p1999, 1);
    expect(corpoVenda(c, 'pix')).toEqual({
      cliente_id: null,
      metodo: 'pix',
      itens: [
        { variacao_id: 1, quantidade: '2.00', preco_unitario: '89.00' },
        { variacao_id: 2, quantidade: '3.00', preco_unitario: '12.00' },
        { variacao_id: 8, quantidade: '1.00', preco_unitario: '19.99' },
      ],
      total_previsto: '233.99',
    });
  });
  it('nenhum número do corpo é float', () => {
    const corpo = corpoVenda([{ produto: p019, qtd: 3 }], 'dinheiro', 42);
    const json = JSON.stringify(corpo);
    expect(json).not.toMatch(/\d\.\d{3,}/);
    expect(corpo.cliente_id).toBe(42);
  });
});

describe('idempotência', () => {
  it('gera chaves diferentes em formato UUID', () => {
    const a = novaChave(), b = novaChave();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('a assinatura muda quando muda o carrinho ou o método', () => {
    const c = mudarQtd([], banner, 1);
    expect(assinatura(c, 'pix')).toBe(assinatura(mudarQtd([], banner, 1), 'pix'));
    expect(assinatura(c, 'pix')).not.toBe(assinatura(c, 'debito'));
    expect(assinatura(c, 'pix')).not.toBe(assinatura(mudarQtd(c, banner, 1), 'pix'));
  });
});

describe('erros do 422 por item', () => {
  it('leva a mensagem para o produto na posição enviada', () => {
    const c = mudarQtd(mudarQtd([], banner, 1), caneca, 2);
    expect(errosPorItem({ 'itens.1.quantidade': 'Caneca: só há 1 em estoque.', total_previsto: 'O total mudou.' }, c))
      .toEqual({ 6: 'Caneca: só há 1 em estoque.' });
  });
  it('ignora índice fora do carrinho', () => {
    expect(errosPorItem({ 'itens.9.quantidade': 'x' }, [])).toEqual({});
  });
});

describe('preço zero segue o ajuste da empresa (decisão [W] 2026-10-05, padrão desligado)', () => {
  const semPreco: ProdutoVenda = { id: 9, nome: 'Brinde', categoria: null, preco: 0, estoque: 10 };
  it('ajuste desligado: produto de R$ 0,00 vende (brinde) e soma zero ao total', () => {
    expect(vendavel(semPreco, false)).toBe(true);
    const c = mudarQtd(mudarQtd([], semPreco, 2), banner, 1);
    expect(c).toHaveLength(2);
    expect(texto2(previa(c))).toBe('89.00');
    expect(corpoVenda(c, 'pix').itens[0]).toEqual({ variacao_id: 9, quantidade: '2.00', preco_unitario: '0.00' });
  });
  it('ajuste ligado: R$ 0,00, valor que arredonda a 0 e negativo não são vendáveis; 1 centavo é', () => {
    expect(vendavel(semPreco, true)).toBe(false);
    expect(vendavel({ ...semPreco, preco: 0.004 }, true)).toBe(false);
    expect(vendavel({ ...semPreco, preco: -5 }, true)).toBe(false);
    expect(vendavel({ ...semPreco, preco: 0.01 }, true)).toBe(true);
  });
  it('temPreco mede em centavos', () => {
    expect(temPreco(semPreco)).toBe(false);
    expect(temPreco({ ...semPreco, preco: 0.01 })).toBe(true);
  });
});
