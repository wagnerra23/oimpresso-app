// Recibo do lançamento liquidado: prévia na tela e exportação (PDF montado no app por ../recibo, sem servidor).
// Recebido → a empresa assina e manda ao cliente. Pago → vai ao fornecedor para ele assinar.
// Navegador: "Baixar PDF" salva o arquivo; "Compartilhar" usa o menu de compartilhar do aparelho quando existe.
// No app instalado (Android/iOS) o PDF vai para o cache do app (Filesystem) e abre o menu do aparelho (Share):
// daí a pessoa salva em Arquivos/Drive ou manda pelo WhatsApp. "Baixar PDF" e "Compartilhar" fazem o mesmo ali.
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { api } from '../api';
import { nomeArquivoRecibo, pdfRecibo, reciboComoTexto, textoRecibo, type ReciboDados } from '../recibo';
import { Cabecalho } from './NovaOs';
import { reais } from './Pedidos';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

/** Bytes → base64 em blocos (o PDF passa do limite de argumentos do String.fromCharCode). */
function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function Recibo({ id, aoVoltar, avisar }: { id: number; aoVoltar: () => void; avisar?: Aviso }) {
  const [r, setR] = useState<ReciboDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    api.recibo(id).then(setR).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível montar o recibo.'));
  }, [id]);

  const arquivo = (x: ReciboDados) => new File([pdfRecibo(x) as BlobPart], nomeArquivoRecibo(x), { type: 'application/pdf' });

  // App instalado: grava no cache e abre o menu do aparelho (salvar em Arquivos/Drive ou enviar).
  const compartilharNativo = async (x: ReciboDados) => {
    try {
      const { uri } = await Filesystem.writeFile({ path: nomeArquivoRecibo(x), data: base64(pdfRecibo(x)), directory: Directory.Cache });
      await Share.share({ title: `Recibo ${x.numero}`, files: [uri], dialogTitle: 'Salvar ou enviar o recibo' });
    } catch (e) {
      // Fechar o menu de compartilhar não é erro.
      if (!/cancel/i.test(String((e as { message?: string } | null)?.message ?? ''))) avisar?.('Não foi possível gerar o PDF. Use Copiar texto.', 'erro');
    }
  };

  const baixar = () => {
    if (!r) return;
    if (Capacitor.isNativePlatform()) { void compartilharNativo(r); return; }
    const url = URL.createObjectURL(arquivo(r));
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivoRecibo(r);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    avisar?.('PDF do recibo gerado.', 'ok');
  };

  const compartilhar = async () => {
    if (!r) return;
    if (Capacitor.isNativePlatform()) { await compartilharNativo(r); return; }
    const titulo = `Recibo ${r.numero}`;
    try {
      const f = arquivo(r);
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: titulo, text: titulo });
      else if (navigator.share) await navigator.share({ title: titulo, text: reciboComoTexto(r) });
      else { avisar?.('Compartilhar não está disponível aqui. Use Baixar PDF ou Copiar texto.', 'warn'); return; }
    } catch (e) {
      // Fechar o menu de compartilhar não é erro.
      if ((e as { name?: string } | null)?.name !== 'AbortError') avisar?.('Não foi possível compartilhar. Use Baixar PDF ou Copiar texto.', 'erro');
    }
  };

  const copiar = async () => {
    if (!r) return;
    try { await navigator.clipboard.writeText(reciboComoTexto(r)); avisar?.('Texto do recibo copiado.', 'ok'); }
    catch { avisar?.('Não foi possível copiar aqui. Selecione o texto do recibo e copie.', 'warn'); }
  };

  const t = r ? textoRecibo(r) : null;
  return (
    <>
      <Cabecalho titulo={r ? `Recibo ${r.numero}` : 'Recibo'} rotulo={r ? (r.tipo === 'receber' ? 'Para o cliente' : 'Para o fornecedor assinar') : 'Financeiro'} aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível montar o recibo</b><span>{erro}</span></div>}
          {!r && !erro && <p className="p4-legal">Montando o recibo…</p>}
          {r && t && (
            <>
              <article className="rb-folha" aria-label="Prévia do recibo">
                <header>
                  <div><b>{t.titulo}</b><small>Nº {r.numero}</small></div>
                  <span>{reais(r.valor)}</span>
                </header>
                <p>{t.corpo}</p>
                <p className="rb-local">{t.local}</p>
                <footer>
                  <i aria-hidden="true" />
                  <b>{t.assinante}</b>
                  {t.assinanteDoc && <small>{t.assinanteDoc}</small>}
                </footer>
              </article>
              <p className="p4-legal">{r.tipo === 'receber'
                ? 'Recibo da empresa para o cliente, comprovando o recebimento.'
                : 'Recibo para o fornecedor assinar, comprovando o pagamento feito a ele.'}</p>
            </>
          )}
        </div>
      </div>
      {r && (
        <div className="ld-rodape">
          <button className="oi-btn primary ld-principal" onClick={baixar}>Baixar PDF</button>
          <div className="ld-secundarias">
            <button className="oi-btn" onClick={compartilhar}>Compartilhar</button>
            <button className="oi-btn" onClick={copiar}>Copiar texto</button>
          </div>
        </div>
      )}
    </>
  );
}
