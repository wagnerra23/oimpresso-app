// Cadastrar veículo — escrita da Onda D. Abre pelo "+ Veículo" da aba Veículos (tela 08) e pelo "Cadastrar
// veículo" da busca da Nova OS (o veículo novo volta já escolhido). Rota PROVISÓRIA POST /api/app/veiculos
// (pedida ao ERP), ligada por NOVO_VEICULO. Os tipos vêm do ERP. Cadastrar veículo não gera valor, estoque nem
// cobrança: o ERP só grava o veículo na empresa do usuário. Fora de propósito: consulta de placa externa,
// motor, combustível, chassi do reboque e observações (ficam na web).
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { api, camposDoErro, ErroApi, type OpcoesVeiculo, type VeiculoResumo } from '../api';
import { BuscaCliente, type Cliente } from './NovaOs';
import { kmDigitado, textoOuNulo } from './NovaOs';
import { Placa } from './Veiculos';

/** Placa como o ERP guarda: maiúsculas, sem hífen nem espaço. */
export function normalizarPlaca(t: string): string {
  return t.toUpperCase().split('').filter((c) => (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')).join('');
}

/** Placa válida: antiga (ABC1234) ou Mercosul (ABC1D23), já normalizada. */
export function placaValida(placa: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);
}

/** Ano digitado: vazio = null; quatro dígitos entre 1900 e 2100; o resto é inválido. */
export function anoDigitado(t: string): number | null | 'invalido' {
  const s = t.trim();
  if (!s) return null;
  if (!/^[0-9]{4}$/.test(s)) return 'invalido';
  const n = Number(s);
  return n >= 1900 && n <= 2100 ? n : 'invalido';
}

interface Form { placa: string; tipo: string; reboque: string; anoFab: string; anoMod: string; cor: string; km: string; chassi: string; renavam: string }
const VAZIO: Form = { placa: '', tipo: '', reboque: '', anoFab: '', anoMod: '', cor: '', km: '', chassi: '', renavam: '' };

/** Confere o formulário antes de enviar; devolve os erros por campo da API (vazio = pode enviar). */
export function errosDoForm(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const placa = normalizarPlaca(f.placa);
  if (!placa) e.placa = 'A placa do veículo é obrigatória.';
  else if (!placaValida(placa)) e.placa = 'Placa inválida: use ABC1234 ou ABC1D23.';
  const reboque = normalizarPlaca(f.reboque);
  if (reboque && !placaValida(reboque)) e.placa_secundaria = 'Placa do reboque inválida.';
  if (!f.tipo) e.tipo = 'Selecione o tipo do veículo.';
  if (anoDigitado(f.anoFab) === 'invalido') e.ano_fabricacao = 'Ano com 4 dígitos, ex.: 2019.';
  if (anoDigitado(f.anoMod) === 'invalido') e.ano_modelo = 'Ano com 4 dígitos, ex.: 2020.';
  if (kmDigitado(f.km) === 'invalido') e.km = 'Digite só números, ex.: 48312.';
  if (f.renavam.trim().length > 11) e.renavam = 'RENAVAM tem no máximo 11 dígitos.';
  return e;
}

interface Props {
  aoVoltar: () => void; aoCriar: (v: VeiculoResumo) => void;
  avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Rótulo do topo ("Oficina" na aba Veículos, "Nova OS" quando vem da busca da OS). */
  rotulo?: string;
}

export function NovoVeiculo({ aoVoltar, aoCriar, avisar, rotulo = 'Oficina' }: Props) {
  const [opcoes, setOpcoes] = useState<OpcoesVeiculo | null>(null);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [f, setF] = useState<Form>(VAZIO);
  const [dono, setDono] = useState<Cliente>(null);
  const [escolhendoDono, setEscolhendoDono] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.opcoesVeiculo().then(setOpcoes).catch((e) => setErroOpcoes(e instanceof Error ? e.message : 'Não foi possível carregar os tipos.'));
  }, []);

  const mudar = (k: keyof Form, v: string, campoApi: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (erros[campoApi]) setErros((e) => ({ ...e, [campoApi]: '' }));
  };

  const salvar = async () => {
    const e = errosDoForm(f);
    if (Object.values(e).some(Boolean)) { setErros(e); return; }
    setSalvando(true); setErros({});
    const ano = (t: string) => { const a = anoDigitado(t); return a === 'invalido' ? null : a; };
    const km = kmDigitado(f.km);
    try {
      const v = await api.criarVeiculo({
        placa: normalizarPlaca(f.placa), tipo: f.tipo, placa_secundaria: normalizarPlaca(f.reboque) || null,
        ano_fabricacao: ano(f.anoFab), ano_modelo: ano(f.anoMod), cor: textoOuNulo(f.cor), km: km === 'invalido' ? null : km,
        chassi: textoOuNulo(f.chassi.toUpperCase()), renavam: textoOuNulo(f.renavam), contact_id: dono?.id ?? null,
      });
      avisar?.(`Veículo ${v.placa} cadastrado`);
      aoCriar(v);
    } catch (x) {
      const campos = camposDoErro(x);
      setErros(campos);
      if (!Object.keys(campos).length) avisar?.(x instanceof ErroApi && x.status === 403 ? 'Seu usuário não pode cadastrar veículo.' : x instanceof Error ? x.message : 'Não foi possível cadastrar.', 'erro');
    } finally { setSalvando(false); }
  };

  if (escolhendoDono) return <BuscaCliente rotulo="Novo veículo" aoEscolher={(c) => { setDono(c); setEscolhendoDono(false); }} aoVoltar={() => setEscolhendoDono(false)} />;

  const erro = (k: string) => erros[k] ? <span id={'nve-e-' + k} className="np-erro">{erros[k]}</span> : null;
  const campo = (k: keyof Form, rotuloCampo: string, campoApi: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="p4-campo">
      <label htmlFor={'nve-' + k}>{rotuloCampo}</label>
      <input id={'nve-' + k} value={f[k]} onChange={(e) => mudar(k, e.target.value, campoApi)}
        aria-invalid={!!erros[campoApi]} aria-describedby={erros[campoApi] ? 'nve-e-' + campoApi : undefined} {...extra} />
      {erro(campoApi)}
    </div>
  );
  const placaPrevia = normalizarPlaca(f.placa);
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Cancelar e voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{rotulo}</div>
          <div className="pd-dtitulo">Novo veículo</div>
        </div>
        {placaValida(placaPrevia) && <span className="nve-previa"><Placa placa={placaPrevia} /></span>}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {campo('placa', 'Placa', 'placa', { autoCapitalize: 'characters', placeholder: 'ABC1D23', maxLength: 8 })}
          <div className="p4-campo">
            <label htmlFor="nve-tipo">Tipo</label>
            {erroOpcoes ? <span className="np-erro">{erroOpcoes}</span> : (
              <select id="nve-tipo" className="np-select" value={f.tipo} onChange={(e) => mudar('tipo', e.target.value, 'tipo')}
                aria-invalid={!!erros.tipo} aria-describedby={erros.tipo ? 'nve-e-tipo' : undefined} disabled={!opcoes}>
                <option value="">{opcoes ? 'Escolha o tipo' : 'Carregando…'}</option>
                {opcoes?.tipos.map((t) => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
              </select>
            )}
            {erro('tipo')}
          </div>

          <div className="p4-rotulo">Dono</div>
          <div className="pd-cartao nos-escolha nos-cliente">
            <span className="os-texto"><b>{dono?.nome ?? 'Sem dono'}</b><small>{dono ? 'Cliente dono do veículo' : 'Dá para escolher depois, na web'}</small></span>
            <span className="nos-bts">
              <button className="nos-link" onClick={() => setEscolhendoDono(true)}>{dono ? 'Trocar' : 'Escolher'}</button>
              {dono && <button className="nos-link" onClick={() => setDono(null)}>Tirar</button>}
            </span>
          </div>
          {erro('contact_id')}

          <div className="nve-dupla">
            {campo('anoFab', 'Ano fab. (opcional)', 'ano_fabricacao', { inputMode: 'numeric', placeholder: '2019', maxLength: 4 })}
            {campo('anoMod', 'Ano modelo (opcional)', 'ano_modelo', { inputMode: 'numeric', placeholder: '2020', maxLength: 4 })}
          </div>
          {campo('km', 'Km atual (opcional)', 'km', { inputMode: 'numeric', placeholder: 'Ex.: 48312' })}
          {campo('cor', 'Cor (opcional)', 'cor', { placeholder: 'Ex.: Branco', maxLength: 30, className: 'nos-texto-livre' })}
          {campo('reboque', 'Placa do reboque (opcional)', 'placa_secundaria', { autoCapitalize: 'characters', placeholder: 'Só se tiver reboque', maxLength: 8 })}
          {campo('chassi', 'Chassi (opcional)', 'chassi', { autoCapitalize: 'characters', maxLength: 30 })}
          {campo('renavam', 'RENAVAM (opcional)', 'renavam', { inputMode: 'numeric', maxLength: 11 })}
          <p className="np-ajuda">Motor, combustível e observações ficam no oimpresso web.</p>
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando} onClick={aoVoltar}>Cancelar</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando || !opcoes} onClick={salvar}>{salvando ? 'Salvando…' : 'Cadastrar veículo'}</button>
      </div>
    </>
  );
}
