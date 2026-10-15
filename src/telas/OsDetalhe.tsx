// Detalhe da OS — desenho v4 (tela 03), Onda D. Só leitura. Abre pela lista de OS (tela 07) e pelo
// histórico do veículo (tela 08). Rota GET /api/app/os/{id}, formato fechado pela sessão ERP da Onda D.
// O ERP não tem queixa nem diagnóstico: a tela mostra as observações da OS e o resumo da vistoria digital.
// Os totais vêm prontos do ERP (o app não soma valor). Fotos e anexos: aba Anexos (P2, AnexosOs.tsx), com câmera
// só a pedido (README §1). Fora de propósito: sugestão da IA, "+ Adicionar" item,
// "Link de aprovação" e "Faturar" (escritas, que mexem em valor e cobrança).
// Avançar etapa (rodapé): as ações vêm do ERP com o motivo do bloqueio quando o gate barra; ação crítica pede
// confirmação. Mudar de etapa não mexe em estoque nem valor (o processo da oficina não tem efeito colateral).
// Cancelar OS e recusar orçamento ficam num botão vermelho à parte, sempre com confirmação e motivo opcional
// (ligados por ENCERRAR_OS). Acionar garantia fica na web. Rota do ERP #8637 (contrato tela-03).
import { useEffect, useState } from 'react';
import { ANEXOS_OS, api, camposDoErro, ENCERRAR_OS, ErroApi, ESCRITA_OS, type OsAcao, type OsDetalhe as Detalhe, type TipoItemOs } from '../api';
import { AnexosOs } from './AnexosOs';
import { reais } from './Pedidos';

/** Quilometragem como o protótipo: "48.312 km". */
export const textoKm = (km: number | null): string | null => (km === null ? null : `${km.toLocaleString('pt-BR')} km`);

/** Etiqueta curta do item e o nome por extenso para o leitor de tela. */
export const ETIQUETA_ITEM: Record<TipoItemOs, readonly [string, string]> = {
  peca: ['PÇA', 'Peça'], mao_obra: ['M.O.', 'Mão de obra'], servico_terceiro: ['TER', 'Serviço de terceiro'],
};

/** Linha de baixo do item: "2 × R$ 69,00" (quantidade sem zeros sobrando). */
export const textoQuantidade = (quantidade: number, unitario: number): string =>
  `${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} × ${reais(unitario)}`;

/** Rótulo da aba Anexos (P2): com a contagem do laudo enquanto a lista não chega. */
export const rotuloAbaAnexos = (n: number): string => (n > 0 ? `Anexos · ${n}` : 'Anexos');

/** Mensagem para o erro de uma ação: o texto do ERP quando ele explica (gate, etapa mudou); senão um genérico. */
export function erroDaAcao(e: unknown): string {
  if (e instanceof ErroApi && e.status === 403) return 'Seu usuário não pode mudar a etapa desta OS.';
  return e instanceof Error && e.message ? e.message : 'Não foi possível mudar a etapa. Tente de novo.';
}

/** Ações que o rodapé mostra: só as que o usuário pode executar. */
export const acoesVisiveis = (acoes: OsAcao[] | undefined, ligado = ESCRITA_OS): OsAcao[] =>
  (ligado ? (acoes ?? []).filter((a) => a.pode && a.tipo !== 'encerra') : []);

/** Ações que encerram a OS (cancelar, recusar orçamento): só as que o usuário pode, e só com ENCERRAR_OS ligado. */
export const acoesEncerrar = (acoes: OsAcao[] | undefined, ligado = ESCRITA_OS && ENCERRAR_OS): OsAcao[] =>
  (ligado ? (acoes ?? []).filter((a) => a.pode && a.tipo === 'encerra') : []);

/** Motivo digitado: em branco não vai; o resto vai sem os espaços das pontas, até 500 caracteres. */
export const motivoParaEnvio = (t: string): string | null => (t.trim() ? t.trim().slice(0, 500) : null);

/** Motivo obrigatório: como o ERP manda em cada ação; sem o campo, só a garantia exige (é auditada depois). */
export const exigeMotivo = (a: Pick<OsAcao, 'chave' | 'motivo_obrigatorio'>): boolean => a.motivo_obrigatorio ?? a.chave === 'acionar_garantia';

/** Para onde a ação leva, como o ERP manda; sem o campo, o texto padrão de cada ação que encerra. */
export function destinoDaAcao(a: Pick<OsAcao, 'chave' | 'destino'>): string {
  if (a.destino?.rotulo) return a.destino.rotulo;
  return a.chave === 'acionar_garantia' ? 'Garantia acionada' : 'Cancelado';
}

/** Texto do botão de confirmar na folha de encerrar. */
export const confirmarEncerrar = (chave: string): string =>
  chave === 'recusar_orcamento' ? 'Recusar' : chave === 'acionar_garantia' ? 'Acionar garantia' : 'Cancelar OS';

/** Cor da etapa no detalhe: travada em vermelho, última do fluxo em verde, terminal e fora do fluxo neutros. */
export function tintaDetalhe(o: Pick<Detalhe, 'etapa' | 'travada'>): string {
  if (!o.etapa) return 'var(--text-dim)';
  if (o.travada) return 'var(--danger)';
  if (o.etapa.terminal) return 'var(--text-dim)';
  if (o.etapa.indice !== null && o.etapa.indice >= o.etapa.total_etapas) return 'var(--ok)';
  return 'var(--accent-text)';
}

export function OsDetalhe({ id, aoVoltar, avisar, online = true }: { id: number; aoVoltar: () => void; avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void; online?: boolean }) {
  const [o, setO] = useState<Detalhe | null>(null);
  // P2 · anexos — aba da tela: resumo (o de sempre) ou anexos.
  const [aba, setAba] = useState<'resumo' | 'anexos'>('resumo');
  const [confirmando, setConfirmando] = useState<OsAcao | null>(null);
  const [executando, setExecutando] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState<OsAcao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);

  const executar = async (a: OsAcao, comMotivo: string | null = null) => {
    setExecutando(a.chave);
    try {
      const nova = await api.executarAcaoOs(id, a.chave, comMotivo);
      setO(nova); setConfirmando(null); setEncerrando(null); setMotivo(''); setErroMotivo(null);
      avisar?.(`${nova.numero} · ${nova.etapa?.rotulo ?? 'etapa alterada'}`);
    } catch (e) {
      // Motivo recusado pelo ERP (vazio na garantia, longo demais): a folha fica aberta com o erro no campo.
      const campoMotivo = camposDoErro(e).motivo;
      if (campoMotivo) { setErroMotivo(campoMotivo); return; }
      setConfirmando(null); setEncerrando(null);
      avisar?.(erroDaAcao(e), 'erro');
      // Etapa mudou por outro usuário: recarrega para mostrar as ações certas.
      if (e instanceof ErroApi && e.status === 409) api.osDetalhe(id).then(setO).catch(() => {});
    } finally { setExecutando(null); }
  };
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setO(null); setErro(null); setAba('resumo');
    api.osDetalhe(id).then(setO).catch((e) => setErro(e instanceof ErroApi && e.status === 404 ? 'Esta OS não existe ou não é desta empresa.'
      : e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [id]);

  const tinta = o ? tintaDetalhe(o) : undefined;
  const km = o?.veiculo ? textoKm(o.veiculo.km) : null;
  const vist = o?.vistoria;
  const temVistoria = !!vist && vist.ok + vist.atencao + vist.critico > 0;
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{o?.local ? `Oficina · ${o.local}` : 'Oficina'}</div>
          <div className="pd-dtitulo">{o?.numero ?? 'OS …'}</div>
        </div>
        {o && <span className="pd-status" style={{ color: tinta, paddingRight: 8 }}><i style={{ background: tinta }} />{o.etapa?.rotulo ?? 'Fora do fluxo'}</span>}
      </div>
      {o && ANEXOS_OS && (
        <div className="osd-abas">
          <div className="rl-seg" role="tablist" aria-label="Seções da OS">
            <button role="tab" aria-selected={aba === 'resumo'} className={'rl-seg-b' + (aba === 'resumo' ? ' on' : '')} onClick={() => setAba('resumo')}>Resumo</button>
            <button role="tab" aria-selected={aba === 'anexos'} className={'rl-seg-b' + (aba === 'anexos' ? ' on' : '')} onClick={() => setAba('anexos')}>{rotuloAbaAnexos(o.fotos_laudo)}</button>
          </div>
        </div>
      )}
      {o && aba === 'anexos' ? <AnexosOs os={o} online={online} avisar={avisar} /> : <>
      <div className="oi-scroll">
        {erro && <div className="pd-corpo"><div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div></div>}
        {!o && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {o && (
          <div className="pd-corpo">
            <div className="pd-cartao osd-veiculo">
              {o.veiculo?.placa && <span className="os-placa" aria-label={`Placa ${o.veiculo.placa}`}>{o.veiculo.placa}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="osd-veic-d">{o.veiculo ? (o.veiculo.descricao ?? 'Veículo') : 'Sem veículo'}</div>
                <div className="osd-veic-m">{o.cliente?.nome ?? 'Sem cliente'}{km && <> · <span className="osd-km">{km} na entrada</span></>}</div>
              </div>
            </div>

            {(o.observacoes || temVistoria) && (
              <>
                <div className="p4-rotulo">Entrada</div>
                <div className="pd-cartao osd-texto">
                  {o.observacoes && <div><span>Observações</span><p>{o.observacoes}</p></div>}
                  {o.observacoes && temVistoria && <hr />}
                  {vist && temVistoria && (
                    <div><span>Vistoria</span>
                      <p className="osd-vist">
                        <b className="ok">{vist.ok} ok</b>
                        <b className="atencao">{vist.atencao} {vist.atencao === 1 ? 'atenção' : 'atenções'}</b>
                        <b className="critico">{vist.critico} {vist.critico === 1 ? 'crítico' : 'críticos'}</b>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="p4-rotulo">Itens</div>
            <div className="p4-lista">
              {o.itens.length === 0 && <div className="pd-item"><span className="pd-item-m" style={{ fontFamily: 'inherit' }}>Nenhum item lançado ainda.</span></div>}
              {o.itens.map((it, i) => (
                <div key={i} className="pd-item">
                  <span className={'osd-tag ' + it.tipo}><span aria-hidden="true">{ETIQUETA_ITEM[it.tipo][0]}</span><span className="sr-only">{ETIQUETA_ITEM[it.tipo][1]}</span></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pd-item-d">{it.descricao}</div>
                    <div className="pd-item-m">{textoQuantidade(it.quantidade, it.valor_unitario)}</div>
                  </div>
                  <span className="pd-item-v">{reais(it.valor)}</span>
                </div>
              ))}
              {o.itens.length > 0 && (
                <>
                  {o.totais.pecas > 0 && <div className="osd-sub"><span>Peças</span><span>{reais(o.totais.pecas)}</span></div>}
                  {o.totais.mao_de_obra > 0 && <div className="osd-sub"><span>Mão de obra</span><span>{reais(o.totais.mao_de_obra)}</span></div>}
                  {o.totais.terceiros > 0 && <div className="osd-sub"><span>Terceiros</span><span>{reais(o.totais.terceiros)}</span></div>}
                  <div className="pd-total"><span>Total</span><span>{reais(o.totais.total)}</span></div>
                </>
              )}
            </div>

            <p className="p4-legal">{acoesVisiveis(o.acoes).length ? acoesEncerrar(o.acoes).length ? 'Link de aprovação, garantia e faturar ficam no computador.' : 'Link de aprovação, cancelar e faturar ficam no computador.' : 'No app a OS é só consulta. Link de aprovação, mudar de etapa e faturar ficam no computador.'}</p>
          </div>
        )}
      </div>
      {o && (acoesVisiveis(o.acoes).length > 0 || acoesEncerrar(o.acoes).length > 0) && (
        <div className="pd-rodape osd-acoes">
          {acoesVisiveis(o.acoes).map((a) => (
            <div key={a.chave} className="osd-acao">
              <button className="p4-cta" disabled={!!a.bloqueio || executando !== null}
                onClick={() => (a.critica ? setConfirmando(a) : executar(a))}>
                {executando === a.chave ? 'Mudando…' : a.rotulo}
              </button>
              {a.bloqueio && <span className="osd-bloqueio">{a.bloqueio}</span>}
            </div>
          ))}
          {acoesEncerrar(o.acoes).length > 0 && (
            <div className="osd-encerrar">
              {acoesEncerrar(o.acoes).map((a) => (
                <button key={a.chave} className="osd-encerra" disabled={!!a.bloqueio || executando !== null} onClick={() => { setMotivo(''); setErroMotivo(null); setEncerrando(a); }}>
                  {a.rotulo}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </>}
      {encerrando && o && (
        <div className="oi-sheet-backdrop" onClick={() => executando === null && setEncerrando(null)}>
          <div className="oi-sheet" role="dialog" aria-modal="true" aria-labelledby="osd-enc-t" onClick={(e) => e.stopPropagation()}>
            <div className="oi-sheet-grip" />
            <div className="oi-sheet-h"><b id="osd-enc-t">{encerrando.rotulo}?</b></div>
            <div className="osd-folha">
              <p className="osd-conf">{o.numero}{o.veiculo?.placa ? ` · ${o.veiculo.placa}` : ''} sai da oficina e vai para <b>{destinoDaAcao(encerrando)}</b>. Isso não se desfaz pelo app.</p>
              <div className="p4-campo">
                <label htmlFor="osd-motivo">{exigeMotivo(encerrando) ? 'Motivo' : 'Motivo (opcional)'}</label>
                <textarea id="osd-motivo" className="nos-obs" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErroMotivo(null); }}
                  aria-invalid={!!erroMotivo} aria-describedby={erroMotivo ? 'osd-motivo-e' : undefined}
                  placeholder={encerrando.chave === 'recusar_orcamento' ? 'Ex.: cliente achou caro' : encerrando.chave === 'acionar_garantia' ? 'Ex.: barulho voltou na suspensão' : 'Ex.: cliente desistiu'} />
                {erroMotivo && <span id="osd-motivo-e" className="np-erro">{erroMotivo}</span>}
              </div>
              <div className="osd-conf-bts">
                <button className="oi-btn" disabled={executando !== null} onClick={() => setEncerrando(null)}>Voltar</button>
                <button className="oi-btn osd-perigo" disabled={executando !== null} onClick={() => (exigeMotivo(encerrando) && !motivoParaEnvio(motivo) ? setErroMotivo('Informe o motivo da garantia.') : executar(encerrando, motivoParaEnvio(motivo)))}>
                  {executando ? 'Encerrando…' : confirmarEncerrar(encerrando.chave)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmando && o && (
        <div className="oi-sheet-backdrop" onClick={() => executando === null && setConfirmando(null)}>
          <div className="oi-sheet" role="dialog" aria-modal="true" aria-labelledby="osd-conf-t" onClick={(e) => e.stopPropagation()}>
            <div className="oi-sheet-grip" />
            <div className="oi-sheet-h"><b id="osd-conf-t">{confirmando.rotulo}?</b></div>
            <div className="osd-folha">
              <p className="osd-conf">{o.numero}{o.veiculo?.placa ? ` · ${o.veiculo.placa}` : ''}<br />Sai de <b>{o.etapa?.rotulo ?? 'fora do fluxo'}</b>.</p>
              <div className="osd-conf-bts">
                <button className="oi-btn" disabled={executando !== null} onClick={() => setConfirmando(null)}>Voltar</button>
                <button className="p4-cta" disabled={executando !== null} onClick={() => executar(confirmando)}>{executando ? 'Mudando…' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
