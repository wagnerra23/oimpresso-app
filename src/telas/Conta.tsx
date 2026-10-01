// Conta — lembrete de ponto (push), privacidade e sair.
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { DEMO, sair } from '../api';
import { ativarLembrete } from '../push';
import logo from '../assets/oimpresso-logo.png';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

export function Conta({ aoSair, avisar }: { aoSair: () => void; avisar: Aviso }) {
  const [ativando, setAtivando] = useState(false);

  const lembrete = async () => {
    setAtivando(true);
    try {
      const r = await ativarLembrete();
      avisar(r === 'ativo' ? 'Lembrete de ponto ativado neste aparelho.' : r === 'negado'
        ? 'Notificações bloqueadas. Libere em Ajustes › Apps › oimpresso › Notificações.'
        : 'Lembrete disponível só no app instalado.', r === 'ativo' ? 'ok' : 'warn');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível ativar o lembrete.', 'erro');
    } finally {
      setAtivando(false);
    }
  };

  return (
    <>
      <div className="oi-head"><div className="oi-head-row"><div className="oi-head-title">Conta</div></div></div>
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
        <div className="oi-section">
          <div className="oi-section-h">Privacidade</div>
          <div className="oi-card">
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              O app usa a localização só no momento em que você bate o ponto. Não usa câmera nem biometria.
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
