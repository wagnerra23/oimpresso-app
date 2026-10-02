// Novo produto — tela 20 do v4: assistente em 4 passos (Dados · Preço · Estoque · Fiscal).
// Formato PROVISÓRIO: o ERP ainda mede o caminho da web (ProductUtil) antes de fechar o POST. Até lá
// a tela só é oferecida na demo (ESCRITA_PRODUTO), e a demo faz o papel do ERP.
// Regra mestre (valor): o app NÃO calcula o preço de venda. Ele manda custo e margem como digitados
// (2 casas, sem float ambíguo) e mostra o preço que o ERP devolve na prévia e no 201.
// Fora de propósito por enquanto: o "Exemplo 1,20 × 0,80 m" do protótipo (é cálculo de valor) e o
// "Baixar estoque ao concluir a OP" (o ERP ainda não disse onde isso mora).
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { api, camposDoErro, ErroApi, type NovoProduto, type VendaProduto } from '../api';
import { reais } from './Pedidos';
import { Ic } from '../icones';

type Passo = 'dados' | 'preco' | 'estoque' | 'fiscal';
const PASSOS: Array<{ id: Passo; label: string }> = [
  { id: 'dados', label: 'Dados' }, { id: 'preco', label: 'Preço' }, { id: 'estoque', label: 'Estoque' }, { id: 'fiscal', label: 'Fiscal' },
];
/** Campo da API → passo onde ele aparece (um 422 leva de volta ao passo do erro). */
const PASSO_DO_CAMPO: Record<string, Passo> = {
  nome: 'dados', codigo: 'dados', categoria_id: 'dados', venda: 'dados',
  custo: 'preco', margem: 'preco',
  estoque: 'estoque', 'estoque.controla': 'estoque', 'estoque.minimo': 'estoque', 'estoque.prateleira': 'estoque',
  'estoque.prateleira.rack': 'estoque', 'estoque.prateleira.fileira': 'estoque', 'estoque.prateleira.posicao': 'estoque',
  fiscal: 'fiscal', 'fiscal.ncm': 'fiscal', 'fiscal.cfop': 'fiscal', 'fiscal.origem': 'fiscal',
};
const VENDAS: Array<{ v: VendaProduto; label: string; unidade: string }> = [
  { v: 'm2', label: 'Por m²', unidade: 'm²' }, { v: 'un', label: 'Por unidade', unidade: 'un' }, { v: 'mil', label: 'Milheiro', unidade: 'mil' },
];
const MARGENS = [80, 100, 120, 150];
const ORIGENS: Array<[number, string]> = [
  [0, '0 · Nacional'], [1, '1 · Estrangeira, importação direta'], [2, '2 · Estrangeira, mercado interno'],
  [3, '3 · Nacional, mais de 40% importado'], [4, '4 · Nacional, processo produtivo básico'], [5, '5 · Nacional, até 40% importado'],
  [6, '6 · Estrangeira direta, sem similar (CAMEX)'], [7, '7 · Estrangeira interna, sem similar (CAMEX)'], [8, '8 · Nacional, mais de 70% importado'],
];

export interface Form {
  nome: string; codigo: string; categoria_id: string; venda: VendaProduto;
  custo: string; margem: string;
  controla: boolean; minimo: string; rack: string; fileira: string; posicao: string;
  ncm: string; cfop: string; origem: string;
}
export const VAZIO: Form = { nome: '', codigo: '', categoria_id: '', venda: 'm2', custo: '', margem: '',
  controla: true, minimo: '', rack: '', fileira: '', posicao: '', ncm: '', cfop: '', origem: '0' };

/**
 * Número digitado em pt-BR, com até 2 casas: "18,40", "18.4", "1234". Milhar NÃO é aceito: separador seguido
 * de 3 dígitos é ambíguo ("1.234" pode ser mil e pouco ou um e pouco), então volta null e a tela pede de novo.
 * Converte por centavos inteiros, sem conta em ponto flutuante: "18,40" → 18.4 (vai como 18.40 no JSON).
 */
export function numeroBr(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, '');
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return centavos / 100;
}

const ou = (s: string) => (s.trim() ? s.trim() : null);
/** "estoque.minimo" fica em "estoque.minimo"; "fiscal.ncm.0" (item de lista) vira "fiscal.ncm". */
export const raiz = (campo: string) => campo.split('.').filter((p) => !/^\d+$/.test(p)).join('.');

/** Conferência local só do que impede salvar; o resto quem decide é o servidor (422). */
export function conferir(f: Form, passo: Passo): Record<string, string> {
  const e: Record<string, string> = {};
  if (passo === 'dados' && !f.nome.trim()) e.nome = 'Informe o nome do produto.';
  if (passo === 'preco') {
    if (f.custo.trim() && numeroBr(f.custo) === null) e.custo = 'Valor inválido. Use vírgula para os centavos, ex.: 18,40.';
    if (f.margem.trim() && numeroBr(f.margem) === null) e.margem = 'Margem inválida. Use até 2 casas, ex.: 100 ou 87,5.';
    if (f.margem.trim() && !f.custo.trim()) e.custo = 'Informe o custo para aplicar a margem.';
  }
  if (passo === 'estoque' && f.controla && f.minimo.trim() && numeroBr(f.minimo) === null) e['estoque.minimo'] = 'Quantidade inválida.';
  if (passo === 'fiscal') {
    const ncm = f.ncm.replace(/\D/g, '');
    if (ncm && ncm.length !== 8) e['fiscal.ncm'] = 'O NCM tem 8 dígitos.';
    const cfop = f.cfop.replace(/\D/g, '');
    if (cfop && cfop.length !== 4) e['fiscal.cfop'] = 'O CFOP tem 4 dígitos.';
  }
  return e;
}

export function corpo(f: Form): NovoProduto {
  return {
    nome: f.nome.trim(), codigo: ou(f.codigo), categoria_id: f.categoria_id ? Number(f.categoria_id) : null, venda: f.venda,
    custo: f.custo.trim() ? numeroBr(f.custo) : null, margem: f.margem.trim() ? numeroBr(f.margem) : null,
    estoque: {
      controla: f.controla, minimo: f.controla && f.minimo.trim() ? numeroBr(f.minimo) : null,
      prateleira: f.controla ? { rack: ou(f.rack), fileira: ou(f.fileira), posicao: ou(f.posicao) } : { rack: null, fileira: null, posicao: null },
    },
    fiscal: { ncm: f.ncm.replace(/\D/g, '') || null, cfop: f.cfop.replace(/\D/g, '') || null, origem: f.origem === '' ? null : Number(f.origem) },
  };
}

/** Status HTTP de um erro da API ou da demo. */
const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);
const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : (e as { codigo?: string } | null)?.codigo ?? '');

export function NovoProdutoTela({ aoCancelar, aoVerCatalogo, avisar, categorias }: {
  aoCancelar: () => void; aoVerCatalogo: () => void;
  avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Categorias que o catálogo (tela 19) já trouxe. */
  categorias: Array<{ id: number; nome: string }>;
}) {
  const [f, setF] = useState<Form>(VAZIO);
  const [passo, setPasso] = useState<Passo>('dados');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<{ preco: number | null; carregando: boolean; erro: string | null }>({ preco: null, carregando: false, erro: null });
  const [feito, setFeito] = useState<{ nome: string; preco: number | null } | null>(null);
  const i = PASSOS.findIndex((p) => p.id === passo);
  const ultimo = i === PASSOS.length - 1;
  const unidade = VENDAS.find((v) => v.v === f.venda)?.unidade ?? '';

  const mudar = <K extends keyof Form>(k: K, v: Form[K], campoApi: string = k) => {
    setF((o) => ({ ...o, [k]: v }));
    setErros((o) => { const n = { ...o }; delete n[campoApi]; return n; });
  };

  // Prévia do preço: quem calcula é o ERP. O app só pede depois de uma pausa e mostra o que voltar.
  const custo = numeroBr(f.custo), margem = numeroBr(f.margem);
  useEffect(() => {
    if (passo !== 'preco' || custo === null || margem === null) { setPrevia({ preco: null, carregando: false, erro: null }); return; }
    let vivo = true;
    setPrevia((p) => ({ ...p, carregando: true, erro: null }));
    const t = setTimeout(async () => {
      try { const r = await api.previaPrecoProduto(custo, margem); if (vivo) setPrevia({ preco: r.preco, carregando: false, erro: null }); }
      catch (e) { if (vivo) setPrevia({ preco: null, carregando: false, erro: e instanceof Error ? e.message : 'Não foi possível calcular agora.' }); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [passo, custo, margem]);

  const avancar = async () => {
    const e = conferir(f, passo);
    setErros(e);
    if (Object.keys(e).length) return;
    if (!ultimo) { setPasso(PASSOS[i + 1].id); return; }
    setSalvando(true);
    try {
      const r = await api.criarProduto(corpo(f));
      avisar('Produto salvo.', 'ok');
      setFeito({ nome: f.nome.trim(), preco: r.preco });
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

  const erro = (k: string) => erros[k] && <span id={'npr-e-' + k.replace(/\./g, '-')} className="np-erro">{erros[k]}</span>;
  const campo = (k: keyof Form, rotulo: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, campoApi: string = k) => (
    <div className="p4-campo">
      <label htmlFor={'npr-' + k}>{rotulo}</label>
      <input id={'npr-' + k} value={f[k] as string} onChange={(e) => mudar(k, e.target.value as never, campoApi)}
        aria-invalid={!!erros[campoApi]} aria-describedby={erros[campoApi] ? 'npr-e-' + campoApi.replace(/\./g, '-') : undefined} {...extra} />
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
            <span>{feito.nome}{feito.preco !== null ? ` · ${reais(feito.preco)}/${unidade}` : ''}</span>
          </div>
        </div>
        <div className="np-rodape npr-rodape-fim">
          <button className="oi-btn" style={{ minHeight: 44 }} onClick={() => { setF(VAZIO); setPasso('dados'); setErros({}); setFeito(null); }}>Novo produto</button>
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
          {passo === 'dados' && (
            <>
              <div className="p4-campo">
                <label id="npr-l-venda">Como é vendido</label>
                <div className="np-seg tres" role="radiogroup" aria-labelledby="npr-l-venda">
                  {VENDAS.map((v) => (
                    <button key={v.v} role="radio" aria-checked={f.venda === v.v} className={f.venda === v.v ? 'on' : ''} onClick={() => mudar('venda', v.v)}>{v.label}</button>
                  ))}
                </div>
                {erro('venda')}
              </div>
              {campo('nome', 'Nome', { placeholder: 'Como aparece no catálogo e no pedido' })}
              {campo('codigo', 'Código (opcional)', { autoCapitalize: 'characters', placeholder: 'Em branco, o ERP gera' })}
              <div className="p4-campo">
                <label htmlFor="npr-categoria">Categoria</label>
                <select id="npr-categoria" className="np-select" value={f.categoria_id} onChange={(e) => mudar('categoria_id', e.target.value)}
                  aria-invalid={!!erros.categoria_id}>
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
                </select>
                {erro('categoria_id')}
              </div>
            </>
          )}
          {passo === 'preco' && (
            <>
              <div className="p4-rotulo">Cálculo por {unidade}</div>
              <div className="np-linha2 npr-preco">
                {campo('custo', `Custo por ${unidade}`, { inputMode: 'decimal', placeholder: '0,00' })}
                {campo('margem', 'Margem (%)', { inputMode: 'decimal', placeholder: '0' })}
              </div>
              <div className="np-papeis" role="group" aria-label="Margens comuns">
                {MARGENS.map((m) => (
                  <button key={m} className={'pd-chip' + (numeroBr(f.margem) === m ? ' on' : '')} aria-pressed={numeroBr(f.margem) === m}
                    onClick={() => mudar('margem', String(m))}>{m}%</button>
                ))}
              </div>
              <div className="npr-venda" aria-live="polite">
                <span>Preço de venda</span>
                <b>{previa.carregando ? '…' : previa.preco !== null ? `${reais(previa.preco)}/${unidade}` : '—'}</b>
              </div>
              <p className="np-ajuda">{previa.erro ?? 'Calculado pelo ERP com o custo e a margem, como na web. Sem custo, o preço fica para a web.'}</p>
            </>
          )}
          {passo === 'estoque' && (
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
                  {campo('minimo', `Estoque mínimo (${unidade})`, { inputMode: 'decimal', placeholder: 'Ex.: 40' }, 'estoque.minimo')}
                  <p className="np-ajuda">Abaixo disso o produto aparece como estoque baixo no catálogo.</p>
                  <div className="p4-rotulo">Prateleira</div>
                  <div className="npr-prateleira">
                    {campo('rack', 'Rack', { autoCapitalize: 'characters', placeholder: 'A' }, 'estoque.prateleira.rack')}
                    {campo('fileira', 'Fileira', { placeholder: '3' }, 'estoque.prateleira.fileira')}
                    {campo('posicao', 'Posição', { placeholder: '1' }, 'estoque.prateleira.posicao')}
                  </div>
                </>
              ) : <p className="np-ajuda">Produzido sob encomenda: o app não mostra saldo e não baixa estoque.</p>}
            </>
          )}
          {passo === 'fiscal' && (
            <>
              {campo('ncm', 'NCM', { inputMode: 'numeric', placeholder: '3919.90.00' }, 'fiscal.ncm')}
              {campo('cfop', 'CFOP padrão', { inputMode: 'numeric', placeholder: '5102' }, 'fiscal.cfop')}
              <div className="p4-campo">
                <label htmlFor="npr-origem">Origem</label>
                <select id="npr-origem" className="np-select" value={f.origem} onChange={(e) => mudar('origem', e.target.value, 'fiscal.origem')}
                  aria-invalid={!!erros['fiscal.origem']}>
                  {ORIGENS.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}
                </select>
                {erro('fiscal.origem')}
              </div>
              <p className="np-ajuda">Em branco, a nota usa o padrão fiscal da empresa.</p>
            </>
          )}
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando}
          onClick={() => (i === 0 ? aoCancelar() : setPasso(PASSOS[i - 1].id))}>{i === 0 ? 'Cancelar' : 'Voltar'}</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando} onClick={avancar}>
          {salvando ? 'Salvando…' : ultimo ? 'Salvar produto' : 'Continuar'}
        </button>
      </div>
    </>
  );
}
