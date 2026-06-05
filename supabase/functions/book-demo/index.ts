import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Resend } from "resend";
import { createLogger } from "../_shared/logger.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { initVault, vaultDecrypt, vaultEncrypt } from "../_shared/vault.ts";

// Helper to safely extract Zod validation errors
function getValidationErrors(result: unknown): z.ZodIssue[] {
  if (typeof result !== 'object' || result === null) return [];
  const r = result as { success?: boolean; error?: { issues?: z.ZodIssue[] } };
  return r.success ? [] : r.error?.issues || [];
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per IP per hour
const fallbackRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkFallbackRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = fallbackRateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    fallbackRateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count) };
}

// Persistent rate limit check using database
async function checkRateLimitPersistent(
  supabase: SupabaseClient<any, "public", any>,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);
  const rateKey = `book_demo:${ip}`;

  try {
    // First, try to get existing rate limit record
    const { data: existing, error: selectError } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('key', rateKey)
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    if (selectError) {
      console.error('Rate limit select error:', selectError);
      return checkFallbackRateLimit(rateKey);
    }

    let newCount: number;
    
    if (existing) {
      // Increment existing count
      newCount = (existing.count || 0) + 1;
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({ count: newCount })
        .eq('key', rateKey)
        .eq('window_start', windowStart.toISOString());
      
      if (updateError) {
        console.error('Rate limit update error:', updateError);
        return checkFallbackRateLimit(rateKey);
      }
    } else {
      // Insert new record
      newCount = 1;
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({ 
          key: rateKey, 
          window_start: windowStart.toISOString(), 
          count: 1 
        });
      
      if (insertError) {
        // Handle race condition - record may have been inserted by another request
        console.error('Rate limit insert error (may be race condition):', insertError);
        // Try to read again
        const { data: recheck } = await supabase
          .from('rate_limits')
          .select('count')
          .eq('key', rateKey)
          .eq('window_start', windowStart.toISOString())
          .maybeSingle();
        
        if (recheck) {
          newCount = (recheck.count || 0) + 1;
        } else {
          return checkFallbackRateLimit(rateKey);
        }
      }
    }

    const allowed = newCount <= RATE_LIMIT_MAX_REQUESTS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - newCount);

    return { allowed, remaining };
  } catch (err) {
    console.error('Rate limit exception:', err);
    return checkFallbackRateLimit(rateKey);
  }
}

// Validation schemas
const getAvailableSlotsSchema = z.object({
  action: z.literal('get_available_slots'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
});

const submitLeadSchema = z.object({
  action: z.literal('submit_lead'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  phone: z.string().max(20, 'Phone too long').optional().nullable(),
  company_name: z.string().max(200, 'Company name too long').optional().nullable(),
  business_type: z.enum(['sales', 'food', 'hospitality', 'other']),
  message: z.string().max(2000, 'Message too long').optional().nullable(),
});

const contactUsSchema = z.object({
  action: z.literal('contact_us'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  phone: z.string().max(20, 'Phone too long').optional().nullable(),
  company_name: z.string().max(200, 'Company name too long').optional().nullable(),
  business_type: z.enum(['sales', 'food', 'hospitality', 'other']),
  message: z.string().max(2000, 'Message too long').optional().nullable(),
});

const bookDemoSchema = z.object({
  action: z.literal('book_demo'),
  demoRequestId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  phone: z.string().max(20, 'Phone too long').optional().nullable(),
  company: z.string().max(200, 'Company name too long').optional().nullable(),
  businessType: z.enum(['sales', 'food', 'hospitality', 'other']),
  scheduledTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid scheduled time' }),
  message: z.string().max(1000, 'Message too long').optional().nullable(),
});

// Keep phone formatting generic for public requests. If a country code is supplied, preserve it.
const normalizePhoneNumber = (phone?: string | null): string | null => {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return trimmed;

  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  if (trimmed.startsWith('00')) {
    return `+${digitsOnly.slice(2)}`;
  }

  return trimmed;
};

serve(async (req) => {
  const logger = createLogger(req, 'book-demo');
  const startTime = Date.now();
  const corsHeaders = createCorsHeaders(req);
  
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return corsResponse;
  }

  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('OAuth_Client_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const vaultEnabled = await initVault(supabase);
    console.log('[Book Demo] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    // Check rate limit using persistent database storage
    const rateLimit = await checkRateLimitPersistent(supabase, clientIp);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600',
          } 
        }
      );
    }

    const requestBody = await req.json();
    const { action } = requestBody;
    console.log('Book demo action:', action, 'from IP:', clientIp);

    // Check if OAuth credentials are configured
    if (!clientId || !clientSecret) {
      console.error('OAuth credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Calendar not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the first super admin's calendar tokens (prioritize acornilla@alcornexus.com)
    async function getSuperAdminCalendarToken(): Promise<string | null> {
      // Find super admins with connected calendar
      const { data: superAdmins, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (roleError || !superAdmins || superAdmins.length === 0) {
        console.error('No super admins found:', roleError);
        return null;
      }

      console.log('Found super admins:', superAdmins.length);

      // Try to find a super admin with a connected calendar
      for (const admin of superAdmins) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('google_calendar_tokens')
          .select('*')
          .eq('user_id', admin.user_id)
          .single();

        if (!tokenError && tokenData) {
          console.log('Found calendar token for user:', admin.user_id, 'expires:', tokenData.token_expiry);

          // Decrypt tokens (when vault encryption is enabled)
          let accessToken = tokenData.access_token as string;
          let refreshToken = tokenData.refresh_token as string;

          if (vaultEnabled) {
            try {
              accessToken = await vaultDecrypt(supabase, accessToken);
              refreshToken = await vaultDecrypt(supabase, refreshToken);
            } catch (decryptErr) {
              console.error('[Book Demo] Failed to decrypt calendar token for user:', admin.user_id, decryptErr);
              continue; // Try next admin
            }
          }

          // Check if token is expired and refresh if needed
          if (new Date(tokenData.token_expiry) <= new Date()) {
            console.log('Token expired, refreshing...');
            const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId!,
                client_secret: clientSecret!,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
              }),
            });

            const refreshData = await refreshResponse.json();

            if (refreshData.error) {
              console.error('Token refresh error:', refreshData);
              continue; // Try next admin
            }

            console.log('Token refreshed successfully');

            // Update stored tokens
            const newEncryptedAccessToken = vaultEnabled
              ? await vaultEncrypt(supabase, refreshData.access_token)
              : refreshData.access_token;

            const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000);
            await supabase
              .from('google_calendar_tokens')
              .update({
                access_token: newEncryptedAccessToken,
                token_expiry: newExpiry.toISOString(),
              })
              .eq('user_id', admin.user_id);

            return refreshData.access_token;
          }

          return accessToken;
        }
      }

      console.error('No super admin has connected calendar');
      return null;
    }

    // Submit lead (creates demo request without requiring RLS)
    if (action === 'submit_lead') {
      const validation = submitLeadSchema.safeParse(requestBody);
      if (!validation.success) {
        const errors = getValidationErrors(validation);
        console.error('Submit lead validation error:', errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { name, email, phone, company_name, business_type, message } = validation.data;
      const normalizedPhone = normalizePhoneNumber(phone);

      const { data: insertData, error: insertError } = await supabase
        .from('demo_requests')
        .insert({
          name,
          email,
          phone: normalizedPhone,
          company_name: company_name || null,
          business_type,
          message: message || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting demo request:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to submit request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Demo request created:', insertData.id);

      // Send confirmation email
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          
          const businessTypeLabels: Record<string, string> = {
            sales: 'Sales & Lead Generation (Jay AI)',
            food: 'Food & Restaurant (May AI)',
            hospitality: 'Hotels & Hospitality (Cece AI)',
            other: 'Custom AI Agent',
          };

          await resend.emails.send({
            from: 'AlCor Nexus <onboarding@resend.dev>',
            to: [email],
            subject: `Thank you for your interest in AlCor Nexus, ${name.split(' ')[0]}!`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #0d9488; font-size: 28px; margin: 0;">AlCor Nexus</h1>
                  <p style="color: #64748b; font-size: 14px; margin-top: 8px;">AI-Powered Business Solutions</p>
                </div>
                
                <div style="background: linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%); border-radius: 12px; padding: 32px; margin-bottom: 24px;">
                  <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Hi ${name.split(' ')[0]},</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                    Thank you for reaching out! We've received your inquiry about <strong>${businessTypeLabels[business_type]}</strong>.
                  </p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                    Our team is excited to help transform your business with AI. You can now schedule a personalized demo call to see how our AI agents can work for you.
                  </p>
                </div>
                
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 12px 0;">What happens next?</h3>
                  <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>Schedule your demo call on the next step</li>
                    <li>Our team will prepare a customized presentation</li>
                    <li>See our AI agents in action for your specific use case</li>
                  </ul>
                </div>
                
                <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Questions? Reply to this email or visit <a href="https://alcornexus.com" style="color: #0d9488;">alcornexus.com</a>
                  </p>
                  <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
                    © ${new Date().getFullYear()} AlCor Nexus. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          });
          console.log('Confirmation email sent to:', email);
        } catch (emailError) {
          // Don't fail the whole request if email fails
          console.error('Failed to send confirmation email:', emailError);
        }
      } else {
        console.log('RESEND_API_KEY not configured, skipping confirmation email');
      }

      return new Response(
        JSON.stringify({ success: true, id: insertData.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip booking (mark demo request as skipped)
    if (action === 'skip_booking') {
      const { demoRequestId } = requestBody;
      
      if (!demoRequestId) {
        return new Response(
          JSON.stringify({ error: 'Demo request ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('demo_requests')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', demoRequestId);

      if (updateError) {
        console.error('Error updating demo request status:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Demo request marked as skipped:', demoRequestId);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Contact Us - submit lead and send email to support
    if (action === 'contact_us') {
      const validation = contactUsSchema.safeParse(requestBody);
      if (!validation.success) {
        const errors = getValidationErrors(validation);
        console.error('Contact us validation error:', errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { name, email, phone, company_name, business_type, message } = validation.data;
      const normalizedPhone = normalizePhoneNumber(phone);

      // Insert demo request with 'contacted' status
      const { data: insertData, error: insertError } = await supabase
        .from('demo_requests')
        .insert({
          name,
          email,
          phone: normalizedPhone,
          company_name: company_name || null,
          business_type,
          message: message || null,
          status: 'contacted',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting contact request:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to submit request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Contact request created:', insertData.id);

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          
          const businessTypeLabels: Record<string, string> = {
            sales: 'Sales & Lead Generation (Jay AI)',
            food: 'Food & Restaurant (May AI)',
            hospitality: 'Hotels & Hospitality (Cece AI)',
            other: 'Custom AI Agent',
          };

          // Send notification to support
          await resend.emails.send({
            from: 'AlCor Nexus <onboarding@resend.dev>',
            to: ['support@alcornexus.com'],
            reply_to: email,
            subject: `New Contact Request: ${name} - ${businessTypeLabels[business_type]}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #0d9488; font-size: 28px; margin: 0;">New Contact Request</h1>
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <h3 style="color: #1e293b; margin: 0 0 16px 0;">Contact Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; width: 120px;">Name:</td>
                      <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Email:</td>
                      <td style="padding: 8px 0; color: #1e293b;"><a href="mailto:${email}" style="color: #0d9488;">${email}</a></td>
                    </tr>
                    ${phone ? `<tr>
                      <td style="padding: 8px 0; color: #64748b;">Phone:</td>
                      <td style="padding: 8px 0; color: #1e293b;">${phone}</td>
                    </tr>` : ''}
                    ${company_name ? `<tr>
                      <td style="padding: 8px 0; color: #64748b;">Company:</td>
                      <td style="padding: 8px 0; color: #1e293b;">${company_name}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Interest:</td>
                      <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${businessTypeLabels[business_type]}</td>
                    </tr>
                  </table>
                </div>
                
                ${message ? `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <h3 style="color: #1e293b; margin: 0 0 12px 0;">Message</h3>
                  <p style="color: #475569; white-space: pre-wrap; margin: 0;">${message}</p>
                </div>
                ` : ''}
                
                <div style="text-align: center; padding-top: 16px;">
                  <a href="mailto:${email}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reply to ${name.split(' ')[0]}</a>
                </div>
              </div>
            `,
          });
          console.log('Support notification email sent for:', email);

          // Send confirmation email to lead
          await resend.emails.send({
            from: 'AlCor Nexus <onboarding@resend.dev>',
            to: [email],
            subject: `We received your message, ${name.split(' ')[0]}!`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #0d9488; font-size: 28px; margin: 0;">AlCor Nexus</h1>
                  <p style="color: #64748b; font-size: 14px; margin-top: 8px;">AI-Powered Business Solutions</p>
                </div>
                
                <div style="background: linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%); border-radius: 12px; padding: 32px; margin-bottom: 24px;">
                  <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Hi ${name.split(' ')[0]},</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                    Thank you for reaching out! We've received your inquiry about <strong>${businessTypeLabels[business_type]}</strong>.
                  </p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                    Our team will review your message and get back to you within 24 hours.
                  </p>
                </div>
                
                <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Questions? Reply to this email or visit <a href="https://alcornexus.com" style="color: #0d9488;">alcornexus.com</a>
                  </p>
                  <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">
                    © ${new Date().getFullYear()} AlCor Nexus. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          });
          console.log('Confirmation email sent to:', email);
        } catch (emailError) {
          console.error('Failed to send emails:', emailError);
          // Don't fail the request if email fails
        }
      } else {
        console.log('RESEND_API_KEY not configured, skipping emails');
      }

      return new Response(
        JSON.stringify({ success: true, id: insertData.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get available time slots
    if (action === 'get_available_slots') {
      // Validate input
      const validation = getAvailableSlotsSchema.safeParse(requestBody);
      if (!validation.success) {
        const errors = getValidationErrors(validation);
        console.error('Validation error:', errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { date } = validation.data;
      const accessToken = await getSuperAdminCalendarToken();

      if (!accessToken) {
        return new Response(
          JSON.stringify({ 
            error: 'Calendar not available',
            slots: [] 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get events for the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const eventsResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events?timeMin=${encodeURIComponent(startOfDay.toISOString())}&timeMax=${encodeURIComponent(endOfDay.toISOString())}&singleEvents=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!eventsResponse.ok) {
        console.error('Failed to fetch calendar events');
        return new Response(
          JSON.stringify({ slots: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const eventsData = await eventsResponse.json();
      // deno-lint-ignore no-explicit-any
      const busyTimes = (eventsData.items || []).map((event: any) => ({
        start: new Date(event.start?.dateTime || event.start?.date),
        end: new Date(event.end?.dateTime || event.end?.date),
      }));

      // Generate available 30-minute slots between 9 AM and 6 PM
      const slots: string[] = [];
      const slotDate = new Date(date);
      
      for (let hour = 9; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = new Date(slotDate);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + 30);

          // Skip if slot is in the past
          if (slotStart <= new Date()) continue;

          // Check if slot conflicts with any busy time
          const isConflicting = busyTimes.some((busy: { start: Date; end: Date }) => 
            (slotStart >= busy.start && slotStart < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end)
          );

          if (!isConflicting) {
            slots.push(slotStart.toISOString());
          }
        }
      }

      return new Response(
        JSON.stringify({ slots }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Book a demo call
    if (action === 'book_demo') {
      // Validate input
      const validation = bookDemoSchema.safeParse(requestBody);
      if (!validation.success) {
        const errors = getValidationErrors(validation);
        console.error('Validation error:', errors);
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { demoRequestId, name, email, phone, company, businessType, scheduledTime, message } = validation.data;
      const normalizedPhone = normalizePhoneNumber(phone);
      
      const accessToken = await getSuperAdminCalendarToken();

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Calendar not available', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create calendar event
      const startTime = new Date(scheduledTime);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const businessTypeLabels: Record<string, string> = {
        sales: 'Sales & Lead Generation',
        food: 'Food & Restaurant',
        hospitality: 'Hotels & Hospitality',
        other: 'Others (Custom AI Agent)',
      };

      // Sanitize user inputs for calendar description
      const sanitizedName = name.substring(0, 100);
      const sanitizedCompany = (company || 'Not provided').substring(0, 200);
      const sanitizedPhone = (normalizedPhone || phone || 'Not provided').substring(0, 20);
      const sanitizedMessage = (message || 'No message provided').substring(0, 1000);

      const eventBody = {
        summary: `Demo Call: ${sanitizedName} - ${sanitizedCompany === 'Not provided' ? 'AlCor Nexus' : sanitizedCompany}`,
        description: `Demo call with a potential customer.

Name: ${sanitizedName}
Email: ${email}
Phone: ${sanitizedPhone}
Company: ${sanitizedCompany}
Business Type: ${businessTypeLabels[businessType] || businessType}

Message from lead:
${sanitizedMessage}

---
This demo was booked via the AlCor Nexus website.`,
        start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Manila' },
        end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Manila' },
        attendees: [{ email }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      console.log('Creating calendar event for:', email);

      const createResponse = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Event creation error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to create calendar event', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdEvent = await createResponse.json();
      console.log('Calendar event created:', createdEvent.id);

      // Update the demo request with the calendar event ID and scheduled time
      if (demoRequestId) {
        await supabase
          .from('demo_requests')
          .update({ 
            status: 'scheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', demoRequestId);
      }

      // Send booking confirmation email
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          
          // Format date and time for email
          const formattedDate = startTime.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Asia/Manila'
          });
          const formattedTime = startTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: 'Asia/Manila'
          });

          await resend.emails.send({
            from: 'AlCor Nexus <onboarding@resend.dev>',
            to: [email],
            subject: `Your Demo Call is Confirmed - ${formattedDate}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #0d9488; font-size: 28px; margin: 0;">AlCor Nexus</h1>
                  <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Your Demo is Scheduled!</p>
                </div>
                
                <div style="background: linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%); border-radius: 12px; padding: 32px; margin-bottom: 24px;">
                  <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Hi ${sanitizedName.split(' ')[0]},</h2>
                  <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
                    Great news! Your demo call has been confirmed. We're looking forward to showing you how our AI can transform your business.
                  </p>
                </div>
                
                <div style="background: #0d9488; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Demo Call</p>
                  <p style="color: #fff; font-size: 24px; font-weight: 600; margin: 0 0 4px 0;">${formattedDate}</p>
                  <p style="color: #fff; font-size: 20px; margin: 0;">${formattedTime} (PHT)</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 12px 0;">What to expect:</h3>
                  <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>30-minute personalized demo session</li>
                    <li>Live demonstration of our AI capabilities</li>
                    <li>Q&A session tailored to your business needs</li>
                    <li>Discussion of pricing and implementation</li>
                  </ul>
                </div>
                
                <div style="text-align: center; margin-bottom: 24px;">
                  <p style="color: #64748b; font-size: 14px; margin: 0;">
                    A calendar invite has been sent to your email. Need to reschedule? 
                    <a href="mailto:support@alcornexus.com" style="color: #0d9488;">Contact us</a>
                  </p>
                </div>
                
                <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} AlCor Nexus. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          });
          console.log('Booking confirmation email sent to:', email);
        } catch (emailError) {
          console.error('Failed to send booking confirmation email:', emailError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          eventId: createdEvent.id,
          message: 'Demo call scheduled successfully',
          scheduledTime: startTime.toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in book-demo function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
