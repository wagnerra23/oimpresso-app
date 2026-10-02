// Detalhe da OS — desenho v4 (tela 03), Onda D. Só leitura. Abre a partir da lista de OS (tela 07).
// Rota PROVISÓRIA GET /api/app/os/{id}: formato pedido ao ERP, ainda sem contrato; só a demo responde.
// Os totais vêm prontos do ERP (o app não soma valor). Fora de propósito: sugestão da IA, "+ Adicionar"
// item, "Link de aprovação" e "Faturar" (escritas, que mexem em valor e cobrança) e as fotos de entrada:
// o app só diz quantas existem — não mostra nem tira foto (ADR 0383, sem câmera).
import { useEffect, useState } from 'react';
import { api, ErroApi, type OsDetalhe as Detalhe } from '../api';
import { reais } from './Pedidos';
import { tintaOs } from './OrdensServico';

/** Quilometragem como o protótipo: "48.312 km". */
export const textoKm = (km: number | null): string | null => (km === null ? null : `${km.toLocaleString('pt-BR')} km`);

/** Etiqueta curta do item, como o protótipo (SRV / PÇA), e o nome por extenso para o leitor de tela. */
export const ETIQUETA_ITEM = { servico: ['SRV', 'Serviço'], peca: ['PÇA', 'Peça'] } as const;

/** Linha das fotos: só a contagem, nunca a imagem. */
export function textoFotos(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? '1 foto de entrada — veja no computador' : `${n} fotos de entrada — veja no computador`;
}

export function OsDetalhe({ id, aoVoltar }: { id: number; aoVoltar: () => void }) {
  const [o, setO] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setO(null); setErro(null);
    api.osDetalhe(id).then(setO).catch((e) => setErro(e instanceof ErroApi && e.status === 404 ? 'Esta OS não existe ou não é desta empresa.'
      : e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [id]);

  const tinta = o ? tintaOs(o) : undefined;
  const km = o?.veiculo ? textoKm(o.veiculo.km) : null;
  const fotos = o ? textoFotos(o.fotos_entrada) : null;
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para ordens de serviço">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{o?.local ? `Oficina · ${o.local}` : 'Oficina'}</div>
          <div className="pd-dtitulo">OS #{o?.numero ?? '…'}</div>
        </div>
        {o && <span className="pd-status" style={{ color: tinta, paddingRight: 8 }}><i style={{ background: tinta }} />{o.etapa.rotulo}</span>}
      </div>
      <div className="oi-scroll">
        {erro && <div className="pd-corpo"><div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div></div>}
        {!o && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {o && (
          <div className="pd-corpo">
            <div className="pd-cartao osd-veiculo">
              {o.veiculo?.placa && <span className="os-placa" aria-label={`Placa ${o.veiculo.placa}`}>{o.veiculo.placa}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="osd-veic-d">{o.veiculo?.descricao ?? 'Sem veículo'}</div>
                <div className="osd-veic-m">{o.cliente.nome}{km && <> · <span className="osd-km">{km}</span></>}</div>
              </div>
            </div>

            {(o.queixa || o.diagnostico) && (
              <>
                <div className="p4-rotulo">Diagnóstico</div>
                <div className="pd-cartao osd-texto">
                  {o.queixa && <div><span>Queixa do cliente</span><p>{o.queixa}</p></div>}
                  {o.queixa && o.diagnostico && <hr />}
                  {o.diagnostico && <div><span>Diagnóstico técnico</span><p>{o.diagnostico}</p></div>}
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
                    {it.detalhe && <div className="pd-item-m">{it.detalhe}</div>}
                  </div>
                  <span className="pd-item-v">{reais(it.valor)}</span>
                </div>
              ))}
              {o.itens.length > 0 && (
                <>
                  <div className="osd-sub"><span>Peças</span><span>{reais(o.totais.pecas)}</span></div>
                  <div className="osd-sub"><span>Mão de obra</span><span>{reais(o.totais.mao_de_obra)}</span></div>
                  <div className="pd-total"><span>Total</span><span>{reais(o.totais.total)}</span></div>
                </>
              )}
            </div>

            {fotos && <p className="p4-legal">{fotos}</p>}
            <p className="p4-legal">No app a OS é só consulta. Link de aprovação, mudar de etapa e faturar ficam no computador.</p>
          </div>
        )}
      </div>
    </>
  );
}
