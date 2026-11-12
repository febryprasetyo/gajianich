/**
 * WhatsApp Gateway Integration Service
 * Compatible with Fonnte and generic WhatsApp REST API gateways.
 */

export interface BlastMessageParams {
  fullName: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
}

export interface ActivationMessageParams {
  fullName: string;
  username: string;
  activationUrl: string;
}

export interface SendWhatsAppParams {
  to: string;
  message: string;
  apiUrl?: string;
  apiToken?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normalizes Indonesian mobile phone numbers to international 628... format.
 * Returns null if invalid or not an Indonesian mobile number.
 */
export function normalizeIndonesianPhoneNumber(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Remove non-digit characters
  const digits = phone.replace(/\D/g, '');

  let normalized = '';
  if (digits.startsWith('08')) {
    normalized = '62' + digits.slice(1);
  } else if (digits.startsWith('628')) {
    normalized = digits;
  } else if (digits.startsWith('8')) {
    normalized = '62' + digits;
  } else {
    return null;
  }

  // Indonesian mobile numbers are usually between 10 to 15 digits including country code (628...)
  if (normalized.length < 10 || normalized.length > 15) {
    return null;
  }

  return normalized;
}

/**
 * Generates formatted WhatsApp blast message for account provisioning.
 */
export function generateAccountBlastMessage(params: BlastMessageParams): string {
  const { fullName, username, tempPassword, loginUrl } = params;

  return `Halo *${fullName}*,

Akun portal GAJIANICH Anda telah aktif. Berikut kredensial akses Anda:

🌐 *Link Login*: ${loginUrl}
👤 *Username*: \`${username}\`
🔑 *Password Sementara*: \`${tempPassword}\`

⚠️ *PENTING*: Demi keamanan data Anda, Anda akan diminta untuk mengganti password saat pertama kali login. Mohon jangan bagikan pesan ini kepada siapa pun.

Salam hangat,
*Tim HR & IT GAJIANICH*`;
}

/**
 * Generates formatted WhatsApp message with Magic Activation Link (Zero-Password).
 */
export function generateActivationBlastMessage(params: ActivationMessageParams): string {
  const { fullName, username, activationUrl } = params;

  return `Halo *${fullName}*,

Akun portal GAJIANICH Anda telah dibuat. Silakan klik link aktivasi berikut untuk membuat password dan langsung mengaktifkan akun Anda:

🔗 *Link Aktivasi*: ${activationUrl}
👤 *Username*: \`${username}\`

⚠️ *Catatan*: Link ini bersifat rahasia dan berlaku selama 48 jam. Setelah membuat password baru, Anda dapat langsung login dan menggunakan aplikasi presensi.

Salam hangat,
*Tim HR & IT GAJIANICH*`;
}

/**
 * Sends a WhatsApp message via configured HTTP API Gateway (e.g. Fonnte or generic gateway).
 */
export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const apiUrl = (params.apiUrl ?? process.env.WHATSAPP_API_URL ?? 'https://api.fonnte.com/send').trim();
  const apiToken = (params.apiToken ?? process.env.WHATSAPP_API_TOKEN ?? '').trim();

  if (!apiToken || !apiUrl) {
    return {
      success: false,
      error: 'WHATSAPP_GATEWAY_NOT_CONFIGURED',
    };
  }

  try {
    const payload = {
      target: params.to,
      message: params.message,
      countryCode: '62',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiToken,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.reason || data?.message || `HTTP ${response.status}: Gateway error`,
      };
    }

    // Fonnte returns { status: true, id: [...] }
    if (data && data.status === false) {
      return {
        success: false,
        error: data.reason || data.message || 'Gateway rejected message',
      };
    }

    const messageId = Array.isArray(data?.id) ? data.id[0] : data?.id || data?.messageId;

    return {
      success: true,
      messageId: messageId ? String(messageId) : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network request to WhatsApp gateway failed',
    };
  }
}

