// Pessoas — desenho v4 (telas 17 Pessoas · 18 Ficha do cliente), dados pelo contrato
// API-CONTRATO-v1 §4 (ERP #8497). "+ Nova" abre a tela 09 (NovaPessoa.tsx) e "Dados cadastrais" a tela 34
// (PessoaCadastro.tsx). Fora do v4 de propósito "Editar" e "Novo pedido" — não estão no contrato. Os chips seguem o contrato
// (Todos/Clientes/Fornecedores/Funcionários/Em débito), não os do protótipo (PJ/PF).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroPessoas, type ListaPessoas, type PapelPessoa, type PessoaDetalhe, type PessoaResumo } from '../api';
import { useVoltar } from '../voltar';
import { reais } from './Pedidos';
import { Cadastro } from './PessoaCadastro';
import { Ic } from '../icones';
import { NovaPessoaTela } from './NovaPessoa';

const FILTROS: Array<{ id: FiltroPessoas; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'clientes', label: 'Clientes' }, { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'funcionarios', label: 'Funcionários' }, { id: 'em_debito', label: 'Em débito' },
];
const PAPEL: Record<PapelPessoa, string> = { cliente: 'Cliente', fornecedor: 'Fornecedor', funcionario: 'Funcionário' };
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const letra = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase() || '#';

export function Pessoas({ voltar, avisar }: { voltar?: ReactNode; avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [cadastro, setCadastro] = useState(false);
  const [nova, setNova] = useState(false);
  useVoltar(aberto !== null, () => setAberto(null));
  // Registrado depois do da ficha: o voltar fecha os dados cadastrais primeiro.
  useVoltar(aberto !== null && cadastro, () => setCadastro(false));
  useVoltar(nova, () => setNova(false));
  if (nova) {
    return <NovaPessoaTela avisar={avisar} aoCancelar={() => setNova(false)}
      aoSalvar={(id) => { setNova(false); setCadastro(false); setAberto(id); }} />;
  }
  if (aberto !== null && cadastro) return <Cadastro id={aberto} avisar={avisar} aoVoltar={() => setCadastro(false)} />;
  return aberto !== null
    ? <Ficha id={aberto} aoVoltar={() => setAberto(null)} aoAbrirCadastro={() => setCadastro(true)} />
    : <Lista aoAbrir={(id) => { setCadastro(false); setAberto(id); }} aoNova={() => setNova(true)} voltar={voltar} />;
}

function Lista({ aoAbrir, aoNova, voltar }: { aoAbrir: (id: number) => void; aoNova: () => void; voltar?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroPessoas>('todos');
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<ListaPessoas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // A busca vai ao servidor só depois de uma pausa na digitação.
  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const carregar = useCallback(async (f: FiltroPessoas, busca: string) => {
    setErro(null);
    try { setDados(await api.pessoas(f, 1, busca)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso às pessoas.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { setDados(null); carregar(filtro, q); }, [filtro, q, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.pessoas(filtro, dados.pagina + 1, q);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const grupos: Array<{ letra: string; itens: PessoaResumo[] }> = [];
  for (const p of dados?.itens ?? []) {
    const l = letra(p.nome);
    const g = grupos.find((x) => x.letra === l);
    if (g) g.itens.push(p); else grupos.push({ letra: l, itens: [p] });
  }
  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{c ? `${c.todos} ${c.todos === 1 ? 'cadastrada' : 'cadastradas'}` : 'Pessoas'}</div>
            <div className="pd-titulo">Pessoas</div>
          </div>
          <button className="np-nova" onClick={aoNova}>+ Nova</button>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome, documento, telefone…" aria-label="Buscar pessoa" enterKeyHint="search" />
          </label>
          <div className="pd-chips" role="tablist" aria-label="Papel da pessoa">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Ninguém encontrado</b><span>{q ? 'Tente outro nome ou telefone.' : 'Troque o filtro para ver outras pessoas.'}</span></div>
          )}
          {grupos.map((g) => (
            <section key={g.letra} className="ps-grupo" aria-label={g.letra}>
              <span className="ps-letra">{g.letra}</span>
              <div className="p4-lista">
                {g.itens.map((p) => (
                  <button key={p.id} className="ps-linha" onClick={() => aoAbrir(p.id)}>
                    <span className="pd-avatar" aria-hidden="true">{iniciais(p.nome)}</span>
                    <span className="ps-texto">
                      <b>{p.nome}</b>
                      <small>{p.papeis.map((x) => PAPEL[x]).join(' · ') || 'Sem papel'}{!p.ativo && ' · inativo'}</small>
                      {p.saldo_aberto > 0 && <span className="ps-debito">em aberto {reais(p.saldo_aberto)}</span>}
                    </span>
                    {p.tipo && <span className="ps-tipo">{p.tipo}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}

function Ficha({ id, aoVoltar, aoAbrirCadastro }: { id: number; aoVoltar: () => void; aoAbrirCadastro: () => void }) {
  const [p, setP] = useState<PessoaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { api.pessoa(id).then(setP).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')); }, [id]);

  const fone = p?.contato.telefone?.replace(/\D/g, '') ?? '';
  const whats = fone ? `https://wa.me/${fone.length <= 11 ? '55' + fone : fone}` : '';
  const local = p ? [p.endereco.cidade, p.endereco.uf].filter(Boolean).join(' / ') : '';
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para pessoas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{p?.tipo === 'PJ' ? 'Pessoa jurídica' : p?.tipo === 'PF' ? 'Pessoa física' : 'Pessoa'}</div>
          <div className="pd-dtitulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.nome ?? '…'}</div>
        </div>
      </div>
      <div className="oi-scroll">
        {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
        {!p && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {p && (
          <div className="pd-corpo">
            <div className="ps-topo">
              <span className="pd-avatar" aria-hidden="true">{iniciais(p.nome)}</span>
              <span className="ps-nome">{p.nome}</span>
              {p.documento && <span className="ps-doc">{p.documento}</span>}
              <div className="ps-papeis">{p.papeis.map((x) => <span key={x} className="ps-papel">{PAPEL[x]}</span>)}{!p.ativo && <span className="ps-papel">Inativo</span>}</div>
              <div className="ps-acoes">
                <a href={whats || undefined} aria-disabled={!whats} target="_blank" rel="noreferrer">WhatsApp</a>
                <a href={fone ? `tel:${fone}` : undefined} aria-disabled={!fone}>Ligar</a>
                <a href={p.contato.email ? `mailto:${p.contato.email}` : undefined} aria-disabled={!p.contato.email}>E-mail</a>
              </div>
            </div>

            <div className="ps-kpis">
              <div className="ps-kpi"><span>Pedidos</span><b>{p.kpis.pedidos}</b></div>
              <div className="ps-kpi"><span>Ticket</span><b>{p.kpis.pedidos ? reais(p.kpis.ticket_medio) : '—'}</b></div>
              <div className="ps-kpi"><span>Em aberto</span><b className={p.kpis.saldo_aberto > 0 ? 'debito' : ''}>{p.kpis.saldo_aberto > 0 ? reais(p.kpis.saldo_aberto) : '—'}</b></div>
            </div>

            <div className="p4-lista">
              <button className="ms-linha" onClick={aoAbrirCadastro}>
                <span className="ms-ico"><Ic.pedido tamanho={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><b>Dados cadastrais</b><small>Documento, endereço fiscal, comercial e LGPD</small></span>
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <div className="p4-rotulo">Contato</div>
            <div className="p4-lista">
              <div className="ps-dado"><span>Telefone</span><b style={{ fontFamily: 'var(--font-mono)' }}>{p.contato.telefone ?? '—'}</b></div>
              <div className="ps-dado"><span>E-mail</span><b>{p.contato.email ?? '—'}</b></div>
              <div className="ps-dado"><span>Cidade</span><b>{local || '—'}</b></div>
            </div>

            <div className="p4-rotulo">Pedidos recentes</div>
            <div className="p4-lista">
              {p.pedidos_recentes.length === 0 && <div className="ps-dado" style={{ justifyContent: 'center' }}><span style={{ width: 'auto' }}>Sem pedidos ainda</span></div>}
              {p.pedidos_recentes.map((x) => (
                <div key={x.id} className="pd-item">
                  <div style={{ flex: 1, minWidth: 0 }}><div className="pd-item-d">#{x.numero}</div><div className="pd-item-m">{x.data.split('-').reverse().join('/')}</div></div>
                  <span className="pd-item-v">{reais(x.valor)}</span>
                </div>
              ))}
            </div>
            <p className="p4-legal">Editar o cadastro continua no computador.</p>
          </div>
        )}
      </div>
    </>
  );
}
