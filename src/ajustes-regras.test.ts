import { describe, expect, it } from 'vitest';
import { AJUSTES_PADRAO, CHAVES_AJUSTES, completarAjustes } from './ajustes-regras';

// Cópia do bloco do contrato §6.2 (ERP #9442, AjustesDaEmpresa::CHAVES): o padrão do app tem de ser este.
const PADRAO_DO_ERP = {
  app_entrega_exige_assinatura: false, app_entrega_exige_localizacao: false,
  app_acoes_fsm_liberadas: [], app_anexos_camera: true, app_apontamento_exige_qr: false,
  app_orcamento_rapido: false, app_atendimento_atalhos: true,
  app_comissao_vendedor_ve_propria: true, app_biometria_login: true,
};

describe('completarAjustes', () => {
  it('padrão idêntico ao do ERP, com as 9 chaves', () => {
    expect(AJUSTES_PADRAO).toEqual(PADRAO_DO_ERP);
    expect(CHAVES_AJUSTES).toHaveLength(9);
  });

  it('ERP antigo (sem o bloco, null ou tipo errado) → padrão', () => {
    for (const bruto of [undefined, null, 'x', 1, [], [true]]) expect(completarAjustes(bruto)).toEqual(PADRAO_DO_ERP);
  });

  it('bloco completo passa como veio', () => {
    const tudo = {
      app_entrega_exige_assinatura: true, app_entrega_exige_localizacao: true,
      app_acoes_fsm_liberadas: ['put_on_hold', 'ready_for_invoice'], app_anexos_camera: false, app_apontamento_exige_qr: true,
      app_orcamento_rapido: true, app_atendimento_atalhos: false,
      app_comissao_vendedor_ve_propria: false, app_biometria_login: false,
    };
    expect(completarAjustes(tudo)).toEqual(tudo);
  });

  it('bloco incompleto: o que falta vem do padrão; chave desconhecida é ignorada', () => {
    const r = completarAjustes({ app_orcamento_rapido: true, app_chave_nova: true });
    expect(r).toEqual({ ...PADRAO_DO_ERP, app_orcamento_rapido: true });
    expect(r).not.toHaveProperty('app_chave_nova');
  });

  it('bool como o filter_var do ERP; inválido volta ao padrão, nunca vira outro tipo', () => {
    expect(completarAjustes({ app_anexos_camera: '0' }).app_anexos_camera).toBe(false);
    expect(completarAjustes({ app_anexos_camera: 0 }).app_anexos_camera).toBe(false);
    expect(completarAjustes({ app_anexos_camera: 'off' }).app_anexos_camera).toBe(false);
    expect(completarAjustes({ app_orcamento_rapido: '1' }).app_orcamento_rapido).toBe(true);
    expect(completarAjustes({ app_orcamento_rapido: 'on' }).app_orcamento_rapido).toBe(true);
    expect(completarAjustes({ app_anexos_camera: 'talvez' }).app_anexos_camera).toBe(true);
    expect(completarAjustes({ app_orcamento_rapido: 2 }).app_orcamento_rapido).toBe(false);
    expect(completarAjustes({ app_biometria_login: {} }).app_biometria_login).toBe(true);
  });

  it('lista: só chaves [a-z0-9_], sem repetição; não-lista volta ao padrão', () => {
    expect(completarAjustes({ app_acoes_fsm_liberadas: ['put_on_hold', 'put_on_hold', 'Maiúscula', 3, '', 'ready_for_invoice'] }).app_acoes_fsm_liberadas)
      .toEqual(['put_on_hold', 'ready_for_invoice']);
    expect(completarAjustes({ app_acoes_fsm_liberadas: 'put_on_hold' }).app_acoes_fsm_liberadas).toEqual([]);
  });

  it('não compartilha a lista do padrão (mexer no resultado não muda o padrão)', () => {
    completarAjustes(undefined).app_acoes_fsm_liberadas.push('x');
    expect(AJUSTES_PADRAO.app_acoes_fsm_liberadas).toEqual([]);
  });
});
