/**
 * Twilio Webhook Request Signature Verification
 * Twilio signs all webhook requests with an HMAC-SHA1 signature
 */

/**
 * Verify that a request came from Twilio using signature validation
 */
export async function verifyTwilioSignature(
  req: Request,
  authToken: string
): Promise<boolean> {
  try {
    const signature = req.headers.get('X-Twilio-Signature');
    if (!signature) {
      console.warn('[Twilio Signature] Missing X-Twilio-Signature header');
      return false;
    }

    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    const clonedReq = req.clone();

    let body = '';
    if (req.method === 'POST') {
      const formData = await clonedReq.formData();
      const params = new URLSearchParams();
      const keys = Array.from(formData.keys()).sort();
      for (const key of keys) {
        const value = formData.get(key);
        if (!(value instanceof File)) {
          params.append(key, value?.toString() || '');
        }
      }
      body = params.toString();
    }

    const dataToSign = baseUrl + body;
    const key = new TextEncoder().encode(authToken);
    const data = new TextEncoder().encode(dataToSign);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    const isValid = constantTimeEqual(signature, computedSignature);

    if (!isValid) {
      console.warn('[Twilio Signature] Signature verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('[Twilio Signature] Verification error:', error);
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
