import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import QRCode from "npm:qrcode@1.5.4";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";

// TOTP implementation using Web Crypto API
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(length = 20): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let secret = '';
  for (const byte of array) {
    secret += BASE32_CHARS[byte % 32];
  }
  return secret;
}

function base32Decode(input: string): Uint8Array {
  const cleanInput = input.toUpperCase().replace(/=+$/, '');
  const output = new Uint8Array(Math.floor(cleanInput.length * 5 / 8));
  let bits = 0;
  let value = 0;
  let index = 0;
  
  for (const char of cleanInput) {
    const charIndex = BASE32_CHARS.indexOf(char);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output[index++] = (value >> bits) & 0xff;
    }
  }
  return output;
}

async function generateTOTP(secret: string, time?: number): Promise<string> {
  const counter = Math.floor((time || Date.now()) / 30000);
  const secretBytes = base32Decode(secret);
  // Convert to ArrayBuffer to satisfy TypeScript
  const keyData = new Uint8Array(secretBytes).buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter));
  
  const signature = await crypto.subtle.sign('HMAC', key, buffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | 
                (hmac[offset + 1] & 0xff) << 16 | 
                (hmac[offset + 2] & 0xff) << 8 | 
                (hmac[offset + 3] & 0xff)) % 1000000;
  
  return code.toString().padStart(6, '0');
}

async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const time = now + (i * 30000);
    const expected = await generateTOTP(secret, time);
    if (expected === token) return true;
  }
  return false;
}

function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check user role - only super_admin and client_admin can use 2FA
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'client_admin'])
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({ error: '2FA is only available for admin accounts' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialize vault for encryption
    await initVault(supabase);

    const { action, code } = await req.json();

    switch (action) {
      case 'setup': {
        // Generate new TOTP secret
        const secret = generateSecret();
        const encryptedSecret = await vaultEncrypt(supabase, secret);
        
        // Generate backup codes
        const backupCodes = generateBackupCodes();
        const encryptedBackupCodes = await Promise.all(
          backupCodes.map(c => vaultEncrypt(supabase, c))
        );
        
        // Store temporarily (not enabled yet)
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            totp_secret: encryptedSecret,
            backup_codes: encryptedBackupCodes,
            totp_enabled: false
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Generate QR code URL and local image payload
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();

        const otpAuthUrl = `otpauth://totp/AlCor%20Nexus:${encodeURIComponent(profile?.email || user.email || '')}?secret=${secret}&issuer=AlCor%20Nexus&algorithm=SHA1&digits=6&period=30`;
        let qrCodeDataUrl: string | null = null;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
        } catch (qrError) {
          console.error('Failed to generate 2FA QR code:', qrError);
        }

        return new Response(JSON.stringify({
          success: true,
          secret,
          otpAuthUrl,
          qrCodeDataUrl,
          backupCodes
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'verify-setup': {
        // Verify the code and enable 2FA
        if (!code) {
          return new Response(JSON.stringify({ error: 'Verification code required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_secret')
          .eq('id', user.id)
          .single();

        if (!profile?.totp_secret) {
          return new Response(JSON.stringify({ error: '2FA setup not started' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const secret = await vaultDecrypt(supabase, profile.totp_secret);
        const isValid = await verifyTOTP(secret, code);

        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid verification code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Enable 2FA
        const { error: enableError } = await supabase
          .from('profiles')
          .update({
            totp_enabled: true,
            totp_verified_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (enableError) throw enableError;

        // Log the 2FA enablement
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'enable_2fa',
          resource_type: 'security',
          resource_id: user.id,
          details: { method: 'totp' }
        });

        return new Response(JSON.stringify({ success: true, enabled: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'verify': {
        // Verify a TOTP code during login
        if (!code) {
          return new Response(JSON.stringify({ error: 'Code required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_secret, totp_enabled, backup_codes')
          .eq('id', user.id)
          .single();

        if (!profile?.totp_enabled || !profile?.totp_secret) {
          return new Response(JSON.stringify({ error: '2FA not enabled' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const secret = await vaultDecrypt(supabase, profile.totp_secret);
        let isValid = await verifyTOTP(secret, code);

        // If TOTP fails, check backup codes
        if (!isValid && profile.backup_codes?.length > 0) {
          for (let i = 0; i < profile.backup_codes.length; i++) {
            const decryptedCode = await vaultDecrypt(supabase, profile.backup_codes[i]);
            if (normalizeBackupCode(decryptedCode) === normalizeBackupCode(code)) {
              isValid = true;
              // Remove used backup code
              const newBackupCodes = [...profile.backup_codes];
              newBackupCodes.splice(i, 1);
              await supabase
                .from('profiles')
                .update({ backup_codes: newBackupCodes })
                .eq('id', user.id);
              break;
            }
          }
        }

        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid code', valid: false }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Update verification timestamp
        await supabase
          .from('profiles')
          .update({ totp_verified_at: new Date().toISOString() })
          .eq('id', user.id);

        return new Response(JSON.stringify({ success: true, valid: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'disable': {
        // Require current code to disable
        if (!code) {
          return new Response(JSON.stringify({ error: 'Current code required to disable 2FA' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_secret, totp_enabled')
          .eq('id', user.id)
          .single();

        if (!profile?.totp_enabled || !profile?.totp_secret) {
          return new Response(JSON.stringify({ error: '2FA not enabled' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const secret = await vaultDecrypt(supabase, profile.totp_secret);
        const isValid = await verifyTOTP(secret, code);

        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Disable 2FA
        const { error: disableError } = await supabase
          .from('profiles')
          .update({
            totp_enabled: false,
            totp_secret: null,
            backup_codes: null,
            totp_verified_at: null
          })
          .eq('id', user.id);

        if (disableError) throw disableError;

        // Log the 2FA disablement
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'disable_2fa',
          resource_type: 'security',
          resource_id: user.id,
          details: {}
        });

        return new Response(JSON.stringify({ success: true, enabled: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'status': {
        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_enabled, totp_verified_at')
          .eq('id', user.id)
          .single();

        return new Response(JSON.stringify({
          enabled: profile?.totp_enabled || false,
          verified_at: profile?.totp_verified_at
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'regenerate-backup-codes': {
        // Require current TOTP code to regenerate
        if (!code) {
          return new Response(JSON.stringify({ error: 'Current code required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('totp_secret, totp_enabled')
          .eq('id', user.id)
          .single();

        if (!profile?.totp_enabled || !profile?.totp_secret) {
          return new Response(JSON.stringify({ error: '2FA not enabled' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const secret = await vaultDecrypt(supabase, profile.totp_secret);
        const isValid = await verifyTOTP(secret, code);

        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Generate new backup codes
        const backupCodes = generateBackupCodes();
        const encryptedBackupCodes = await Promise.all(
          backupCodes.map(c => vaultEncrypt(supabase, c))
        );

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ backup_codes: encryptedBackupCodes })
          .eq('id', user.id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, backupCodes }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in manage-2fa function:", error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...createCorsHeaders(req) }
    });
  }
});
