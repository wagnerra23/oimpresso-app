// Nova OS — escrita da Onda D, aberta pelo "+ Nova OS" da lista (tela 07). O protótipo não tem tela própria
// (o botão leva ao detalhe), então o formulário segue o padrão das telas de cadastro do app.
// Rota POST /api/app/os (contrato tela-07, ERP #8639), ligada por NOVA_OS. O ERP fixa tipo mecânica, situação
// aberta, entrada agora e a empresa do usuário, e põe a OS na Recepção: abrir OS não gera item, valor nem
// estoque. Fora de propósito: criar veículo (fica na web), combustível, avarias e mecânico responsável.
import { useEffect, useState } from 'react';
import { api, camposDoErro, ErroApi, type OsDetalhe, type PessoaResumo, type VeiculoResumo } from '../api';
import { useVoltar } from '../voltar';
import { Placa } from './Veiculos';

/**
 * Km digitado: só inteiro, com ou sem ponto de milhar ("48312" ou "48.312"). Vazio = null (não informado).
 * Qualquer outra coisa (vírgula, letra, ponto fora do milhar) = 'invalido'.
 */
export function kmDigitado(texto: string): number | null | 'invalido' {
  const t = texto.trim();
  if (!t) return null;
  if (/^[0-9]+$/.test(t) || /^[0-9]{1,3}(\.[0-9]{3})+$/.test(t)) return Number(t.split('.').join(''));
  return 'invalido';
}

/** Texto livre opcional: em branco vira null. */
export const textoOuNulo = (t: string): string | null => (t.trim() ? t.trim() : null);

type Cliente = { id: number; nome: string } | null;
type Modo = 'form' | 'veiculo' | 'cliente';

interface Props {
  aoVoltar: () => void; aoCriar: (os: OsDetalhe) => void;
  avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
}

export function NovaOs({ aoVoltar, aoCriar, avisar }: Props) {
  const [modo, setModo] = useState<Modo>('veiculo');
  const [veiculo, setVeiculo] = useState<VeiculoResumo | null>(null);
  const [cliente, setCliente] = useState<Cliente>(null);
  const [km, setKm] = useState('');
  const [box, setBox] = useState('');
  const [obs, setObs] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  // Voltar do Android: da busca volta ao formulário; do formulário, sai.
  useVoltar(modo !== 'form' && veiculo !== null, () => setModo('form'));

  const escolherVeiculo = (v: VeiculoResumo) => {
    setVeiculo(v);
    // O dono do veículo é o cliente sugerido da OS (dá para trocar ou tirar).
    setCliente(v.cliente_id && v.cliente ? { id: v.cliente_id, nome: v.cliente } : null);
    setErros((e) => ({ ...e, vehicle_id: '' }));
    setModo('form');
  };

  const salvar = async () => {
    if (!veiculo) { setErros({ vehicle_id: 'Escolha o veículo.' }); return; }
    const k = kmDigitado(km);
    if (k === 'invalido') { setErros({ mileage_at_service: 'Digite só números, ex.: 48312.' }); return; }
    setSalvando(true); setErros({});
    try {
      const os = await api.criarOs({ vehicle_id: veiculo.id, contact_id: cliente?.id ?? null, mileage_at_service: k,
        box_label: textoOuNulo(box), notes: textoOuNulo(obs) });
      avisar?.(`${os.numero} aberta na ${os.etapa?.rotulo ?? 'oficina'}`);
      aoCriar(os);
    } catch (e) {
      const campos = camposDoErro(e);
      setErros(campos);
      if (!Object.keys(campos).length) avisar?.(e instanceof ErroApi && e.status === 403 ? 'Seu usuário não pode abrir OS.'
        : e instanceof ErroApi && e.status === 503 ? 'A oficina ainda não está configurada nesta empresa.'
        : e instanceof Error ? e.message : 'Não foi possível abrir a OS.', 'erro');
    } finally { setSalvando(false); }
  };

  if (modo === 'veiculo') return <BuscaVeiculo aoEscolher={escolherVeiculo} aoVoltar={veiculo ? () => setModo('form') : aoVoltar} />;
  if (modo === 'cliente') return <BuscaCliente aoEscolher={(c) => { setCliente(c); setModo('form'); }} aoVoltar={() => setModo('form')} />;

  const erro = (k: string) => erros[k] ? <span id={'nos-e-' + k} className="np-erro">{erros[k]}</span> : null;
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Cancelar e voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">Oficina</div>
          <div className="pd-dtitulo">Nova OS</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="p4-rotulo">Veículo</div>
          {veiculo ? (
            <button className="pd-cartao nos-escolha" onClick={() => setModo('veiculo')}>
              <Placa placa={veiculo.placa} />
              <span className="os-texto"><b>{veiculo.descricao ?? 'Veículo'}</b><small>{veiculo.cliente ?? 'Sem dono cadastrado'}</small></span>
              <span className="nos-trocar">Trocar</span>
            </button>
          ) : <button className="oi-btn block" style={{ minHeight: 44 }} onClick={() => setModo('veiculo')}>Escolher veículo</button>}
          {erro('vehicle_id')}

          <div className="p4-rotulo">Cliente da OS</div>
          <div className="pd-cartao nos-escolha nos-cliente">
            <span className="os-texto">
              <b>{cliente?.nome ?? 'Sem cliente'}</b>
              <small>{cliente && veiculo?.cliente_id === cliente.id ? 'Dono do veículo' : cliente ? 'Outro cliente' : 'A OS fica sem cliente'}</small>
            </span>
            <span className="nos-bts">
              <button className="nos-link" onClick={() => setModo('cliente')}>Trocar</button>
              {cliente && <button className="nos-link" onClick={() => setCliente(null)}>Tirar</button>}
            </span>
          </div>
          {erro('contact_id')}

          <div className="p4-campo">
            <label htmlFor="nos-km">Km na entrada (opcional)</label>
            <input id="nos-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)}
              placeholder={veiculo?.km ? `Último: ${veiculo.km.toLocaleString('pt-BR')}` : 'Ex.: 48312'}
              aria-invalid={!!erros.mileage_at_service} aria-describedby={erros.mileage_at_service ? 'nos-e-mileage_at_service' : undefined} />
            {erro('mileage_at_service')}
          </div>
          <div className="p4-campo">
            <label htmlFor="nos-box">Box ou elevador (opcional)</label>
            <input id="nos-box" value={box} onChange={(e) => setBox(e.target.value)} placeholder="Ex.: Elevador 1" maxLength={60} className="nos-texto-livre"
              aria-invalid={!!erros.box_label} />
            {erro('box_label')}
          </div>
          <div className="p4-campo">
            <label htmlFor="nos-obs">Observações (opcional)</label>
            <textarea id="nos-obs" className="nos-obs" rows={4} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="O que o cliente relatou" maxLength={2000} />
            {erro('notes')}
          </div>
          <p className="np-ajuda">A OS abre na Recepção, sem itens. Orçamento, peças e serviços se lançam no computador.</p>
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando} onClick={aoVoltar}>Cancelar</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando || !veiculo} onClick={salvar}>{salvando ? 'Abrindo…' : 'Abrir OS'}</button>
      </div>
    </>
  );
}

function Cabecalho({ titulo, aoVoltar }: { titulo: string; aoVoltar: () => void }) {
  return (
    <div className="pd-dhead">
      <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="p4-rotulo">Nova OS</div>
        <div className="pd-dtitulo">{titulo}</div>
      </div>
    </div>
  );
}

/** Busca de veículo (mesma rota da tela 08). Veículo novo continua sendo cadastrado na web. */
function BuscaVeiculo({ aoEscolher, aoVoltar }: { aoEscolher: (v: VeiculoResumo) => void; aoVoltar: () => void }) {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<VeiculoResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setErro(null);
      api.veiculos(1, texto.trim()).then((r) => setItens(r.itens)).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível buscar.'));
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);
  return (
    <>
      <Cabecalho titulo="Escolher veículo" aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Placa, tipo ou dono" aria-label="Buscar veículo" enterKeyHint="search" autoFocus />
          </label>
          {erro && <div className="p4-vazio"><b>Não foi possível buscar</b><span>{erro}</span></div>}
          {!itens && !erro && <p className="p4-legal">Carregando…</p>}
          {itens && itens.length === 0 && <div className="p4-vazio"><b>Nenhum veículo encontrado</b><span>Veículo novo se cadastra no oimpresso web.</span></div>}
          {itens && itens.length > 0 && (
            <div className="p4-lista">
              {itens.map((v) => (
                <button key={v.id} className="nos-linha" onClick={() => aoEscolher(v)}>
                  <Placa placa={v.placa} />
                  <span className="os-texto"><b>{v.descricao ?? 'Veículo'}</b><small>{v.cliente ?? 'Sem dono cadastrado'}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Busca de cliente (mesma rota da tela Pessoas, só clientes). */
function BuscaCliente({ aoEscolher, aoVoltar }: { aoEscolher: (c: Cliente) => void; aoVoltar: () => void }) {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<PessoaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setErro(null);
      api.pessoas('clientes', 1, texto.trim()).then((r) => setItens(r.itens)).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível buscar.'));
    }, 350);
    return () => clearTimeout(t);
  }, [texto]);
  return (
    <>
      <Cabecalho titulo="Escolher cliente" aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome do cliente" aria-label="Buscar cliente" enterKeyHint="search" autoFocus />
          </label>
          {erro && <div className="p4-vazio"><b>Não foi possível buscar</b><span>{erro}</span></div>}
          {!itens && !erro && <p className="p4-legal">Carregando…</p>}
          {itens && itens.length === 0 && <div className="p4-vazio"><b>Nenhum cliente encontrado</b><span>Cliente novo se cadastra em Mais → Pessoas.</span></div>}
          {itens && itens.length > 0 && (
            <div className="p4-lista">
              {itens.map((p) => (
                <button key={p.id} className="nos-linha" onClick={() => aoEscolher({ id: p.id, nome: p.nome })}>
                  <span className="os-texto"><b>{p.nome}</b>{p.tipo && <small>{p.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</small>}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
