// Filtro avançado do Financeiro (tela 06): abre por cima da lista, como as telas de cadastro. Edita uma cópia
// e só devolve em "Aplicar"; "Limpar" zera tudo. Regras e parâmetros da rota em ../financeiro-filtros.
import { useState } from 'react';
import { ATALHOS, CAMPOS_DATA, FILTROS_VAZIOS, FORMAS_PADRAO, contarFiltros, lerValor, periodoDe, type FiltrosFinanceiro } from '../financeiro-filtros';

export function FiltroFinanceiro({ inicial, contas, formas, aoAplicar, aoVoltar }: {
  inicial: FiltrosFinanceiro;
  contas: Array<{ id: number; nome: string; detalhe: string | null }>;
  formas?: string[];
  aoAplicar: (f: FiltrosFinanceiro) => void;
  aoVoltar: () => void;
}) {
  const [f, setF] = useState<FiltrosFinanceiro>(inicial);
  const mudar = <K extends keyof FiltrosFinanceiro>(k: K, v: FiltrosFinanceiro[K]) => setF((x) => ({ ...x, [k]: v }));
  const atalhoAtivo = ATALHOS.find((a) => { const p = periodoDe(a.id); return p.de === f.de && p.ate === f.ate; })?.id;
  const periodoInvertido = !!f.de && !!f.ate && f.de > f.ate;
  const min = lerValor(f.valor_min), max = lerValor(f.valor_max);
  const valorInvalido = (f.valor_min.trim() !== '' && min === null) || (f.valor_max.trim() !== '' && max === null) || (min !== null && max !== null && min > max);
  const invalido = periodoInvertido || valorInvalido;
  const total = contarFiltros(f);

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para o Financeiro">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">Financeiro</div>
          <div className="pd-dtitulo">Filtro avançado</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo np-form">
          <div className="p4-rotulo">Período</div>
          <div className="p4-campo">
            <label id="ff-l-campo">Filtrar pela data de</label>
            <div className="pd-chips ff-quebra" role="radiogroup" aria-labelledby="ff-l-campo">
              {CAMPOS_DATA.map((c) => (
                <button key={c.id} role="radio" aria-checked={f.campo_data === c.id} className={'pd-chip' + (f.campo_data === c.id ? ' on' : '')}
                  onClick={() => mudar('campo_data', c.id)}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="pd-chips" role="group" aria-label="Atalhos de período">
            {ATALHOS.map((a) => (
              <button key={a.id} aria-pressed={atalhoAtivo === a.id} className={'pd-chip' + (atalhoAtivo === a.id ? ' on' : '')}
                onClick={() => setF((x) => ({ ...x, ...periodoDe(a.id) }))}>{a.label}</button>
            ))}
          </div>
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="ff-de">De</label>
              <input id="ff-de" type="date" value={f.de} max={f.ate || undefined} onChange={(e) => mudar('de', e.target.value)} aria-invalid={periodoInvertido} />
            </div>
            <div className="p4-campo">
              <label htmlFor="ff-ate">Até</label>
              <input id="ff-ate" type="date" value={f.ate} min={f.de || undefined} onChange={(e) => mudar('ate', e.target.value)} aria-invalid={periodoInvertido} />
            </div>
          </div>
          {periodoInvertido && <span className="np-erro">A data inicial está depois da final.</span>}
          {f.campo_data === 'competencia' && <p className="np-ajuda">Competência é por mês: vale o mês das datas escolhidas.</p>}

          <div className="p4-rotulo">Lançamento</div>
          <div className="p4-campo">
            <label htmlFor="ff-texto">Razão social ou descrição</label>
            <input id="ff-texto" type="search" value={f.texto} onChange={(e) => mudar('texto', e.target.value)} placeholder="Ex.: Clínica Vita, aluguel, #0044" enterKeyHint="search" />
          </div>
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="ff-nf">Nº da nota fiscal</label>
              <input id="ff-nf" inputMode="numeric" value={f.nf} onChange={(e) => mudar('nf', e.target.value)} placeholder="Ex.: 1287" />
            </div>
            <div className="p4-campo">
              <label htmlFor="ff-nosso">Nosso número</label>
              <input id="ff-nosso" inputMode="numeric" value={f.nosso_numero} onChange={(e) => mudar('nosso_numero', e.target.value)} placeholder="Do boleto" />
            </div>
          </div>
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="ff-min">Valor de (R$)</label>
              <input id="ff-min" inputMode="decimal" value={f.valor_min} onChange={(e) => mudar('valor_min', e.target.value)} placeholder="0,00" aria-invalid={valorInvalido} />
            </div>
            <div className="p4-campo">
              <label htmlFor="ff-max">Valor até (R$)</label>
              <input id="ff-max" inputMode="decimal" value={f.valor_max} onChange={(e) => mudar('valor_max', e.target.value)} placeholder="0,00" aria-invalid={valorInvalido} />
            </div>
          </div>
          {valorInvalido && <span className="np-erro">Confira a faixa de valor: use números, e o valor inicial não pode passar do final.</span>}

          <div className="p4-rotulo">Pagamento</div>
          <div className="p4-campo">
            <label id="ff-l-forma">Forma de pagamento</label>
            <div className="pd-chips ff-quebra" role="radiogroup" aria-labelledby="ff-l-forma">
              {['', ...(formas?.length ? formas : FORMAS_PADRAO)].map((x) => (
                <button key={x || 'todas'} role="radio" aria-checked={f.forma === x} className={'pd-chip' + (f.forma === x ? ' on' : '')}
                  onClick={() => mudar('forma', x)}>{x || 'Todas'}</button>
              ))}
            </div>
          </div>
          {contas.length > 0 && (
            <div className="p4-campo">
              <label htmlFor="ff-conta">Conta bancária</label>
              <select id="ff-conta" className="np-select" value={f.conta_id ?? ''} onChange={(e) => mudar('conta_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Todas as contas</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.detalhe ? ` · ${c.detalhe}` : ''}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={total === 0} onClick={() => setF(FILTROS_VAZIOS)}>Limpar</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={invalido} onClick={() => aoAplicar(f)}>
          {total === 0 ? 'Ver todos' : `Aplicar ${total} ${total === 1 ? 'filtro' : 'filtros'}`}
        </button>
      </div>
    </>
  );
}
