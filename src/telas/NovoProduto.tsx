// Novo produto — tela 20 do v4: assistente em 3 passos (Dados · Estoque · Fiscal), contrato §9.4.
// Decisão [W] 2026-10-02: criar produto SEM preço, como a tela React de hoje. O produto nasce com o preço
// zerado e o preço se acerta na web; por isso o passo "Preço" do protótipo sai e a tela não grava valor.
// Unidade e categorias vêm do ERP (GET /api/app/produtos/opcoes): não há m²/un/milheiro fixos.
// Até o endpoint do ERP estar em produção, a tela só é oferecida na demo (ESCRITA_PRODUTO).
// Fora de propósito: "origem" (não existe em products) e "Baixar estoque ao concluir a OP".
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { api, camposDoErro, ErroApi, type NovoProduto, type OpcoesProduto } from '../api';
import { Ic } from '../icones';

type Passo = 'dados' | 'estoque' | 'fiscal';
const PASSOS: Array<{ id: Passo; label: string }> = [
  { id: 'dados', label: 'Dados' }, { id: 'estoque', label: 'Estoque' }, { id: 'fiscal', label: 'Fiscal' },
];
/** Campo da API → passo onde ele aparece (um 422 leva de volta ao passo do erro). */
const PASSO_DO_CAMPO: Record<string, Passo> = {
  nome: 'dados', codigo: 'dados', categoria_id: 'dados', unidade_id: 'dados',
  estoque: 'estoque', 'estoque.controla': 'estoque', 'estoque.minimo': 'estoque',
  prateleira: 'estoque', 'prateleira.rack': 'estoque', 'prateleira.fileira': 'estoque', 'prateleira.posicao': 'estoque',
  fiscal: 'fiscal', 'fiscal.ncm': 'fiscal', 'fiscal.cest': 'fiscal', 'fiscal.cfop_interno': 'fiscal', 'fiscal.cfop_externo': 'fiscal',
};

export interface Form {
  nome: string; codigo: string; categoria_id: string; unidade_id: string;
  controla: boolean; minimo: string; rack: string; fileira: string; posicao: string;
  ncm: string; cest: string; cfop_interno: string; cfop_externo: string;
}
export const VAZIO: Form = { nome: '', codigo: '', categoria_id: '', unidade_id: '', controla: true, minimo: '', rack: '', fileira: '', posicao: '',
  ncm: '', cest: '', cfop_interno: '', cfop_externo: '' };

/**
 * Quantidade digitada em pt-BR, até 2 casas: "40", "12,5", "12.5". Milhar NÃO é aceito: separador seguido de
 * 3 dígitos é ambíguo ("1.234"), então volta null e a tela pede de novo. Converte por centésimos inteiros.
 * Sai como número JSON (ponto decimal), que é o que o ERP lê sem passar pelo num_uf.
 */
export function numeroBr(texto: string): number | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(texto.trim());
  if (!m) return null;
  return (Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))) / 100;
}

const ou = (s: string) => (s.trim() ? s.trim() : null);
const digitos = (s: string) => s.replace(/\D/g, '');
/** "fiscal.ncm" fica "fiscal.ncm"; "fiscal.ncm.0" (item de lista) vira "fiscal.ncm". */
export const raiz = (campo: string) => campo.split('.').filter((p) => !/^\d+$/.test(p)).join('.');

/** Conferência local só do que impede salvar; o resto quem decide é o servidor (422). */
export function conferir(f: Form, passo: Passo): Record<string, string> {
  const e: Record<string, string> = {};
  if (passo === 'dados') {
    if (!f.nome.trim()) e.nome = 'Informe o nome do produto.';
    if (!f.unidade_id) e.unidade_id = 'Escolha como o produto é vendido.';
  }
  if (passo === 'estoque' && f.controla && f.minimo.trim() && numeroBr(f.minimo) === null) e['estoque.minimo'] = 'Quantidade inválida. Use até 2 casas, ex.: 12,5.';
  if (passo === 'fiscal') {
    if (digitos(f.ncm) && digitos(f.ncm).length !== 8) e['fiscal.ncm'] = 'O NCM tem 8 dígitos.';
    if (digitos(f.cest) && digitos(f.cest).length !== 7) e['fiscal.cest'] = 'O CEST tem 7 dígitos.';
    if (digitos(f.cfop_interno) && digitos(f.cfop_interno).length !== 4) e['fiscal.cfop_interno'] = 'O CFOP tem 4 dígitos.';
    if (digitos(f.cfop_externo) && digitos(f.cfop_externo).length !== 4) e['fiscal.cfop_externo'] = 'O CFOP tem 4 dígitos.';
  }
  return e;
}

export function corpo(f: Form): NovoProduto {
  const prateleira = { rack: ou(f.rack), fileira: ou(f.fileira), posicao: ou(f.posicao) };
  return {
    nome: f.nome.trim(), codigo: ou(f.codigo), categoria_id: f.categoria_id ? Number(f.categoria_id) : null, unidade_id: Number(f.unidade_id),
    estoque: { controla: f.controla, minimo: f.controla && f.minimo.trim() ? numeroBr(f.minimo) : null },
    // Prateleira só existe para quem controla estoque e só vai se algo foi digitado.
    prateleira: f.controla && Object.values(prateleira).some((v) => v !== null) ? prateleira : null,
    fiscal: { ncm: digitos(f.ncm) || null, cest: digitos(f.cest) || null, cfop_interno: digitos(f.cfop_interno) || null, cfop_externo: digitos(f.cfop_externo) || null },
  };
}

/** Status HTTP de um erro da API ou da demo. */
const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);
const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : (e as { codigo?: string } | null)?.codigo ?? '');

export function NovoProdutoTela({ aoCancelar, aoVerCatalogo, avisar }: {
  aoCancelar: () => void; aoVerCatalogo: () => void;
  avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
}) {
  const [f, setF] = useState<Form>(VAZIO);
  const [passo, setPasso] = useState<Passo>('dados');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesProduto | null>(null);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ nome: string; codigo: string } | null>(null);
  const i = PASSOS.findIndex((p) => p.id === passo);
  const ultimo = i === PASSOS.length - 1;

  useEffect(() => {
    let vivo = true;
    api.opcoesProduto()
      .then((o) => { if (!vivo) return; setOpcoes(o); if (o.unidades.length === 1) setF((x) => ({ ...x, unidade_id: String(o.unidades[0].id) })); })
      .catch((e) => { if (vivo) setErroOpcoes(codigoDe(e) === 'sem_permissao' ? 'Seu usuário não pode cadastrar produtos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); });
    return () => { vivo = false; };
  }, []);

  const unidade = opcoes?.unidades.find((u) => String(u.id) === f.unidade_id);
  const mudar = <K extends keyof Form>(k: K, v: Form[K], campoApi: string = k) => {
    setF((o) => ({ ...o, [k]: v }));
    setErros((o) => { const n = { ...o }; delete n[campoApi]; return n; });
  };

  const avancar = async () => {
    const e = conferir(f, passo);
    setErros(e);
    if (Object.keys(e).length) return;
    if (!ultimo) { setPasso(PASSOS[i + 1].id); return; }
    setSalvando(true);
    try {
      const r = await api.criarProduto(corpo(f));
      avisar('Produto salvo.', 'ok');
      setFeito({ nome: f.nome.trim(), codigo: r.codigo });
    } catch (err) {
      const campos: Record<string, string> = {};
      for (const [k, v] of Object.entries(camposDoErro(err))) campos[raiz(k)] ??= v;
      if (Object.keys(campos).length) {
        setErros(campos);
        const volta = PASSOS.find((p) => Object.keys(campos).some((c) => PASSO_DO_CAMPO[c] === p.id));
        if (volta) setPasso(volta.id);
        // Erro em campo que a tela não mostra: não deixa o toque sem resposta.
        if (!Object.keys(campos).some((c) => c in PASSO_DO_CAMPO)) avisar(Object.values(campos)[0], 'erro');
      } else if (codigoDe(err) === 'sem_permissao' || statusDe(err) === 403) {
        avisar('Seu usuário não pode cadastrar produtos.', 'erro');
      } else {
        avisar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'erro');
      }
    } finally { setSalvando(false); }
  };

  const idErro = (k: string) => 'npr-e-' + k.replace(/\./g, '-');
  const erro = (k: string) => erros[k] && <span id={idErro(k)} className="np-erro">{erros[k]}</span>;
  const campo = (k: keyof Form, rotulo: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, campoApi: string = k) => (
    <div className="p4-campo">
      <label htmlFor={'npr-' + k}>{rotulo}</label>
      <input id={'npr-' + k} value={f[k] as string} onChange={(e) => mudar(k, e.target.value as never, campoApi)}
        aria-invalid={!!erros[campoApi]} aria-describedby={erros[campoApi] ? idErro(campoApi) : undefined} {...extra} />
      {erro(campoApi)}
    </div>
  );

  if (feito) {
    return (
      <>
        <div className="pd-head">
          <div className="p4-rotulo">Produtos · concluído</div>
          <div className="pd-titulo">Novo produto</div>
        </div>
        <div className="oi-scroll">
          <div className="p4-vazio npr-feito" role="status">
            <span className="npr-ok" aria-hidden="true"><Ic.check tamanho={26} /></span>
            <b>Produto cadastrado</b>
            <span>{feito.nome} · código <span className="prd-cod">{feito.codigo}</span></span>
            <span className="np-ajuda">O preço se acerta no oimpresso web.</span>
          </div>
        </div>
        <div className="np-rodape npr-rodape-fim">
          <button className="oi-btn" style={{ minHeight: 44 }} onClick={() => { setF({ ...VAZIO, unidade_id: f.unidade_id }); setPasso('dados'); setErros({}); setFeito(null); }}>Novo produto</button>
          <button className="oi-btn primary" style={{ minHeight: 44 }} onClick={aoVerCatalogo}>Ver catálogo</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pd-head">
        <div className="p4-rotulo">Produtos · passo {i + 1} de {PASSOS.length}</div>
        <div className="pd-titulo">Novo produto</div>
      </div>
      <div className="np-passos" role="list" aria-label="Passos do cadastro">
        {PASSOS.map((p, n) => (
          <button key={p.id} role="listitem" className={'np-passo' + (n < i ? ' feito' : '') + (n === i ? ' on' : '')}
            aria-current={n === i ? 'step' : undefined} disabled={n > i} onClick={() => setPasso(p.id)}>
            <i aria-hidden="true" /><span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo np-form">
          {erroOpcoes && <div className="p4-vazio"><b>Não foi possível abrir o cadastro</b><span>{erroOpcoes}</span></div>}
          {!opcoes && !erroOpcoes && <p className="p4-legal">Carregando…</p>}
          {opcoes && passo === 'dados' && (
            <>
              <div className="p4-campo">
                <label id="npr-l-unidade">Como é vendido</label>
                {opcoes.unidades.length <= 4 ? (
                  <div className="np-papeis" role="radiogroup" aria-labelledby="npr-l-unidade">
                    {opcoes.unidades.map((u) => (
                      <button key={u.id} role="radio" aria-checked={f.unidade_id === String(u.id)} className={'pd-chip' + (f.unidade_id === String(u.id) ? ' on' : '')}
                        onClick={() => mudar('unidade_id', String(u.id))}>{u.nome}</button>
                    ))}
                  </div>
                ) : (
                  <select className="np-select" aria-labelledby="npr-l-unidade" value={f.unidade_id} onChange={(e) => mudar('unidade_id', e.target.value)}
                    aria-invalid={!!erros.unidade_id}>
                    <option value="">Escolha a unidade</option>
                    {opcoes.unidades.map((u) => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
                  </select>
                )}
                {erro('unidade_id')}
              </div>
              {campo('nome', 'Nome', { placeholder: 'Como aparece no catálogo e no pedido' })}
              {campo('codigo', 'Código (opcional)', { autoCapitalize: 'characters', placeholder: 'Em branco, o ERP gera' })}
              <div className="p4-campo">
                <label htmlFor="npr-categoria">Categoria</label>
                <select id="npr-categoria" className="np-select" value={f.categoria_id} onChange={(e) => mudar('categoria_id', e.target.value)}
                  aria-invalid={!!erros.categoria_id}>
                  <option value="">Sem categoria</option>
                  {opcoes.categorias.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
                </select>
                {erro('categoria_id')}
              </div>
              <p className="np-ajuda">O preço não é cadastrado aqui: o produto nasce sem preço e ele se acerta no oimpresso web.</p>
            </>
          )}
          {opcoes && passo === 'estoque' && (
            <>
              <div className="p4-campo">
                <label id="npr-l-controla">Estoque</label>
                <div className="np-seg" role="radiogroup" aria-labelledby="npr-l-controla">
                  <button role="radio" aria-checked={f.controla} className={f.controla ? 'on' : ''} onClick={() => mudar('controla', true, 'estoque.controla')}>Controla estoque</button>
                  <button role="radio" aria-checked={!f.controla} className={!f.controla ? 'on' : ''} onClick={() => mudar('controla', false, 'estoque.controla')}>Sob demanda</button>
                </div>
                {erro('estoque.controla')}
              </div>
              {f.controla ? (
                <>
                  {campo('minimo', `Estoque mínimo${unidade ? ` (${unidade.curta})` : ''}`, { inputMode: 'decimal', placeholder: 'Ex.: 40' }, 'estoque.minimo')}
                  <p className="np-ajuda">Abaixo disso o produto aparece como estoque baixo no catálogo.</p>
                  <div className="p4-rotulo">Prateleira na sua loja</div>
                  <div className="npr-prateleira">
                    {campo('rack', 'Rack', { autoCapitalize: 'characters', placeholder: 'A' }, 'prateleira.rack')}
                    {campo('fileira', 'Fileira', { placeholder: '3' }, 'prateleira.fileira')}
                    {campo('posicao', 'Posição', { placeholder: '1' }, 'prateleira.posicao')}
                  </div>
                </>
              ) : <p className="np-ajuda">Produzido sob encomenda: o app não mostra saldo e não baixa estoque.</p>}
            </>
          )}
          {opcoes && passo === 'fiscal' && (
            <>
              {campo('ncm', 'NCM', { inputMode: 'numeric', placeholder: '3919.90.00' }, 'fiscal.ncm')}
              {campo('cest', 'CEST (opcional)', { inputMode: 'numeric', placeholder: '7 dígitos' }, 'fiscal.cest')}
              <div className="np-linha2 npr-cfop">
                {campo('cfop_interno', 'CFOP no estado', { inputMode: 'numeric', placeholder: '5102' }, 'fiscal.cfop_interno')}
                {campo('cfop_externo', 'CFOP fora', { inputMode: 'numeric', placeholder: '6102' }, 'fiscal.cfop_externo')}
              </div>
              <p className="np-ajuda">Em branco, a nota usa o padrão fiscal da empresa.</p>
            </>
          )}
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando}
          onClick={() => (i === 0 ? aoCancelar() : setPasso(PASSOS[i - 1].id))}>{i === 0 ? 'Cancelar' : 'Voltar'}</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando || !opcoes} onClick={avancar}>
          {salvando ? 'Salvando…' : ultimo ? 'Salvar produto' : 'Continuar'}
        </button>
      </div>
    </>
  );
}
