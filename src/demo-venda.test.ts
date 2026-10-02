// Contrato da venda (tela 11) na demo, que imita o ERP: idempotência, recálculo e erros por item.
// Não substitui a prova contra o ERP real; garante que a demo não deixa a tela passar por um caminho que o ERP recusaria.
import { describe, expect, it } from 'vitest';
import { demo } from './demo';
import { corpoVenda, mudarQtd, novaChave, previa, texto2, type ProdutoVenda } from './venda';
import type { ListaProdutosVenda, VendaCriada } from './api';

const produtos = async () => (await demo.chamar<ListaProdutosVenda>('GET', '/api/app/venda/produtos')).itens;
const achar = (l: ProdutoVenda[], nome: string) => l.find((p) => p.nome.startsWith(nome))!;
const vender = (corpo: unknown, chave: string) => demo.chamar<VendaCriada>('POST', '/api/app/vendas', corpo, { 'Idempotency-Key': chave });

describe('venda na demo', () => {
  it('total do ERP = prévia do app, e a mesma chave não cria 2ª venda nem baixa estoque de novo', async () => {
    const l = await produtos();
    const banner = achar(l, 'Banner'), adesivo = achar(l, 'Adesivo'), caneca = achar(l, 'Caneca');
    let c = mudarQtd([], banner, 2); c = mudarQtd(c, adesivo, 3); c = mudarQtd(c, caneca, 1);
    expect(texto2(previa(c))).toBe('243.90');
    const corpo = corpoVenda(c, 'debito'), chave = novaChave();
    const v1 = await vender(corpo, chave);
    expect(v1.total).toBe(243.9);
    expect(v1.itens.map((i) => [i.quantidade, i.subtotal])).toEqual([[2, 178], [3, 36], [1, 29.9]]);
    const v2 = await vender(corpo, chave);
    expect(v2.numero).toBe(v1.numero);
    const depois = await produtos();
    expect(achar(depois, 'Banner').estoque).toBe((banner.estoque as number) - 2);
    expect(achar(depois, 'Caneca').estoque).toBe((caneca.estoque as number) - 1);
    expect(achar(depois, 'Adesivo').estoque).toBeNull();
  });

  it('recusa a mesma chave com outro corpo e venda sem chave', async () => {
    const banner = achar(await produtos(), 'Banner');
    const chave = novaChave();
    await vender(corpoVenda([{ produto: banner, qtd: 1 }], 'pix'), chave);
    await expect(vender(corpoVenda([{ produto: banner, qtd: 1 }], 'dinheiro'), chave)).rejects.toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
    await expect(demo.chamar('POST', '/api/app/vendas', corpoVenda([{ produto: banner, qtd: 1 }], 'pix'))).rejects.toMatchObject({ status: 422 });
  });

  it('acima do estoque e preço desatualizado voltam como erro do item, sem gravar', async () => {
    const cartao = achar(await produtos(), 'Cartão');
    const mais = { ...cartao, estoque: null };
    await expect(vender(corpoVenda([{ produto: mais, qtd: (cartao.estoque as number) + 1 }], 'pix'), novaChave()))
      .rejects.toMatchObject({ status: 422, campos: { 'itens.0.quantidade': `Estoque insuficiente (disponível ${cartao.estoque})` } });
    await expect(vender(corpoVenda([{ produto: { ...cartao, preco: 1 }, qtd: 1 }], 'pix'), novaChave()))
      .rejects.toMatchObject({ status: 422, campos: { 'itens.0.preco_unitario': expect.stringMatching(/^O preço mudou para R\$/) } });
    expect(achar(await produtos(), 'Cartão').estoque).toBe(cartao.estoque);
  });
});
