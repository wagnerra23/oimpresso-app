// Nova pessoa — tela 09 do v4 (assistente em 5 passos: Dados · Contato · Endereço · Comercial · LGPD),
// POST /api/app/pessoas, contrato §4.2 (ERP #8559). Obrigatórios: tipo, nome e papeis.
// Fora de propósito: papel "Funcionário", limite de crédito, classificação ABC, SMS e WhatsApp em
// número separado (o ERP só tem o telefone). "Buscar" do CEP: GET /api/app/cep/{cep} (§4.3, ERP #8560)
// preenche o endereço e o codigo_ibge; se o CEP não existe ou o serviço falha, o endereço é digitado.
import { useState, type InputHTMLAttributes } from 'react';
import { api, camposDoErro, ErroApi, type EdicaoPessoa, type EnderecoCep, type NovaPessoa, type PessoaCadastro } from '../api';

type Passo = 'dados' | 'contato' | 'endereco' | 'comercial' | 'lgpd';
const PASSOS: Array<{ id: Passo; label: string }> = [
  { id: 'dados', label: 'Dados' }, { id: 'contato', label: 'Contato' }, { id: 'endereco', label: 'Endereço' },
  { id: 'comercial', label: 'Comercial' }, { id: 'lgpd', label: 'LGPD' },
];
/** Campo da API → passo onde ele aparece (um 422 leva de volta ao passo do erro). */
const PASSO_DO_CAMPO: Record<string, Passo> = {
  papeis: 'dados', tipo: 'dados', nome: 'dados', nome_fantasia: 'dados', documento: 'dados', indicador_ie: 'dados',
  telefone: 'contato', email: 'contato', email_nfe: 'contato',
  cep: 'endereco', logradouro: 'endereco', numero: 'endereco', complemento: 'endereco', bairro: 'endereco',
  cidade: 'endereco', uf: 'endereco', codigo_ibge: 'endereco', prazo_padrao_dias: 'comercial', consentimento: 'lgpd',
};
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const IE: Array<{ v: '1' | '2' | '9'; label: string }> = [
  { v: '1', label: 'Contribuinte de ICMS' }, { v: '2', label: 'Isento de inscrição' }, { v: '9', label: 'Não contribuinte' },
];
type Sim = '' | 'sim' | 'nao';

export interface Form {
  tipo: 'PF' | 'PJ'; nome: string; nome_fantasia: string; documento: string; indicador_ie: '' | '1' | '2' | '9';
  cliente: boolean; fornecedor: boolean;
  telefone: string; email: string; email_nfe: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string;
  /** Vem só do "Buscar" do CEP; some se o CEP, a cidade ou a UF forem mudados à mão. */
  codigo_ibge: string;
  prazo: string; whatsapp: Sim; nfe_email: Sim;
}
export const VAZIO: Form = { tipo: 'PJ', nome: '', nome_fantasia: '', documento: '', indicador_ie: '', cliente: true, fornecedor: false,
  telefone: '', email: '', email_nfe: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  codigo_ibge: '', prazo: '', whatsapp: '', nfe_email: '' };

const ou = (s: string) => (s.trim() ? s.trim() : null);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** "papeis.0" (erro de item de lista) vira "papeis", que é onde a tela mostra. */
export const raiz = (campo: string) => campo.split('.')[0];

/** Conferência local só do que impede salvar; o resto quem decide é o servidor (422). */
export function conferir(f: Form, passo: Passo, editando = false): Record<string, string> {
  const e: Record<string, string> = {};
  if (passo === 'dados') {
    // Na edição o papel não muda pelo app (fica na web), então não se confere.
    if (!editando && !f.cliente && !f.fornecedor) e.papeis = 'Escolha ao menos um papel.';
    if (!f.nome.trim()) e.nome = f.tipo === 'PJ' ? 'Informe a razão social.' : 'Informe o nome.';
    const d = f.documento.replace(/\D/g, '');
    if (d && d.length !== (f.tipo === 'PJ' ? 14 : 11)) e.documento = f.tipo === 'PJ' ? 'O CNPJ tem 14 dígitos.' : 'O CPF tem 11 dígitos.';
  }
  if (passo === 'contato') {
    if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = 'E-mail inválido.';
    if (f.email_nfe.trim() && !EMAIL.test(f.email_nfe.trim())) e.email_nfe = 'E-mail inválido.';
  }
  if (passo === 'endereco' && f.cep.trim() && f.cep.replace(/\D/g, '').length !== 8) e.cep = 'O CEP tem 8 dígitos.';
  if (passo === 'comercial' && f.prazo.trim() && !/^\d{1,3}$/.test(f.prazo.trim())) e.prazo_padrao_dias = 'Informe os dias, só números.';
  return e;
}

/** Endereço achado pelo CEP entra no formulário; complemento só se o usuário ainda não escreveu um. */
export function aplicarCep(f: Form, e: EnderecoCep): Form {
  return { ...f,
    cep: e.cep.length === 8 ? `${e.cep.slice(0, 5)}-${e.cep.slice(5)}` : f.cep,
    logradouro: e.logradouro ?? f.logradouro, bairro: e.bairro ?? f.bairro,
    complemento: f.complemento.trim() ? f.complemento : (e.complemento ?? ''),
    cidade: e.cidade ?? f.cidade, uf: e.uf ?? f.uf, codigo_ibge: e.codigo_ibge ?? '' };
}

/** Status HTTP de um erro da API ou da demo. */
const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);

export function corpo(f: Form): NovaPessoa {
  const consentimento: NovaPessoa['consentimento'] = {};
  if (f.whatsapp) consentimento.whatsapp = f.whatsapp === 'sim';
  if (f.nfe_email) consentimento.email_nfe = f.nfe_email === 'sim';
  return {
    tipo: f.tipo, nome: f.nome.trim(), nome_fantasia: f.tipo === 'PJ' ? ou(f.nome_fantasia) : null, documento: ou(f.documento),
    indicador_ie: f.indicador_ie ? (Number(f.indicador_ie) as 1 | 2 | 9) : null,
    papeis: [...(f.cliente ? ['cliente' as const] : []), ...(f.fornecedor ? ['fornecedor' as const] : [])],
    telefone: ou(f.telefone), email: ou(f.email), email_nfe: ou(f.email_nfe),
    cep: ou(f.cep), logradouro: ou(f.logradouro), numero: ou(f.numero), complemento: ou(f.complemento),
    bairro: ou(f.bairro), cidade: ou(f.cidade), uf: f.uf || null, codigo_ibge: ou(f.codigo_ibge),
    prazo_padrao_dias: f.prazo.trim() ? Number(f.prazo.trim()) : null,
    consentimento,
  };
}

const consentDe = (v: boolean | null): Sim => (v === null ? '' : v ? 'sim' : 'nao');

/** Formulário preenchido com o cadastro atual (tela 34 → Editar). Campo que o GET não traz abre vazio. */
export function formDoCadastro(c: PessoaCadastro): Form {
  const id = c.identificacao, en = c.endereco_fiscal;
  const ie = id.indicador_ie;
  return { ...VAZIO,
    tipo: c.tipo === 'PF' ? 'PF' : 'PJ', nome: id.razao_social ?? c.nome, nome_fantasia: id.nome_fantasia ?? '',
    // O GET mascara o documento: o campo abre vazio (a máscara vira dica) e só é enviado se digitarem o número inteiro.
    documento: id.documento && !id.documento.includes('*') ? id.documento : '', indicador_ie: ie === 1 || ie === 2 || ie === 9 ? (String(ie) as Form['indicador_ie']) : '',
    cliente: id.papeis.includes('cliente'), fornecedor: id.papeis.includes('fornecedor'),
    telefone: c.contato?.telefone ?? '', email: c.contato?.email ?? '', email_nfe: en.email_nfe ?? '',
    cep: en.cep ?? '', logradouro: en.logradouro ?? '', numero: en.numero ?? '', complemento: en.complemento ?? '',
    bairro: en.bairro ?? '', cidade: en.cidade ?? '', uf: en.uf ?? '', codigo_ibge: en.codigo_ibge ?? '',
    prazo: c.comercial.prazo_padrao_dias !== null ? String(c.comercial.prazo_padrao_dias) : '',
    whatsapp: consentDe(c.consentimento.whatsapp), nfe_email: consentDe(c.consentimento.email_nfe) };
}

const EDITAVEIS = ['nome', 'nome_fantasia', 'documento', 'indicador_ie', 'telefone', 'email', 'email_nfe', 'cep', 'logradouro', 'numero',
  'complemento', 'bairro', 'cidade', 'uf', 'codigo_ibge', 'prazo_padrao_dias'] as const;

/** Corpo do PATCH: só o que mudou. Campo esvaziado vai null (limpa). Consentimento só sai se virou Autorizado/Não autorizado. */
export function diferencas(ini: Form, atual: Form): EdicaoPessoa {
  const a = corpo(ini), b = corpo(atual);
  const out: Record<string, unknown> = {};
  for (const k of EDITAVEIS) if (a[k] !== b[k]) out[k] = b[k];
  const cons: NonNullable<EdicaoPessoa['consentimento']> = {};
  if (atual.whatsapp && atual.whatsapp !== ini.whatsapp) cons.whatsapp = atual.whatsapp === 'sim';
  if (atual.nfe_email && atual.nfe_email !== ini.nfe_email) cons.email_nfe = atual.nfe_email === 'sim';
  if (Object.keys(cons).length) out.consentimento = cons;
  return out as EdicaoPessoa;
}

export function NovaPessoaTela({ aoCancelar, aoSalvar, avisar, editar }: {
  aoCancelar: () => void; aoSalvar: (id: number) => void;
  avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Modo edição (tela 34 → Editar): abre preenchido e salva com PATCH só do que mudou. */
  editar?: { id: number; inicial: Form; documentoMascarado?: string | null };
}) {
  const [f, setF] = useState<Form>(editar?.inicial ?? VAZIO);
  const [passo, setPasso] = useState<Passo>('dados');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const i = PASSOS.findIndex((p) => p.id === passo);
  const ultimo = i === PASSOS.length - 1;
  const mudar = <K extends keyof Form>(k: K, v: Form[K], campoApi: string = k) => {
    // codigo_ibge só vale para o CEP/cidade/UF que vieram da busca.
    setF((o) => ({ ...o, [k]: v, ...(k === 'cep' || k === 'cidade' || k === 'uf' ? { codigo_ibge: '' } : {}) }));
    setErros((o) => { const n = { ...o }; delete n[campoApi]; return n; });
  };

  const buscarCep = async () => {
    if (f.cep.replace(/\D/g, '').length !== 8) { setErros((o) => ({ ...o, cep: 'O CEP tem 8 dígitos.' })); return; }
    setBuscandoCep(true);
    try {
      const e = await api.cep(f.cep);
      setF((o) => aplicarCep(o, e));
      setErros((o) => { const n = { ...o }; for (const k of ['cep', 'logradouro', 'bairro', 'cidade', 'uf']) delete n[k]; return n; });
    } catch (err) {
      const st = statusDe(err);
      if (st === 404) setErros((o) => ({ ...o, cep: 'CEP não encontrado. Preencha o endereço abaixo.' }));
      else if (st === 422) setErros((o) => ({ ...o, cep: 'O CEP tem 8 dígitos.' }));
      else if (st === 429) avisar('Muitas buscas seguidas. Tente de novo em um minuto.', 'warn');
      else avisar(err instanceof Error ? err.message : 'Não foi possível buscar o CEP.', 'erro');
    } finally { setBuscandoCep(false); }
  };

  const avancar = async () => {
    const e = conferir(f, passo, !!editar);
    setErros(e);
    if (Object.keys(e).length) return;
    if (!ultimo) { setPasso(PASSOS[i + 1].id); return; }
    setSalvando(true);
    try {
      if (editar) {
        const mudou = diferencas(editar.inicial, f);
        if (!Object.keys(mudou).length) { avisar('Nenhuma alteração para salvar.', 'warn'); return; }
        await api.editarPessoa(editar.id, mudou);
        avisar('Cadastro atualizado.', 'ok');
        aoSalvar(editar.id);
        return;
      }
      const { id } = await api.criarPessoa(corpo(f));
      avisar('Cadastro salvo.', 'ok');
      aoSalvar(id);
    } catch (err) {
      const brutos = camposDoErro(err);
      const campos: Record<string, string> = {};
      for (const [k, v] of Object.entries(brutos)) campos[raiz(k)] ??= v;
      if (Object.keys(campos).length) {
        setErros(campos);
        const volta = PASSOS.find((p) => Object.keys(campos).some((c) => PASSO_DO_CAMPO[c] === p.id));
        if (volta) setPasso(volta.id);
        // Erro em campo que a tela não mostra: não deixa o toque sem resposta.
        if (!Object.keys(campos).some((c) => c in PASSO_DO_CAMPO)) avisar(Object.values(campos)[0], 'erro');
      } else if (err instanceof ErroApi && err.codigo === 'sem_permissao') {
        avisar(editar ? 'Seu usuário não pode editar esta pessoa.' : 'Seu usuário não pode cadastrar pessoas.', 'erro');
      } else if (editar && statusDe(err) === 404) {
        avisar('Pessoa não encontrada.', 'erro');
      } else {
        avisar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'erro');
      }
    } finally { setSalvando(false); }
  };

  const erro = (k: string) => erros[k] && <span id={'np-e-' + k} className="np-erro">{erros[k]}</span>;
  const campo = (k: keyof Form, rotulo: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, campoApi: string = k) => (
    <div className="p4-campo">
      <label htmlFor={'np-' + k}>{rotulo}</label>
      <input id={'np-' + k} value={f[k] as string} onChange={(e) => mudar(k, e.target.value as never, campoApi)}
        aria-invalid={!!erros[campoApi]} aria-describedby={erros[campoApi] ? 'np-e-' + campoApi : undefined} {...extra} />
      {erro(campoApi)}
    </div>
  );
  // Na edição, "Sem registro" só aparece se ainda não havia registro: o PATCH não apaga consentimento já dado.
  const consentir = (k: 'whatsapp' | 'nfe_email', rotulo: string, ajuda: string) => {
    const opcoes: Array<[Sim, string]> = [['sim', 'Autorizado'], ['nao', 'Não autorizado']];
    if (!editar || editar.inicial[k] === '') opcoes.push(['', 'Sem registro']);
    return (
    <div className="p4-campo">
      <label id={'np-l-' + k}>{rotulo}</label>
      <div className={'np-seg' + (opcoes.length === 3 ? ' tres' : '')} role="radiogroup" aria-labelledby={'np-l-' + k}>
        {opcoes.map(([v, l]) => (
          <button key={v || 'nada'} role="radio" aria-checked={f[k] === v} className={f[k] === v ? 'on' : ''} onClick={() => mudar(k, v, 'consentimento')}>{l}</button>
        ))}
      </div>
      <span className="np-ajuda">{ajuda}</span>
    </div>
    );
  };

  return (
    <>
      <div className="pd-head">
        <div className="p4-rotulo">{editar ? 'Dados cadastrais' : 'Pessoas'} · passo {i + 1} de {PASSOS.length}</div>
        <div className="pd-titulo">{editar ? 'Editar cadastro' : 'Nova pessoa'}</div>
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
              {/* Papel e tipo não mudam pelo app na edição (ficam na web). */}
              {!editar && <div className="p4-campo">
                <label id="np-l-papeis">Papel</label>
                <div className="np-papeis" role="group" aria-labelledby="np-l-papeis">
                  <button className={'pd-chip' + (f.cliente ? ' on' : '')} aria-pressed={f.cliente} onClick={() => mudar('cliente', !f.cliente, 'papeis')}>Cliente</button>
                  <button className={'pd-chip' + (f.fornecedor ? ' on' : '')} aria-pressed={f.fornecedor} onClick={() => mudar('fornecedor', !f.fornecedor, 'papeis')}>Fornecedor</button>
                </div>
                {erro('papeis')}
              </div>}
              {!editar && <div className="np-seg" role="radiogroup" aria-label="Tipo de pessoa">
                <button role="radio" aria-checked={f.tipo === 'PJ'} className={f.tipo === 'PJ' ? 'on' : ''} onClick={() => mudar('tipo', 'PJ')}>Empresa (CNPJ)</button>
                <button role="radio" aria-checked={f.tipo === 'PF'} className={f.tipo === 'PF' ? 'on' : ''} onClick={() => mudar('tipo', 'PF')}>Pessoa física (CPF)</button>
              </div>}
              {campo('nome', f.tipo === 'PJ' ? 'Razão social' : 'Nome completo', { autoComplete: f.tipo === 'PJ' ? 'organization' : 'name' })}
              {f.tipo === 'PJ' && campo('nome_fantasia', 'Nome fantasia (opcional)')}
              {editar?.documentoMascarado
                ? campo('documento', f.tipo === 'PJ' ? 'CNPJ (digite o número inteiro só para trocar)' : 'CPF (digite o número inteiro só para trocar)',
                  { inputMode: 'numeric', placeholder: editar.documentoMascarado })
                : campo('documento', f.tipo === 'PJ' ? 'CNPJ (opcional)' : 'CPF (opcional)', { inputMode: 'numeric' })}
              <div className="p4-campo">
                <label htmlFor="np-ie">Indicador de IE</label>
                <select id="np-ie" className="np-select" value={f.indicador_ie} onChange={(e) => mudar('indicador_ie', e.target.value as Form['indicador_ie'])}>
                  <option value="">Não informado</option>
                  {IE.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                {erro('indicador_ie')}
              </div>
            </>
          )}
          {passo === 'contato' && (
            <>
              {campo('telefone', 'Telefone / WhatsApp', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
              {campo('email', 'E-mail', { type: 'email', inputMode: 'email', autoComplete: 'email' })}
              {campo('email_nfe', 'E-mail para NF-e (opcional)', { type: 'email', inputMode: 'email' })}
              <p className="np-ajuda">Sem e-mail para NF-e, a nota vai para o e-mail principal.</p>
            </>
          )}
          {passo === 'endereco' && (
            <>
              <div className="np-cep">
                {campo('cep', 'CEP', { inputMode: 'numeric', autoComplete: 'postal-code', enterKeyHint: 'search',
                  onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCep(); } } })}
                <button className="oi-btn" disabled={buscandoCep || salvando} onClick={buscarCep}>{buscandoCep ? 'Buscando…' : 'Buscar'}</button>
              </div>
              {campo('logradouro', 'Logradouro', { autoComplete: 'address-line1', placeholder: 'Rua, avenida…' })}
              <div className="np-linha2 num">
                {campo('numero', 'Número', { inputMode: 'numeric' })}
                {campo('complemento', 'Complemento', { autoComplete: 'address-line2' })}
              </div>
              {campo('bairro', 'Bairro', { autoComplete: 'address-level3' })}
              <div className="np-linha2">
                {campo('cidade', 'Cidade', { autoComplete: 'address-level2' })}
                <div className="p4-campo">
                  <label htmlFor="np-uf">UF</label>
                  <select id="np-uf" className="np-select" value={f.uf} onChange={(e) => mudar('uf', e.target.value)}>
                    <option value="">—</option>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {erro('uf')}
                </div>
              </div>
            </>
          )}
          {passo === 'comercial' && (
            <>
              {campo('prazo', 'Prazo padrão (dias)', { inputMode: 'numeric', placeholder: 'Ex.: 28' }, 'prazo_padrao_dias')}
              <p className="np-ajuda">Prazo de pagamento sugerido nos pedidos desta pessoa. Em branco, vale o da empresa.</p>
            </>
          )}
          {passo === 'lgpd' && (
            <>
              <div className="p4-rotulo">Consentimento · LGPD Art. 7º</div>
              {consentir('whatsapp', 'WhatsApp', 'Mensagens de pedido e cobrança pelo telefone.')}
              {consentir('nfe_email', 'NF-e por e-mail', 'Envio da nota fiscal ao e-mail informado.')}
              {erro('consentimento')}
            </>
          )}
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando}
          onClick={() => (i === 0 ? aoCancelar() : setPasso(PASSOS[i - 1].id))}>{i === 0 ? 'Cancelar' : 'Voltar'}</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando} onClick={avancar}>
          {salvando ? 'Salvando…' : ultimo ? (editar ? 'Salvar alterações' : 'Salvar cadastro') : 'Continuar'}
        </button>
      </div>
    </>
  );
}
