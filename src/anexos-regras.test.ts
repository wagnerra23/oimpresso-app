import { afterEach, describe, expect, it } from 'vitest';
import { bytesDoBase64, cancelouEscolha, erroDoEnvio, filtrarAnexos, MAX_BYTES, nomeArquivo, permissaoNegada, precisaConverter, temFiltroEtapa, textoAnexo, textoTamanho } from './anexos-regras';
import { ErroApi, type AnexoOs, type ListaAnexosOs, type ParteFormulario } from './api';
import { demo } from './demo';

describe('P2 · anexos — regras', () => {
  it('converte para JPEG o que o ERP não aceita (HEIC, WebP) e o que passa de 10 MB', () => {
    expect(precisaConverter('image/jpeg', 300_000)).toBe(false);
    expect(precisaConverter('image/png', 300_000)).toBe(false);
    expect(precisaConverter('image/heic', 300_000)).toBe(true);
    expect(precisaConverter('image/webp', 300_000)).toBe(true);
    expect(precisaConverter('image/jpeg', MAX_BYTES + 1)).toBe(true);
  });
  it('nome como a câmera do celular, com a extensão do tipo', () => {
    const quando = new Date(2026, 9, 15, 9, 4, 7);
    expect(nomeArquivo('camera', 'image/jpeg', quando)).toBe('CAM_20261015_090407.jpg');
    expect(nomeArquivo('galeria', 'image/png', quando)).toBe('IMG_20261015_090407.png');
  });
  it('bytes de um base64, com e sem preenchimento', () => {
    expect(bytesDoBase64(btoa('abc'))).toBe(3);
    expect(bytesDoBase64(btoa('abcd'))).toBe(4);
    expect(bytesDoBase64(btoa('abcde'))).toBe(5);
  });
  it('tamanho em KB ou MB', () => {
    expect(textoTamanho(284113)).toBe('277 KB');
    expect(textoTamanho(1204551)).toBe('1,1 MB');
  });
  it('legenda do ERP; sem ela, quem enviou e o dia', () => {
    expect(textoAnexo({ legenda: 'Painel na entrada', enviado_por: 'Ana', enviado_em: '2026-10-05T12:41:00Z' })).toBe('Painel na entrada');
    expect(textoAnexo({ legenda: null, enviado_por: 'Ana Souza', enviado_em: '2026-10-05T12:41:00' })).toBe('Ana Souza · 05/10');
    expect(textoAnexo({ legenda: null, enviado_por: null, enviado_em: 'x' })).toBe('Sem autor');
  });
  it('filtro Todas · etapa atual · Antes: só aparece com anexo na etapa atual e em outra', () => {
    const a = (etapa: string | null) => ({ etapa });
    expect(temFiltroEtapa([a('recepcao'), a('recepcao')], 'recepcao')).toBe(false);
    expect(temFiltroEtapa([a('recepcao'), a(null)], 'em_execucao')).toBe(false);
    expect(temFiltroEtapa([a('em_execucao'), a('recepcao'), a(null)], 'em_execucao')).toBe(true);
    expect(temFiltroEtapa([a('em_execucao'), a('recepcao')], null)).toBe(false);
    const itens = [a('em_execucao'), a('recepcao'), a(null)];
    expect(filtrarAnexos(itens, 'atual', 'em_execucao')).toEqual([a('em_execucao')]);
    expect(filtrarAnexos(itens, 'antes', 'em_execucao')).toEqual([a('recepcao'), a(null)]);
    expect(filtrarAnexos(itens, 'todas', 'em_execucao')).toHaveLength(3);
  });
  it('cancelar a câmera não vira aviso; permissão negada tem texto próprio', () => {
    expect(cancelouEscolha({ code: 'OS-PLUG-CAMR-0006' })).toBe(true);
    expect(cancelouEscolha({ code: 'OS-PLUG-CAMR-0020' })).toBe(true);
    expect(cancelouEscolha(new Error('User cancelled photos app'))).toBe(true);
    expect(cancelouEscolha({ code: 'OS-PLUG-CAMR-0003' })).toBe(false);
    expect(permissaoNegada({ code: 'OS-PLUG-CAMR-0003' })).toBe(true);
    expect(erroDoEnvio({ code: 'OS-PLUG-CAMR-0005' })).toMatch(/permissão/);
  });
  it('mensagem para cada recusa do contrato', () => {
    expect(erroDoEnvio(new ErroApi(403, 'sem_permissao', 'x'))).toBe('Seu usuário não pode anexar arquivos nesta OS.');
    expect(erroDoEnvio(new ErroApi(413, 'arquivo_grande', 'x'))).toBe('O arquivo passa de 10 MB.');
    expect(erroDoEnvio(new ErroApi(429, 'throttle', 'x'))).toMatch(/Espere um minuto/);
    expect(erroDoEnvio(new ErroApi(422, 'validacao', 'x', { origem: 'Câmera desligada.' }))).toBe('Câmera desligada.');
    expect(erroDoEnvio(new ErroApi(422, 'validacao', 'x', { arquivo: 'Tipo não aceito.' }))).toBe('Tipo não aceito.');
  });
});

describe('P2 · anexos — rota simulada (contrato tela-03-anexos)', () => {
  afterEach(() => demo.definirAjustes());
  const foto = btoa('jpeg-falso-' + Math.random());
  const corpo = (origem: string, conteudo = foto, tipo = 'image/jpeg'): ParteFormulario[] => [
    { key: 'arquivo', value: conteudo, type: 'base64File', fileName: 'CAM_1.jpg', contentType: tipo },
    { key: 'origem', value: origem, type: 'string' },
  ];
  const enviar = (c: ParteFormulario[], chave: string, id = 1042) => demo.chamar<AnexoOs>('POST', `/api/app/os/${id}/arquivos`, c, { 'Idempotency-Key': chave });

  it('lista do mais novo para o mais antigo; PDF sem miniatura', async () => {
    const l = await demo.chamar<ListaAnexosOs>('GET', '/api/app/os/1042/arquivos');
    expect(l.pode_enviar).toBe(true);
    expect(l.itens.length).toBeGreaterThan(0);
    const datas = l.itens.map((a) => a.enviado_em);
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(l.itens.find((a) => a.tipo === 'application/pdf')?.miniatura).toBeNull();
  });
  it('envia, entra no topo com a etapa atual, e a mesma chave devolve o mesmo anexo', async () => {
    const novo = await enviar(corpo('galeria'), 'k-anexo-1');
    expect(novo.etapa).toBe('em_execucao');
    const l = await demo.chamar<ListaAnexosOs>('GET', '/api/app/os/1042/arquivos');
    expect(l.itens[0].id).toBe(novo.id);
    expect((await enviar(corpo('galeria'), 'k-anexo-1')).id).toBe(novo.id);
    await expect(enviar(corpo('galeria', btoa('outra')), 'k-anexo-1')).rejects.toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
  });
  it('câmera desligada nos ajustes → 422 campos.origem; galeria segue valendo', async () => {
    demo.definirAjustes({ app_anexos_camera: false });
    await expect(enviar(corpo('camera'), 'k-anexo-2')).rejects.toMatchObject({ status: 422, campos: { origem: expect.any(String) } });
    await expect(enviar(corpo('galeria'), 'k-anexo-3')).resolves.toMatchObject({ tipo: 'image/jpeg' });
  });
  it('tipo fora (HEIC) → 422 campos.arquivo; sem chave → 422; OS de outra empresa → 404', async () => {
    await expect(enviar(corpo('galeria', foto, 'image/heic'), 'k-anexo-4')).rejects.toMatchObject({ status: 422, campos: { arquivo: expect.any(String) } });
    await expect(demo.chamar('POST', '/api/app/os/1042/arquivos', corpo('galeria'))).rejects.toMatchObject({ status: 422, campos: { idempotency_key: expect.any(String) } });
    await expect(demo.chamar('GET', '/api/app/os/999999/arquivos')).rejects.toMatchObject({ status: 404 });
  });
});
