// Prova 1 da regra mestre na tela 15: o corpo que vai ao ERP não carrega valor, mesmo quando a referência
// escolhida na tela (que vem do ERP com o valor para exibir) é passada inteira.
import { describe, expect, it } from 'vitest';
import { corpoNovoLink, emAberto, mensagemGerar } from './pagamento-regras';

describe('corpoNovoLink', () => {
  const ref = { tipo: 'pedido' as const, id: 46, rotulo: 'Pedido #0046', cliente: 'Cliente', valor: 2315 };

  it('manda só referência, método e prazo — nenhum valor', () => {
    const c = corpoNovoLink(ref, 'pix', 7);
    expect(c).toEqual({ referencia: { tipo: 'pedido', id: 46 }, metodo: 'pix', vencimento_dias: 7 });
    expect(JSON.stringify(c)).not.toMatch(/valor|total|amount/i);
    expect(JSON.stringify(c)).not.toContain('2315');
  });

  it('recusa prazo fora de 3, 7 ou 15 dias', () => {
    expect(() => corpoNovoLink(ref, 'pix', 30)).toThrow();
    expect(() => corpoNovoLink(ref, 'pix', 0)).toThrow();
  });

  it('recusa cartão (§10.6: exige token do cartão, não sai do app)', () => {
    expect(() => corpoNovoLink(ref, 'cartao', 7)).toThrow();
    for (const m of ['qualquer', 'pix', 'boleto'] as const) expect(corpoNovoLink(ref, m, 7).metodo).toBe(m);
  });

  it('recusa referência sem id válido', () => {
    expect(() => corpoNovoLink({ tipo: 'orcamento', id: 0 }, 'boleto', 3)).toThrow();
    expect(() => corpoNovoLink({ tipo: 'orcamento', id: 1.5 }, 'boleto', 3)).toThrow();
  });
});

describe('mensagemGerar', () => {
  it('mostra a mensagem do ERP (409 ja_existe, inclusive cobrança já paga) e traduz o 429', () => {
    expect(mensagemGerar({ status: 409, message: 'Já existe cobrança paga: registre o pagamento na venda antes de cobrar de novo.' }))
      .toContain('registre o pagamento na venda');
    expect(mensagemGerar({ status: 429, message: 'Too Many Attempts.' })).toBe('Muitas tentativas seguidas. Espere um minuto e tente de novo.');
    expect(mensagemGerar(null)).toBe('Não foi possível gerar o link.');
  });
});

describe('emAberto', () => {
  it('só pendente e vencido podem ser consultados ou cancelados', () => {
    expect(['pendente', 'vencido', 'pago', 'cancelado'].map((s) => emAberto(s as never))).toEqual([true, true, false, false]);
  });
});
