// ============================================================
// QR CODE GENERATION — Pour les convocations PDF
// ============================================================

import QRCode from 'qrcode';

const DEFAULT_JURY_PWA_URL = 'https://qwetsh.github.io/groupit-jury/';

/**
 * Génère un QR code en base64 data URL pour un jury donné.
 * Le QR encode l'URL de la PWA avec le code session et le numéro de jury.
 */
export async function generateJuryQRCode(
  sessionCode: string,
  juryNumber: number,
  baseUrl: string = DEFAULT_JURY_PWA_URL,
): Promise<string> {
  const url = `${baseUrl}?session=${encodeURIComponent(sessionCode)}&jury=${juryNumber}`;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 200,
    margin: 1,
    color: {
      dark: '#1a365d',
      light: '#ffffff',
    },
  });
}

/**
 * Pré-génère les QR codes pour tous les jurys d'une session.
 * Retourne un Map<juryName, dataUrl>.
 */
export async function generateAllJuryQRCodes(
  sessionCode: string,
  juryNames: string[],
  baseUrl?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const results = await Promise.allSettled(
    juryNames.map(async (name, idx) => {
      const dataUrl = await generateJuryQRCode(sessionCode, idx + 1, baseUrl);
      return { name, dataUrl };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      map.set(result.value.name, result.value.dataUrl);
    } else {
      console.warn('[qrcode] Échec génération QR pour un jury:', result.reason);
    }
  }

  return map;
}
