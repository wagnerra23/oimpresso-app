// Detalhe da OS — desenho v4 (tela 03), Onda D. Só leitura. Abre pela lista de OS (tela 07) e pelo
// histórico do veículo (tela 08). Rota GET /api/app/os/{id}, formato fechado pela sessão ERP da Onda D.
// O ERP não tem queixa nem diagnóstico: a tela mostra as observações da OS e o resumo da vistoria digital.
// Os totais vêm prontos do ERP (o app não soma valor). Fotos: só a contagem das fotos do laudo — o app não
// mostra nem tira foto (ADR 0383, sem câmera). Fora de propósito: sugestão da IA, "+ Adicionar" item,
// "Link de aprovação" e "Faturar" (escritas, que mexem em valor e cobrança).
// Avançar etapa (rodapé): as ações vêm do ERP com o motivo do bloqueio quando o gate barra; ação crítica pede
// confirmação. Mudar de etapa não mexe em estoque nem valor (o processo da oficina não tem efeito colateral).
// Cancelar, recusar orçamento e acionar garantia ficam na web. Rota do ERP #8637 (contrato tela-03).
import { useEffect, useState } from 'react';
import { api, ErroApi, ESCRITA_OS, type OsAcao, type OsDetalhe as Detalhe, type TipoItemOs } from '../api';
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

/** Linha das fotos: só a contagem, nunca a imagem. */
export function textoFotos(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? '1 foto no laudo — veja no computador' : `${n} fotos no laudo — veja no computador`;
}

/** Mensagem para o erro de uma ação: o texto do ERP quando ele explica (gate, etapa mudou); senão um genérico. */
export function erroDaAcao(e: unknown): string {
  if (e instanceof ErroApi && e.status === 403) return 'Seu usuário não pode mudar a etapa desta OS.';
  return e instanceof Error && e.message ? e.message : 'Não foi possível mudar a etapa. Tente de novo.';
}

/** Ações que o rodapé mostra: só as que o usuário pode executar. */
export const acoesVisiveis = (acoes: OsAcao[] | undefined, ligado = ESCRITA_OS): OsAcao[] => (ligado ? (acoes ?? []).filter((a) => a.pode) : []);

/** Cor da etapa no detalhe: travada em vermelho, última do fluxo em verde, terminal e fora do fluxo neutros. */
export function tintaDetalhe(o: Pick<Detalhe, 'etapa' | 'travada'>): string {
  if (!o.etapa) return 'var(--text-dim)';
  if (o.travada) return 'var(--danger)';
  if (o.etapa.terminal) return 'var(--text-dim)';
  if (o.etapa.indice !== null && o.etapa.indice >= o.etapa.total_etapas) return 'var(--ok)';
  return 'var(--accent-text)';
}

export function OsDetalhe({ id, aoVoltar, avisar }: { id: number; aoVoltar: () => void; avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void }) {
  const [o, setO] = useState<Detalhe | null>(null);
  const [confirmando, setConfirmando] = useState<OsAcao | null>(null);
  const [executando, setExecutando] = useState<string | null>(null);

  const executar = async (a: OsAcao) => {
    setExecutando(a.chave);
    try {
      const nova = await api.executarAcaoOs(id, a.chave);
      setO(nova); setConfirmando(null);
      avisar?.(`${nova.numero} · ${nova.etapa?.rotulo ?? 'etapa alterada'}`);
    } catch (e) {
      setConfirmando(null);
      avisar?.(erroDaAcao(e), 'erro');
      // Etapa mudou por outro usuário: recarrega para mostrar as ações certas.
      if (e instanceof ErroApi && e.status === 409) api.osDetalhe(id).then(setO).catch(() => {});
    } finally { setExecutando(null); }
  };
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setO(null); setErro(null);
    api.osDetalhe(id).then(setO).catch((e) => setErro(e instanceof ErroApi && e.status === 404 ? 'Esta OS não existe ou não é desta empresa.'
      : e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [id]);

  const tinta = o ? tintaDetalhe(o) : undefined;
  const km = o?.veiculo ? textoKm(o.veiculo.km) : null;
  const fotos = o ? textoFotos(o.fotos_laudo) : null;
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

            {fotos && <p className="p4-legal">{fotos}</p>}
            <p className="p4-legal">{acoesVisiveis(o.acoes).length ? 'Link de aprovação, cancelar e faturar ficam no computador.' : 'No app a OS é só consulta. Link de aprovação, mudar de etapa e faturar ficam no computador.'}</p>
          </div>
        )}
      </div>
      {o && acoesVisiveis(o.acoes).length > 0 && (
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
