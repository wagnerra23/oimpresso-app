// P2 · anexos — aba Anexos do detalhe da OS (telas 03/22, desenho #p2 do handoff propostas-app). Lista os anexos do
// ERP (mais novo primeiro), filtra por etapa e envia foto: "Tirar foto" (some com app_anexos_camera desligado) e
// "Da galeria". Sem conexão o envio trava, sem fila (regra 8). Apagar anexo fica na web (soft delete, LGPD).
// Contrato tela-03-anexos (ERP #9446). As URLs são assinadas e valem 10 min: a lista é buscada de novo a cada abertura.
import { Browser } from '@capacitor/browser';
import { useEffect, useState } from 'react';
import { useAjustes } from '../ajustes';
import { cancelouEscolha, ehImagem, erroDoEnvio, filtrarAnexos, temFiltroEtapa, textoAnexo, textoTamanho, type FiltroAnexos, type OrigemAnexo } from '../anexos-regras';
import { api, ErroApi, type AnexoOs, type ListaAnexosOs, type OsDetalhe } from '../api';
import { escolherFoto } from '../camera';
import { novaChave } from '../venda';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

export function AnexosOs({ os, online, avisar }: { os: Pick<OsDetalhe, 'id' | 'numero' | 'etapa'>; online: boolean; avisar?: Aviso }) {
  const ajustes = useAjustes();
  const [lista, setLista] = useState<ListaAnexosOs | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroAnexos>('todas');
  const [enviando, setEnviando] = useState<OrigemAnexo | null>(null);
  const [vendo, setVendo] = useState<AnexoOs | null>(null);

  useEffect(() => {
    setLista(null); setErro(null);
    api.anexosOs(os.id).then(setLista).catch((e) => setErro(e instanceof ErroApi && e.status === 403 ? 'Seu usuário não pode ver os anexos desta OS.'
      : e instanceof Error ? e.message : 'Não foi possível carregar os anexos.'));
  }, [os.id]);

  const enviar = async (origem: OrigemAnexo) => {
    if (!online) { avisar?.('Sem conexão — anexar foto precisa de internet.', 'warn'); return; }
    setEnviando(origem);
    try {
      const arquivo = await escolherFoto(origem);
      if (!arquivo) return;
      const novo = await api.enviarAnexoOs(os.id, arquivo, origem, novaChave());
      setLista((l) => (l ? { ...l, itens: [novo, ...l.itens.filter((a) => a.id !== novo.id)] } : l));
      setFiltro('todas');
      avisar?.(`Foto anexada à ${os.numero}`);
    } catch (e) {
      if (!cancelouEscolha(e)) avisar?.(erroDoEnvio(e), 'erro');
    } finally { setEnviando(null); }
  };

  const etapaAtual = os.etapa?.chave;
  const comFiltro = !!lista && temFiltroEtapa(lista.itens, etapaAtual);
  const itens = lista ? filtrarAnexos(lista.itens, comFiltro ? filtro : 'todas', etapaAtual) : [];
  const filtros: Array<[FiltroAnexos, string]> = [['todas', 'Todas'], ['atual', os.etapa?.rotulo ?? 'Esta etapa'], ['antes', 'Antes']];
  const abrir = (a: AnexoOs) => {
    if (ehImagem(a) && (a.miniatura || a.url)) setVendo(a);
    else if (/^https:\/\//.test(a.url)) Browser.open({ url: a.url });
  };
  return (
    <>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!lista && !erro && <p className="p4-legal">Carregando…</p>}
          {comFiltro && (
            <div className="rl-seg" role="tablist" aria-label="Etapa">
              {filtros.map(([f, rotulo]) => (
                <button key={f} role="tab" aria-selected={filtro === f} className={'rl-seg-b' + (filtro === f ? ' on' : '')} onClick={() => setFiltro(f)}>{rotulo}</button>
              ))}
            </div>
          )}
          {lista && itens.length > 0 && (
            <div className="anx-grade">
              {itens.map((a) => (
                <button key={a.id} className="anx-item" onClick={() => abrir(a)} aria-label={`${a.nome}, ${textoTamanho(a.tamanho)}`}>
                  {ehImagem(a) && a.miniatura
                    ? <img className="anx-mini" src={a.miniatura} alt="" loading="lazy" />
                    : <span className={'anx-mini anx-vazia' + (ehImagem(a) ? '' : ' pdf')}>{ehImagem(a) ? '' : 'PDF'}<i>{a.nome}</i></span>}
                  <span className="anx-txt">{textoAnexo(a)}</span>
                </button>
              ))}
            </div>
          )}
          {lista && lista.itens.length === 0 && (
            <div className="p4-vazio"><b>Nenhum anexo nesta OS</b>
              <span>{lista.pode_enviar ? 'Tire uma foto ou escolha da galeria: entrada do veículo, peça trocada, orçamento assinado.' : 'Os anexos enviados pela web aparecem aqui.'}</span>
            </div>
          )}
          <p className="p4-legal">As fotos ficam na OS e aparecem também na web. Câmera e galeria pedem permissão só no primeiro uso. Apagar um anexo é feito no computador.</p>
        </div>
      </div>
      {lista?.pode_enviar && (
        <div className="pd-rodape">
          {!online && <span className="pd-rodape-nota" role="status">Sem conexão. Enviar anexo precisa de internet.</span>}
          <div className={'anx-bts' + (ajustes.app_anexos_camera ? '' : ' so-galeria')}>
            <button className="oi-btn" disabled={!online || enviando !== null} onClick={() => enviar('galeria')}>{enviando === 'galeria' ? 'Enviando…' : 'Da galeria'}</button>
            {ajustes.app_anexos_camera && (
              <button className="p4-cta" disabled={!online || enviando !== null} onClick={() => enviar('camera')}>{enviando === 'camera' ? 'Enviando…' : 'Tirar foto'}</button>
            )}
          </div>
        </div>
      )}
      {vendo && (
        <div className="anx-ver" role="dialog" aria-modal="true" aria-label={vendo.legenda ?? vendo.nome} onClick={() => setVendo(null)}>
          <img src={vendo.url || vendo.miniatura || ''} alt={vendo.legenda ?? vendo.nome} />
          <span>{textoAnexo(vendo)} · {textoTamanho(vendo.tamanho)}</span>
          <button className="oi-btn" onClick={() => setVendo(null)}>Fechar</button>
        </div>
      )}
    </>
  );
}
