// Conta — lembrete de ponto (push), entrar com biometria (P9), privacidade e sair.
import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { DEMO, desligarBiometria, ligarBiometria, sair } from '../api';
import { ativarLembrete } from '../push';
import { useAjustes } from '../ajustes';
import { biometriaLigada, celularTemBiometria } from '../biometria';
import { ofereceBiometria } from '../biometria-regras';
import { IconeDigital } from './Login';
import logo from '../assets/oimpresso-logo.png';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

export function Conta({ aoSair, avisar, voltar }: { aoSair: () => void; avisar: Aviso; voltar?: ReactNode }) {
  const [ativando, setAtivando] = useState(false);
  const ajustes = useAjustes();
  // P9: null = ainda conferindo o celular.
  const [celularTem, setCelularTem] = useState<boolean | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [trocando, setTrocando] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([celularTemBiometria(), biometriaLigada()]).then(([tem, on]) => { if (vivo) { setCelularTem(tem); setBioOn(on); } });
    return () => { vivo = false; };
  }, [ajustes.app_biometria_login]);
  const oferece = ofereceBiometria(ajustes.app_biometria_login, !!celularTem);

  const trocarBiometria = async () => {
    setTrocando(true);
    try {
      if (bioOn) {
        await desligarBiometria();
        setBioOn(false);
        avisar('Entrada com biometria desligada. Use usuário e senha.');
        return;
      }
      const r = await ligarBiometria();
      if (r === 'ok') { setBioOn(true); avisar('Pronto: na próxima vez, o app pede a biometria do celular.'); }
      else if (r !== 'cancelou') avisar('A biometria não foi confirmada. A opção continua desligada.', 'warn');
    } catch {
      avisar('Não foi possível trocar a biometria agora.', 'erro');
    } finally {
      setTrocando(false);
    }
  };

  const lembrete = async () => {
    setAtivando(true);
    try {
      const r = await ativarLembrete();
      avisar(r === 'ativo' ? 'Lembrete de ponto ativado neste aparelho.' : r === 'negado'
        ? 'Notificações bloqueadas. Libere em Ajustes › Apps › oimpresso › Notificações.'
        : 'Lembrete ainda não disponível nesta versão do app.', r === 'ativo' ? 'ok' : 'warn');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível ativar o lembrete.', 'erro');
    } finally {
      setAtivando(false);
    }
  };

  return (
    <>
      <div className="oi-head"><div className="oi-head-row">{voltar}<div className="oi-head-title">Conta</div></div></div>
      <div className="oi-scroll">
        <div className="oi-section">
          <div className="oi-section-h">Lembrete de ponto</div>
          <div className="oi-card">
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Receba um aviso no horário de cada marcação da sua escala.
            </span>
            <button className="ptm-cta" disabled={ativando} onClick={lembrete}>{ativando ? 'Ativando…' : 'Ativar lembrete'}</button>
          </div>
        </div>
        {(oferece || (!ajustes.app_biometria_login && celularTem)) && (
          <div className="oi-section">
            <div className="oi-section-h">Acesso</div>
            {oferece && (
              <div className="oi-card" style={{ borderColor: 'var(--info)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>O oimpresso não vê a biometria</span>
                <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  Quem confere a digital ou o rosto é o próprio celular. O app só recebe "ok" e destrava o acesso guardado — nada biométrico vai para o servidor.
                </span>
              </div>
            )}
            <div className="oi-card">
              {!ajustes.app_biometria_login && (
                <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>A empresa desligou a entrada com biometria. Use usuário e senha.</span>
              )}
              {oferece && (
                <button role="switch" aria-checked={bioOn} disabled={trocando} onClick={trocarBiometria}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, width: '100%', padding: 0, border: 0, background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Entrar com digital ou Face ID</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>Pede a biometria do celular ao abrir o app. A senha continua valendo.</span>
                  </span>
                  <span aria-hidden="true" style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 99, padding: 3, background: bioOn ? 'var(--accent)' : 'var(--border)', transition: 'background .15s' }}>
                    <span style={{ display: 'block', width: 20, height: 20, borderRadius: 99, background: '#ffffff', transform: bioOn ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
                  </span>
                </button>
              )}
            </div>
            {oferece && (
              <div className="oi-card" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
                <span style={{ width: 56, height: 56, borderRadius: 99, border: `1.5px solid ${bioOn ? 'var(--accent)' : 'var(--text-mute)'}`,
                  color: bioOn ? 'var(--accent)' : 'var(--text-mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconeDigital />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{bioOn ? 'Toque no sensor para entrar' : 'Entrar com usuário e senha'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {bioOn ? 'Se a biometria falhar 3 vezes, o app pede a senha do oimpresso.' : 'Ligue a opção acima para pular a senha nas próximas vezes.'}
                </span>
              </div>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>Bater ponto continua sem selfie nem biometria — a regra do Ponto não muda.</span>
          </div>
        )}
        <div className="oi-section">
          <div className="oi-section-h">Privacidade</div>
          <div className="oi-card">
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              O app usa a localização só no momento em que você bate o ponto. A biometria, se você ligar, só destrava a entrada e fica no celular.
            </span>
            <button className="oi-btn block" style={{ minHeight: 46 }} onClick={() => Browser.open({ url: 'https://oimpresso.com/privacidade' })}>
              Política de privacidade
            </button>
            <button className="oi-btn block" style={{ minHeight: 46 }} onClick={() => Browser.open({ url: 'https://oimpresso.com/privacidade/ponto/exclusao' })}>
              Excluir minha conta
            </button>
          </div>
        </div>
        <div className="oi-section">
          <button className="oi-btn block" style={{ minHeight: 48, color: 'var(--danger)' }} onClick={async () => { await sair(); aoSair(); }}>
            Sair
          </button>
        </div>
        <div className="oi-section" style={{ textAlign: 'center', color: 'var(--text-mute)', fontSize: 11.5 }}>
          <img src={logo} alt="" style={{ width: 36, opacity: 0.85 }} />
          <div>oimpresso · {Capacitor.getPlatform()}{DEMO ? ' · modo demonstração' : ''}</div>
        </div>
      </div>
    </>
  );
}
