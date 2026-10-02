// Dados cadastrais da pessoa — desenho v4 (tela 34 · Ficha cadastral), D16 Onda A. Só leitura: o
// "Editar" do protótipo fica de fora até a escrita entrar num PR próprio. Abre a partir da ficha
// (tela 18). Rota PROPOSTA pelo app (GET /api/app/pessoas/{id}/cadastro) — ver PessoaCadastro em api.ts.
import { useEffect, useState } from 'react';
import { api, type PapelPessoa, type PessoaCadastro } from '../api';
import { reais } from './Pedidos';

const PAPEL: Record<PapelPessoa, string> = { cliente: 'Cliente', fornecedor: 'Fornecedor', funcionario: 'Funcionário' };
const autorizado = (v: boolean | null) => (v === null ? '—' : v ? 'Autorizado' : 'Não autorizado');
const dataHora = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
};

type Linha = { k: string; v: string; mono?: boolean };

function Bloco({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <>
      <div className="p4-rotulo">{titulo}</div>
      <div className="p4-lista">
        {linhas.map((l) => (
          <div key={l.k} className="ps-dado pc-dado"><span>{l.k}</span><b style={l.mono ? { fontFamily: 'var(--font-mono)' } : undefined}>{l.v}</b></div>
        ))}
      </div>
    </>
  );
}

export function Cadastro({ id, aoVoltar }: { id: number; aoVoltar: () => void }) {
  const [c, setC] = useState<PessoaCadastro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    api.pessoaCadastro(id).then(setC).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [id]);

  const pj = c?.tipo === 'PJ';
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para a ficha">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">Dados cadastrais</div>
          <div className="pd-dtitulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.nome ?? '…'}</div>
        </div>
      </div>
      <div className="oi-scroll">
        {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
        {!c && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {c && (
          <div className="pd-corpo">
            <Bloco titulo="Identificação" linhas={[
              { k: pj ? 'Razão social' : 'Nome', v: c.identificacao.razao_social ?? '—' },
              { k: pj ? 'CNPJ' : 'CPF', v: c.identificacao.documento ?? '—', mono: true },
              { k: 'Indicador IE', v: c.identificacao.indicador_ie ?? '—' },
              { k: 'Papéis', v: c.identificacao.papeis.map((x) => PAPEL[x]).join(' · ') || '—' },
            ]} />
            <Bloco titulo="Endereço fiscal" linhas={[
              { k: 'Cidade · UF', v: [c.endereco_fiscal.cidade, c.endereco_fiscal.uf].filter(Boolean).join(' · ') || '—' },
              { k: 'CEP', v: c.endereco_fiscal.cep ?? '—', mono: true },
              { k: 'Código IBGE', v: c.endereco_fiscal.codigo_ibge ?? '—', mono: true },
              { k: 'E-mail NF-e', v: c.endereco_fiscal.email_nfe ?? '—' },
            ]} />
            <Bloco titulo="Comercial" linhas={[
              { k: 'Classificação', v: c.comercial.classificacao ?? '—', mono: true },
              { k: 'Limite de crédito', v: c.comercial.limite_credito !== null ? reais(c.comercial.limite_credito) : '—', mono: true },
              { k: 'Prazo padrão', v: c.comercial.prazo_padrao_dias !== null ? `${c.comercial.prazo_padrao_dias} dias` : '—', mono: true },
            ]} />
            <Bloco titulo="Consentimento · LGPD Art. 7º" linhas={[
              { k: 'WhatsApp', v: autorizado(c.consentimento.whatsapp) },
              { k: 'NF-e por e-mail', v: autorizado(c.consentimento.email_nfe) },
              { k: 'SMS', v: autorizado(c.consentimento.sms) },
              { k: 'Registrado em', v: dataHora(c.consentimento.registrado_em), mono: true },
            ]} />
            <p className="p4-legal">Editar o cadastro continua no computador.</p>
          </div>
        )}
      </div>
    </>
  );
}
