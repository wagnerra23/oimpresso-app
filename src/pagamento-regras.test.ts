// Prova 1 da regra mestre na tela 15: o corpo que vai ao ERP não carrega valor, mesmo quando a referência
// escolhida na tela (que vem do ERP com o valor para exibir) é passada inteira.
import { describe, expect, it } from 'vitest';
import { corpoNovoLink, emAberto } from './pagamento-regras';

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

  it('recusa referência sem id válido', () => {
    expect(() => corpoNovoLink({ tipo: 'orcamento', id: 0 }, 'boleto', 3)).toThrow();
    expect(() => corpoNovoLink({ tipo: 'orcamento', id: 1.5 }, 'boleto', 3)).toThrow();
  });
});

describe('emAberto', () => {
  it('só pendente e vencido podem ser consultados ou cancelados', () => {
    expect(['pendente', 'vencido', 'pago', 'cancelado'].map((s) => emAberto(s as never))).toEqual([true, true, false, false]);
  });
});
