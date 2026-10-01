// Login do app — topo com gradiente da marca (design-v3 LoginScreen), mas com
// usuário e senha do ERP: o app entra por token Passport (password grant).
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
    <div className="oi oi-app" data-theme="light">
      <div style={{ padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px 36px',
        background: 'linear-gradient(150deg, var(--brand-deep), var(--brand-purple) 55%, var(--brand-magenta))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))' }}>
        <div style={{ width: 88, height: 88, borderRadius: 22, background: 'rgba(255,255,255,.12)',
          display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.18)' }}>
          <img src={logo} alt="" style={{ width: 52, height: 'auto' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>oimpresso</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>Gestão para comunicação visual</div>
        </div>
      </div>

      <form className="oi-scroll" style={{ padding: '28px 24px 24px' }} onSubmit={enviar}>
        {DEMO && <div className="app-banner demo" style={{ borderRadius: 10, marginBottom: 16 }}>Modo demonstração — dados simulados, nada vai para o servidor.</div>}
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Bem-vindo de volta</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Entre com o mesmo usuário do oimpresso.</div>

        <label className="ptm-lbl" htmlFor="usuario">Usuário ou e-mail</label>
        <input id="usuario" className="ptm-in" style={{ margin: '6px 0 14px' }} autoComplete="username" autoCapitalize="none"
          autoCorrect="off" inputMode="email" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />

        <label className="ptm-lbl" htmlFor="senha">Senha</label>
        <div style={{ position: 'relative', margin: '6px 0 18px' }}>
          <input id="senha" className="ptm-in" type={mostrar ? 'text' : 'password'} autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ paddingRight: 78 }} />
          <button type="button" onClick={() => setMostrar((v) => !v)} aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
            style={{ position: 'absolute', right: 4, top: 1, bottom: 1, minWidth: 70, border: 0, background: 'none', color: 'var(--accent)', font: 'inherit', fontSize: 13 }}>
            {mostrar ? 'Esconder' : 'Mostrar'}
          </button>
        </div>

        <button className="ptm-cta" style={{ width: '100%' }} disabled={enviando || !usuario || !senha}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {erro && <p className="app-erro" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
      </form>
    </div>
  );
}
