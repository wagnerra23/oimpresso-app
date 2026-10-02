// Assistente — desenho v4 (tela 25 "Chat de suporte"), D16 Onda E. Decisão [W] 2026-10-02: quem responde é a
// Jana (IA do ERP). Mora dentro de Mais: a barra de baixo é a do §7.1 (D6), por isso não vira aba como no protótipo.
// Rotas /api/app/chat: FORMATO PROPOSTO, ainda sem PR no ERP — ver RespostaChat/ConversaChat em api.ts.
// A conversa vale enquanto o app está aberto (conversa_id em memória); reabrir a tela recarrega pelo GET.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type MensagemChat } from '../api';

const SUGESTOES = ['Como vejo meus pedidos?', 'E a produção?', 'Financeiro do mês', 'Ajuda'];
const BOAS_VINDAS = 'Olá! Sou a Jana, a assistente do oimpresso. Como posso ajudar?';

/** Conversa da sessão do app: sobrevive a sair e voltar da tela, não a fechar o app. */
let conversaId: string | null = null;

export const horaCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** Pode enviar: texto com conteúdo, nada esperando resposta e com internet. */
export const podeEnviar = (texto: string, esperando: boolean, online: boolean) => online && !esperando && texto.trim().length > 0;

type Linha = MensagemChat & { falhou?: boolean };

export function Assistente({ online, voltar }: { online: boolean; voltar?: ReactNode }) {
  const [msgs, setMsgs] = useState<Linha[]>([]);
  const [texto, setTexto] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [carregando, setCarregando] = useState(conversaId !== null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversaId) return;
    api.conversaChat(conversaId).then((c) => setMsgs(c.mensagens)).catch(() => {}).finally(() => setCarregando(false));
  }, []);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs, esperando]);

  const enviar = async (bruto: string) => {
    const t = bruto.trim();
    if (!podeEnviar(t, esperando, online)) return;
    const minha: Linha = { de: 'eu', texto: t, criada_em: new Date().toISOString() };
    setMsgs((m) => [...m.filter((x) => !x.falhou), minha]);
    setTexto(''); setEsperando(true);
    try {
      const r = await api.enviarChat(t, conversaId);
      conversaId = r.conversa_id;
      setMsgs((m) => [...m, r.resposta]);
    } catch (e) {
      const msg = e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao assistente.'
        : e instanceof Error ? e.message : 'Não foi possível enviar.';
      setMsgs((m) => m.map((x) => (x === minha ? { ...x, falhou: true } : x)));
      setMsgs((m) => [...m, { de: 'jana', texto: msg, criada_em: '', falhou: true }]);
      setTexto(t);
    } finally { setEsperando(false); }
  };

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">Jana · assistente do oimpresso</div>
            <div className="pd-titulo">Assistente</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="ch-lista" role="log" aria-live="polite" aria-label="Conversa com a Jana">
          <div className="ch-msg jana"><span>{BOAS_VINDAS}</span></div>
          {carregando && <p className="p4-legal">Carregando a conversa…</p>}
          {msgs.map((m, i) => (
            <div key={i} className={'ch-msg ' + m.de + (m.falhou ? ' falhou' : '')}>
              <span>{m.texto}</span>
              {m.falhou && m.de === 'eu' ? <small>Não enviada</small> : m.criada_em && <small>{horaCurta(m.criada_em)}</small>}
            </div>
          ))}
          {esperando && <p className="ch-digitando" role="status">Jana está escrevendo…</p>}
          <div ref={fim} />
        </div>
      </div>
      <div className="ch-rodape">
        {!online && <p className="ch-aviso" role="status">Sem conexão. O assistente precisa de internet.</p>}
        <div className="ch-sugestoes" aria-label="Sugestões">
          {SUGESTOES.map((s) => (
            <button key={s} className="pd-chip" disabled={!online || esperando} onClick={() => enviar(s)}>{s}</button>
          ))}
        </div>
        <form className="ch-campo" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite sua mensagem…" aria-label="Mensagem para a Jana"
            maxLength={1000} enterKeyHint="send" autoComplete="off" />
          <button type="submit" className="ch-enviar" disabled={!podeEnviar(texto, esperando, online)} aria-label="Enviar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </button>
        </form>
      </div>
    </>
  );
}
