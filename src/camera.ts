// P2 · anexos — câmera e galeria (@capacitor/camera 8). Só a pedido de quem usa (README §1): nada aqui roda sozinho.
// Devolve o arquivo pronto para o POST /os/{id}/arquivos: jpg ou png até 10 MB. O ERP não converte HEIC (#9446),
// então qualquer outro formato, ou foto grande demais, é reencodado em JPEG aqui antes de sair do aparelho.
import { Camera } from '@capacitor/camera';
import { LADO_MAX, MAX_BYTES, nomeArquivo, precisaConverter, type OrigemAnexo } from './anexos-regras';
import type { ArquivoAnexo } from './api';

const OPCOES = { quality: 85, targetWidth: LADO_MAX, targetHeight: LADO_MAX, correctOrientation: true, webUseInput: true } as const;

/** Abre a câmera ou a galeria. null = a pessoa cancelou (o chamador trata o erro do plugin como cancelamento ou falha). */
export async function escolherFoto(origem: OrigemAnexo): Promise<ArquivoAnexo | null> {
  const r = origem === 'camera'
    ? await Camera.takePhoto({ ...OPCOES, saveToGallery: false })
    : (await Camera.chooseFromGallery({ ...OPCOES, allowMultipleSelection: false })).results[0];
  if (!r) return null;
  let blob: Blob;
  if (r.webPath) blob = await (await fetch(r.webPath)).blob();
  else if (r.thumbnail) blob = await (await fetch(`data:image/jpeg;base64,${r.thumbnail}`)).blob();
  else return null;
  if (precisaConverter(blob.type, blob.size)) blob = await paraJpeg(blob);
  if (blob.size > MAX_BYTES) throw Object.assign(new Error('O arquivo passa de 10 MB.'), { status: 413 });
  return { nome: nomeArquivo(origem, blob.type, new Date()), tipo: blob.type, base64: await base64(blob) };
}

/** Reencoda a imagem em JPEG com o lado maior em LADO_MAX (a WebView decodifica HEIC no iOS e WebP em todo lugar). */
async function paraJpeg(origem: Blob): Promise<Blob> {
  const img = await createImageBitmap(origem);
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(img.width * escala); tela.height = Math.round(img.height * escala);
  tela.getContext('2d')?.drawImage(img, 0, 0, tela.width, tela.height);
  img.close();
  const jpeg = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85));
  if (!jpeg) throw new Error('Não foi possível preparar a foto. Tente outra.');
  return jpeg;
}

const base64 = (b: Blob) => new Promise<string>((ok, falha) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(String(leitor.result).replace(/^data:[^,]*,/, ''));
  leitor.onerror = () => falha(leitor.error ?? new Error('Não foi possível ler a foto.'));
  leitor.readAsDataURL(b);
});
