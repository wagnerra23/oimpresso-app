// Fila do apontamento sem internet (P8, decisão [W] 2026-10-15): ordem, reenvio sem duplicar (chave estável), descarte
// só com confirmação do servidor ou do operador, dono do item e o que o operador vê rodando.
import { describe, expect, it } from 'vitest';
import {
  aposFalha, aposSucesso, descartar, enfileirar, esquecerPausa, FILA_VAZIA, momentoIso, pausadasDe, pausar, pendentesDe, proximoEnvio,
  relogioErrado, rodando, tipoDaFalha, type Fila, type ItemFila,
} from './apontamento-fila-regras';

const pedido = { id: 4812, numero: 'OS-2026-04812', resumo: 'Fachada', cliente: 'Ótica' };
let n = 0;
const item = (p: Partial<ItemFila>): ItemFila => ({
  local: `L${++n}`, dono: 'marcos', acao: 'iniciar', chave: `K${n}`, momento: '2026-10-15T14:03:00-03:00',
  programacao_id: 77, pedido, etapa: 'Impressão', estado: 'pendente', tentativas: 0, ...p,
});
const encher = (...itens: ItemFila[]) => itens.reduce<Fila>((f, i) => enfileirar(f, i), FILA_VAZIA);

describe('fila do apontamento — ordem e reenvio', () => {
  it('envia na ordem de chegada', () => {
    const a = item({}), b = item({ acao: 'concluir', alvo: { id: 9 } });
    let f = encher(a, b);
    expect(proximoEnvio(f, 'marcos')?.item.local).toBe(a.local);
    f = aposSucesso(f, a.local, 10);
    expect(proximoEnvio(f, 'marcos')).toEqual({ item: b, apontamentoId: 9 });
  });

  it('falha de rede/servidor mantém o item com a MESMA chave e o mesmo momento para o reenvio', () => {
    const a = item({});
    let f = encher(a);
    for (const st of [0, 502, 503, 429, 401]) f = aposFalha(f, a.local, tipoDaFalha(st), 'fora');
    const p = proximoEnvio(f, 'marcos')!;
    expect(p.item.chave).toBe(a.chave);
    expect(p.item.momento).toBe(a.momento);
    expect(p.item.estado).toBe('pendente');
    expect(p.item.tentativas).toBe(5);
  });

  it('só sai da fila com a confirmação do servidor', () => {
    const a = item({});
    let f = encher(a);
    f = aposFalha(f, a.local, 'tentar_de_novo', 'sem rede');
    expect(f.itens).toHaveLength(1);
    f = aposSucesso(f, a.local, 10);
    expect(f.itens).toHaveLength(0);
  });

  it('concluir de um início ainda na fila espera o id do ERP', () => {
    const ini = item({}), fim = item({ acao: 'concluir', alvo: { ref: '' } });
    fim.alvo = { ref: ini.local };
    let f = encher(ini, fim);
    expect(proximoEnvio(f, 'marcos')?.item).toBe(ini);
    f = aposSucesso(f, ini.local, 501);
    expect(proximoEnvio(f, 'marcos')).toEqual({ item: fim, apontamentoId: 501 });
    f = aposSucesso(f, fim.local);
    expect(f).toEqual(FILA_VAZIA);
  });
});

describe('fila do apontamento — recusa do ERP', () => {
  it('4xx para a fila, mostra a mensagem e trava os de trás', () => {
    expect(tipoDaFalha(422)).toBe('recusado');
    expect(tipoDaFalha(409)).toBe('recusado');
    expect(tipoDaFalha(404)).toBe('recusado');
    const a = item({}), b = item({ acao: 'concluir', alvo: { ref: '' } });
    b.alvo = { ref: a.local };
    let f = aposFalha(encher(a, b), a.local, 'recusado', 'Envio vencido; peça a correção ao gestor');
    expect(proximoEnvio(f, 'marcos')).toBeNull();
    expect(pendentesDe(f, 'marcos')[0]).toMatchObject({ estado: 'recusado', erro: 'Envio vencido; peça a correção ao gestor' });
    // Descartar o início recusado leva junto o concluir que dependia dele.
    f = descartar(f, a.local);
    expect(f.itens).toHaveLength(0);
  });

  it('não descarta item pendente (só recusado)', () => {
    const a = item({});
    const f = encher(a);
    expect(descartar(f, a.local)).toBe(f);
  });

  it('descartar um concluir recusado deixa a fila andar', () => {
    const a = item({ acao: 'concluir', alvo: { id: 5 } }), b = item({ acao: 'corrigir', alvo: { id: 6 }, hora_certa: 'x', justificativa: 'errei a hora' });
    let f = aposFalha(encher(a, b), a.local, 'recusado', 'já encerrado');
    f = descartar(f, a.local);
    expect(proximoEnvio(f, 'marcos')?.item.local).toBe(b.local);
  });
});

describe('fila do apontamento — dono, relógio e o que aparece rodando', () => {
  it('outro usuário no mesmo celular não envia nem vê o que não é dele', () => {
    const a = item({ dono: 'ana' }), b = item({});
    const f = encher(a, b);
    expect(proximoEnvio(f, 'marcos')?.item.local).toBe(b.local);
    expect(pendentesDe(f, 'marcos').map((i) => i.local)).toEqual([b.local]);
    expect(proximoEnvio(f, 'joao')).toBeNull();
  });

  it('momento em ISO com o fuso do aparelho', () => {
    expect(momentoIso(new Date(2026, 9, 15, 14, 3, 7))).toMatch(/^2026-10-15T14:03:07[+-]\d{2}:\d{2}$/);
  });

  it('relógio a mais de 5 min do servidor trava o toque', () => {
    expect(relogioErrado(null)).toBeNull();
    expect(relogioErrado(300)).toBeNull();
    expect(relogioErrado(-300)).toBeNull();
    expect(relogioErrado(301)).toMatch(/relógio/);
    expect(relogioErrado(-4000)).toMatch(/relógio/);
  });

  it('rodando = ERP + inícios na fila − o que já tem concluir na fila', () => {
    const ini = item({}), fimLocal = item({ acao: 'concluir', alvo: { ref: '' } }), fimErp = item({ acao: 'concluir', alvo: { id: 2 } });
    fimLocal.alvo = { ref: ini.local };
    const servidor = [{ id: 1 }, { id: 2 }];
    expect(rodando(servidor, encher(ini), 'marcos').map((r) => r.chave)).toEqual(['id:1', 'id:2', `local:${ini.local}`]);
    expect(rodando(servidor, encher(ini, fimLocal, fimErp), 'marcos').map((r) => r.chave)).toEqual(['id:1']);
    // Início já confirmado (id 3 no ERP) com o concluir ainda na fila pelo local: não aparece rodando.
    const f = aposSucesso(encher(ini, fimLocal), ini.local, 3);
    expect(rodando([{ id: 1 }, { id: 3 }], f, 'marcos').map((r) => r.chave)).toEqual(['id:1']);
  });
});

describe('fila do apontamento — pausa com motivo', () => {
  const pausa = (alvo: ItemFila['alvo']) => item({ acao: 'pausar', alvo, motivo_id: 2, motivo: 'Troca de bobina' });
  const dados = { programacao_id: 77, pedido, etapa: 'Impressão' };

  it('sem internet: iniciar → pausar → retomar → concluir saem na ordem, cada um no id certo do ERP', () => {
    const ini = item({});
    const pa = pausa({ ref: ini.local });
    let f = pausar(encher(ini), pa, dados);
    expect(pausadasDe(f, 'marcos')).toMatchObject([{ programacao_id: 77, motivo: 'Troca de bobina', momento: pa.momento, por: pa.local }]);
    // Retomar = novo iniciar na mesma etapa: sai da lista de pausadas na hora, sem esperar o ERP.
    const ret = item({});
    f = enfileirar(f, ret);
    expect(pausadasDe(f, 'marcos')).toEqual([]);
    const fim = item({ acao: 'concluir', alvo: { ref: ret.local } });
    f = enfileirar(f, fim);

    const enviados: Array<[string, number | null]> = [];
    const ids: Record<string, number> = { [ini.local]: 701, [ret.local]: 702 };
    for (let p = proximoEnvio(f, 'marcos'); p; p = proximoEnvio(f, 'marcos')) {
      enviados.push([p.item.acao, p.apontamentoId]);
      f = aposSucesso(f, p.item.local, ids[p.item.local]);
    }
    expect(enviados).toEqual([['iniciar', null], ['pausar', 701], ['iniciar', null], ['concluir', 702]]);
    expect(f.itens).toEqual([]);
    expect(f.ids).toEqual({});
  });

  it('reenvio da pausa leva a mesma chave, o mesmo momento e o mesmo motivo (sem duplicar no ERP)', () => {
    const pa = pausa({ id: 9 });
    let f = pausar(FILA_VAZIA, pa, dados);
    for (const st of [0, 503, 429]) f = aposFalha(f, pa.local, tipoDaFalha(st), 'fora');
    const p = proximoEnvio(f, 'marcos')!;
    expect(p).toMatchObject({ apontamentoId: 9, item: { chave: pa.chave, momento: pa.momento, motivo_id: 2, tentativas: 3, estado: 'pendente' } });
    // Confirmado: o item sai, a etapa continua pausada à espera do Retomar.
    f = aposSucesso(f, pa.local);
    expect(f.itens).toEqual([]);
    expect(pausadasDe(f, 'marcos')).toHaveLength(1);
  });

  it('pausar tira o cartão de "rodando" (encerra o apontamento), pelo id do ERP ou pelo início na fila', () => {
    const ini = item({});
    let f = pausar(encher(ini), pausa({ ref: ini.local }), dados);
    expect(rodando([{ id: 1 }], f, 'marcos').map((r) => r.chave)).toEqual(['id:1']);
    f = pausar(FILA_VAZIA, pausa({ id: 1 }), dados);
    expect(rodando([{ id: 1 }, { id: 2 }], f, 'marcos').map((r) => r.chave)).toEqual(['id:2']);
  });

  it('pausa recusada (422 momento vencido) para a fila; descartar tira a etapa das pausadas', () => {
    const pa = pausa({ id: 9 });
    let f = aposFalha(pausar(FILA_VAZIA, pa, dados), pa.local, tipoDaFalha(422), 'Envio vencido; peça a correção ao gestor');
    expect(proximoEnvio(f, 'marcos')).toBeNull();
    expect(f.itens[0]).toMatchObject({ estado: 'recusado', erro: 'Envio vencido; peça a correção ao gestor' });
    f = descartar(f, pa.local);
    expect(f.itens).toEqual([]);
    expect(pausadasDe(f, 'marcos')).toEqual([]);
  });

  it('início recusado leva junto a pausa que dependia dele', () => {
    const ini = item({});
    let f = pausar(encher(ini), pausa({ ref: ini.local }), dados);
    f = descartar(aposFalha(f, ini.local, 'recusado', 'etapa alheia'), ini.local);
    expect(f.itens).toEqual([]);
    expect(pausadasDe(f, 'marcos')).toEqual([]);
  });

  it('pausada é do dono; some se o ERP mostra a etapa rodando; o operador pode tirar da lista', () => {
    let f = pausar(FILA_VAZIA, pausa({ id: 9 }), dados);
    expect(pausadasDe(f, 'ana')).toEqual([]);
    expect(pausadasDe(f, 'marcos', [77])).toEqual([]);
    // Pausar de novo a mesma etapa não duplica.
    f = pausar(f, pausa({ id: 10 }), dados);
    expect(pausadasDe(f, 'marcos')).toHaveLength(1);
    f = esquecerPausa(f, 'marcos', 77);
    expect(pausadasDe(f, 'marcos')).toEqual([]);
  });

  it('fila gravada antes da pausa existir (sem `pausadas`) continua valendo', () => {
    const antiga: Fila = { itens: [item({})], ids: {} };
    expect(pausadasDe(antiga, 'marcos')).toEqual([]);
    expect(enfileirar(antiga, item({})).pausadas).toBeUndefined();
  });
});
