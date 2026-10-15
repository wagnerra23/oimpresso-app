// Login — desenho v4 (tela 00 "Login + empresa"): fundo no roxo do DS, marca em branco,
// cartão translúcido, botão branco. Usuário e senha do ERP → token Passport (password grant).
// Fora do v4 de propósito: "Entrar com OAuth" e "Escolha a empresa" (sem seletor na v1 — [W]).
// Com a biometria ligada (P9, ADR 0432), abre pedindo a digital/rosto; três falhas pedem a senha.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DEMO, destravarToken, entrar } from '../api';
import { conferirBiometria } from '../biometria';
import { aposTentativa, DESTRAVAR_INICIAL, MAX_FALHAS_BIOMETRIA } from '../biometria-regras';
import { useTemaDoCelular } from '../tema';
import logo from '../assets/oimpresso-logo.png';

/** Digital (protótipo Mobile Propostas #p9). */
export const IconeDigital = ({ tamanho = 28 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </svg>
);

export function Login({ aoEntrar, biometria = false }: { aoEntrar: () => void; biometria?: boolean }) {
  const tema = useTemaDoCelular();
  const [bio, setBio] = useState(DESTRAVAR_INICIAL);
  const [usarSenha, setUsarSenha] = useState(!biometria);
  const [conferindo, setConferindo] = useState(false);
  const pediu = useRef(false);

  const tentarBiometria = useCallback(async () => {
    setConferindo(true);
    try {
      const r = await conferirBiometria();
      if (r === 'ok') {
        if (await destravarToken()) { aoEntrar(); return; }
        setBio({ ...DESTRAVAR_INICIAL, pedeSenha: true, mensagem: 'Entre com a senha para continuar.' });
        return;
      }
      setBio((e) => aposTentativa(e, r));
    } finally {
      setConferindo(false);
    }
  }, [aoEntrar]);

  // Três falhas (ou biometria bloqueada): só a senha.
  useEffect(() => { if (bio.pedeSenha) setUsarSenha(true); }, [bio.pedeSenha]);

  // Abre já pedindo a biometria, uma vez (na demonstração, só pelo botão: a simulação é uma caixa de diálogo).
  useEffect(() => {
    if (!biometria || pediu.current || DEMO) return;
    pediu.current = true;
    void tentarBiometria();
  }, [biometria, tentarBiometria]);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(usuario.trim(), senha);
      aoEntrar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="oi oi-app l4" data-theme={tema}>
      <form className="l4-corpo" onSubmit={enviar}>
        <div className="l4-marca">
          <div className="l4-logo"><img src={logo} alt="" /><span>oimpresso</span></div>
          <span className="l4-sub">Sistema de gestão para gráficas</span>
        </div>

        {!usarSenha && (
          <div className="l4-cartao" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: 99, border: '1.5px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconeDigital />
            </span>
            <span className="l4-titulo">Toque no sensor para entrar</span>
            <span className="l4-dica">Se a biometria falhar {MAX_FALHAS_BIOMETRIA} vezes, o app pede a senha do oimpresso.</span>
            {DEMO && <div className="l4-erro">Modo demonstração — dados simulados, nada vai para o servidor.</div>}
            {bio.mensagem && <div className="l4-erro" role="alert">{bio.mensagem}</div>}
            <button type="button" className="l4-entrar" style={{ width: '100%' }} disabled={conferindo} onClick={tentarBiometria}>
              {conferindo ? 'Conferindo…' : 'Entrar com biometria'}
            </button>
            <button type="button" className="l4-outra" onClick={() => setUsarSenha(true)}>Usar usuário e senha</button>
          </div>
        )}

        {usarSenha && <div className="l4-cartao">
          <span className="l4-titulo">Entrar</span>
          <span className="l4-dica">Use o mesmo usuário do oimpresso.</span>
          {DEMO && <div className="l4-erro">Modo demonstração — dados simulados, nada vai para o servidor.</div>}
          {!erro && bio.pedeSenha && bio.mensagem && <div className="l4-erro" role="alert">{bio.mensagem}</div>}
          {erro && <div className="l4-erro" role="alert">{erro}</div>}
          <input className="l4-campo" aria-label="Usuário ou e-mail" placeholder="Usuário ou e-mail" autoComplete="username"
            autoCapitalize="none" autoCorrect="off" inputMode="email" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
          <div style={{ position: 'relative' }}>
            <input className="l4-campo" aria-label="Senha" placeholder="Senha" type={mostrar ? 'text' : 'password'} autoComplete="current-password"
              value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ paddingRight: 84 }} />
            <button type="button" className="l4-mostrar" onClick={() => setMostrar((v) => !v)} aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}>
              {mostrar ? 'Esconder' : 'Mostrar'}
            </button>
          </div>
          <button className="l4-entrar" disabled={enviando || !usuario || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          {biometria && !bio.pedeSenha && (
            <button type="button" className="l4-outra" onClick={() => setUsarSenha(false)}>Entrar com biometria</button>
          )}
        </div>}

        <span className="l4-termos">Ao continuar você concorda com os termos de uso do app.</span>
      </form>
    </div>
  );
}
