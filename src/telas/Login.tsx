// Login — desenho v4 (tela 00 "Login + empresa"): fundo no roxo do DS, marca em branco,
// cartão translúcido, botão branco. Usuário e senha do ERP → token Passport (password grant).
// Fora do v4 de propósito: "Entrar com OAuth" e "Escolha a empresa" (sem seletor na v1 — [W]).
import { useState, type FormEvent } from 'react';
import { DEMO, entrar } from '../api';
import logo from '../assets/oimpresso-logo.png';

export function Login({ aoEntrar }: { aoEntrar: () => void }) {
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
    <div className="oi oi-app l4" data-theme="light">
      <form className="l4-corpo" onSubmit={enviar}>
        <div className="l4-marca">
          <div className="l4-logo"><img src={logo} alt="" /><span>oimpresso</span></div>
          <span className="l4-sub">Sistema de gestão para gráficas</span>
        </div>

        <div className="l4-cartao">
          <span className="l4-titulo">Entrar</span>
          <span className="l4-dica">Use o mesmo usuário do oimpresso.</span>
          {DEMO && <div className="l4-erro">Modo demonstração — dados simulados, nada vai para o servidor.</div>}
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
        </div>

        <span className="l4-termos">Ao continuar você concorda com os termos de uso do app.</span>
      </form>
    </div>
  );
}
