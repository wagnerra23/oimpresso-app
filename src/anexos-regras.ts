// P2 · anexos da OS (telas 03/22). Regras puras da aba Anexos: o que aceitar, como nomear, como mostrar e
// que mensagem dar para cada recusa do ERP. A câmera e o envio ficam em camera.ts e api.ts.
// Contrato: memory/requisitos/AppMobile/api/tela-03-anexos.md do ERP (PR #9446).
import { ErroApi, camposDoErro, type AnexoOs } from './api';

/** Teto do ERP por arquivo (413 arquivo_grande acima disso). */
export const MAX_BYTES = 10 * 1024 * 1024;
/** O ERP aceita só estes tipos (lidos do conteúdo). HEIC volta 422: o app converte para JPEG antes. */
export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf'] as const;
/** Lado maior da foto que o app manda: nítida para medição e laudo, leve para subir no 4G. */
export const LADO_MAX = 2048;

export type OrigemAnexo = 'camera' | 'galeria';

/** Imagem fora do que o ERP aceita (HEIC, WebP…) ou grande demais: o app reencoda em JPEG antes de enviar. */
export const precisaConverter = (tipo: string, bytes: number): boolean =>
  !(TIPOS_ACEITOS as readonly string[]).includes(tipo) || bytes > MAX_BYTES;

/** Nome do arquivo como a câmera do celular: CAM_20261015_094112.jpg (câmera) ou IMG_… (galeria). */
export function nomeArquivo(origem: OrigemAnexo, tipo: string, quando: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const carimbo = `${quando.getFullYear()}${p(quando.getMonth() + 1)}${p(quando.getDate())}_${p(quando.getHours())}${p(quando.getMinutes())}${p(quando.getSeconds())}`;
  const ext = tipo === 'image/png' ? 'png' : tipo === 'application/pdf' ? 'pdf' : 'jpg';
  return `${origem === 'camera' ? 'CAM' : 'IMG'}_${carimbo}.${ext}`;
}

/** Bytes de um conteúdo em base64 (sem o prefixo data:). */
export const bytesDoBase64 = (b64: string): number =>
  Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

export const ehImagem = (a: Pick<AnexoOs, 'tipo'>): boolean => a.tipo.startsWith('image/');

/** "284 KB", "1,2 MB". */
export function textoTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Linha de baixo da miniatura: a legenda do ERP; sem ela, quem enviou e quando ("Ana Souza · 05/10"). */
export function textoAnexo(a: Pick<AnexoOs, 'legenda' | 'enviado_por' | 'enviado_em'>): string {
  if (a.legenda) return a.legenda;
  const d = new Date(a.enviado_em);
  const dia = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return [a.enviado_por ?? 'Sem autor', dia].filter(Boolean).join(' · ');
}

/** Filtro da grade, como as 3 posições do desenho: tudo, os da etapa em que a OS está, e os de etapas anteriores. */
export type FiltroAnexos = 'todas' | 'atual' | 'antes';

/** O seletor só aparece quando há anexo na etapa atual e em outra; senão, não há o que separar. */
export function temFiltroEtapa(itens: Pick<AnexoOs, 'etapa'>[], etapaAtual: string | null | undefined): boolean {
  if (!etapaAtual) return false;
  const naAtual = itens.filter((a) => a.etapa === etapaAtual).length;
  return naAtual > 0 && naAtual < itens.length;
}

export function filtrarAnexos<T extends Pick<AnexoOs, 'etapa'>>(itens: T[], filtro: FiltroAnexos, etapaAtual: string | null | undefined): T[] {
  if (filtro === 'todas' || !etapaAtual) return itens;
  return itens.filter((a) => (a.etapa === etapaAtual) === (filtro === 'atual'));
}

/** Cancelar a câmera ou a galeria não é erro: nada a avisar. */
export function cancelouEscolha(e: unknown): boolean {
  const x = e as { code?: unknown; message?: unknown } | null;
  const codigo = typeof x?.code === 'string' ? x.code : '';
  // Códigos do @capacitor/camera 8: foto cancelada, galeria cancelada, edição cancelada.
  if (['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0020', 'OS-PLUG-CAMR-0013'].includes(codigo)) return true;
  return typeof x?.message === 'string' && /cancel/i.test(x.message);
}

/** Permissão de câmera ou de fotos negada no aparelho. */
export function permissaoNegada(e: unknown): boolean {
  const codigo = (e as { code?: unknown } | null)?.code;
  return codigo === 'OS-PLUG-CAMR-0003' || codigo === 'OS-PLUG-CAMR-0005';
}

/** Mensagem do aviso para cada recusa do envio (tabela de erros do contrato). */
export function erroDoEnvio(e: unknown): string {
  if (permissaoNegada(e)) return 'Sem permissão de câmera ou fotos. Libere nos ajustes do celular.';
  const campos = camposDoErro(e);
  if (campos.origem) return campos.origem;
  if (campos.arquivo) return campos.arquivo;
  if (e instanceof ErroApi || (e as { status?: unknown } | null)?.status) {
    const status = (e as { status: number }).status;
    if (status === 403) return 'Seu usuário não pode anexar arquivos nesta OS.';
    if (status === 404) return 'Esta OS não existe mais ou não é desta empresa.';
    if (status === 413) return 'O arquivo passa de 10 MB.';
    if (status === 409) return 'Este envio ainda está em andamento. Aguarde um instante.';
    if (status === 429) return 'Muitos envios seguidos. Espere um minuto e tente de novo.';
  }
  return e instanceof Error && e.message ? e.message : 'Não foi possível enviar o anexo. Tente de novo.';
}
