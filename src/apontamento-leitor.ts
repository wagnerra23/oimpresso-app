// Leitor do QR da etiqueta (P8). Plugin oficial @capacitor/barcode-scanner (Ionic/OutSystems): Capacitor 8, SPM no
// iOS (o projeto não usa CocoaPods) e tela de leitura nativa com lanterna. A câmera é pedida pelo sistema no primeiro
// uso (README §1: câmera só para anexos e QR, nunca no ponto). Na demo pelo navegador, a leitura é simulada.
import { Capacitor } from '@capacitor/core';
import {
  CapacitorBarcodeScanner, CapacitorBarcodeScannerAndroidScanningLibrary, CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { DEMO, ErroApi } from './api';
import { QR_DEMO } from './demo';

/** Códigos de erro do plugin (OSBarcodeError): 6 = a pessoa fechou o leitor; 7 = câmera negada. */
const CANCELADO = 'OS-PLUG-BARC-0006';
const CAMERA_NEGADA = 'OS-PLUG-BARC-0007';

/** Abre o leitor e devolve o texto lido; null se a pessoa fechou sem ler. Câmera negada → ErroApi camera_negada. */
export async function lerQr(): Promise<string | null> {
  if (DEMO && !Capacitor.isNativePlatform()) return QR_DEMO;
  try {
    const r = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Aponte para o QR da etiqueta do pedido',
      cancelButtonAccessibilityLabel: 'Fechar leitor',
      torchButtonOnAccessibilityLabel: 'Desligar lanterna',
      torchButtonOffAccessibilityLabel: 'Ligar lanterna',
      // ML Kit lê melhor etiqueta amassada ou molhada que o ZXing (o padrão do plugin); roda no aparelho, sem rede.
      android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.MLKIT },
    });
    return r.ScanResult || null;
  } catch (e) {
    const codigo = (e as { code?: string } | null)?.code;
    if (codigo === CANCELADO) return null;
    if (codigo === CAMERA_NEGADA) {
      throw new ErroApi(0, 'camera_negada', 'Sem permissão da câmera. Libere nas configurações do celular.');
    }
    throw new ErroApi(0, 'leitor', 'Não foi possível abrir o leitor. Tente de novo.');
  }
}
