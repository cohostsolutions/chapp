import { serve } from "std/http/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkDatabaseRateLimit, checkMemoryRateLimit, createRateLimitHeaders, RATE_LIMITS as _RATE_LIMITS, getClientIp as _getClientIp } from "../_shared/rateLimit.ts";

// deno-lint-ignore no-explicit-any
type AppSupabaseClient = SupabaseClient<any, "public", any>;

// Rate limiting configuration for webhooks
const WEBHOOK_RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 100, // Per sender per minute
  keyPrefix: 'webhook'
};

// Message deduplication: Track processed message IDs
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL_MS = 300000; // 5 minutes

// Response delay configuration - simulate human-like typing
const MIN_RESPONSE_DELAY_MS = 3000; // Minimum 3 seconds
const MAX_RESPONSE_DELAY_MS = 8000; // Maximum 8 seconds
const CHARS_PER_SECOND = 30; // Approximate typing speed

// Debounce window in milliseconds - increased to better capture rapid consecutive messages
const DEBOUNCE_WINDOW_MS = 5000; // 5 seconds - wait for follow-up messages

// Processing state tracking - prevents race conditions between parallel webhook workers
const processingLeads = new Map<string, { startedAt: number; messageId: string }>();
const PROCESSING_EXPIRY_MS = 30000; // 30 seconds max processing time

// Processing lock timeout (60 seconds) - prevents orphaned locks
const _PROCESSING_LOCK_TIMEOUT_MS = 60000;

// HMAC signature verification for Meta webhooks
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';

// Use centralized helpers for DB-backed processing locks and deterministic AI actions
import { claimProcessingLock, releaseProcessingLock } from '../_helpers/locks.ts';
import { applyPreparedAIResponseActions, prepareAIResponseForDelivery } from '../_helpers/ai-actions.ts';
import {
  parseBurstResponse as _parseBurstResponse,
  calculateTypingDelay as _calculateTypingDelay,
  validateBurstLength as _validateBurstLength,
  cleanMessageForDelivery as _cleanMessageForDelivery,
  delayMs as _delayMs,
  createBurstPromptInstruction as _createBurstPromptInstruction,
  shouldSelfCorrect as _shouldSelfCorrect,
  buildReflectionMessage as _buildReflectionMessage,
  DEFAULT_BURST_CONFIG as _DEFAULT_BURST_CONFIG,
  type MessageBurst as _MessageBurst,
  type BurstConfig as _BurstConfig,
} from '../_shared/burst-messaging.ts';
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";
import { getAgentTemperature } from "../_shared/ai-utils.ts";

// WebCrypto-based HMAC-SHA256 verification (replaces node:crypto)
async function verifyMetaSignature(payload: string, signature: string | null): Promise<boolean> {
  if (!META_APP_SECRET) {
    console.error('META_APP_SECRET not configured - rejecting request for security');
    return false; // Fail-closed: reject requests when secret is not configured
  }
  
  if (!signature) {
    console.warn('No X-Hub-Signature-256 header present');
    return false;
  }
  
  // Meta sends signature as "sha256=<hash>"
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    console.warn('Invalid signature format - missing sha256= prefix');
    return false;
  }
  
  const receivedHash = signature.slice(expectedPrefix.length);
  
  try {
    // Use WebCrypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(META_APP_SECRET);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Constant-time comparison to prevent timing attacks
    if (receivedHash.length !== expectedHash.length) {
      console.warn('Signature length mismatch');
      return false;
    }
    
    let mismatch = 0;
    for (let i = 0; i < receivedHash.length; i++) {
      mismatch |= receivedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    
    if (mismatch !== 0) {
      console.warn('HMAC signature verification failed - possible spoofed request');
      return false;
    }
    
    console.log('HMAC signature verified successfully');
    return true;
  } catch (err) {
    console.error('Error during HMAC verification:', err);
    return false;
  }
}

/**
 * Combined rate limiting: uses memory for burst protection + database for persistent limits
 * This ensures rate limits persist across cold starts
 */
async function checkCombinedRateLimit(
  supabase: SupabaseClient,
  senderId: string
): Promise<{ allowed: boolean; remaining: number; headers: Record<string, string> }> {
  // First check in-memory burst limit (fast, catches rapid attacks)
  const burstResult = checkMemoryRateLimit(`burst:${senderId}`, {
    windowMs: 10000, // 10 seconds
    maxRequests: 10  // Max 10 messages per 10 seconds
  });
  
  if (!burstResult.allowed) {
    console.warn(`Burst rate limit exceeded for sender: ${senderId}`);
    return {
      allowed: false,
      remaining: 0,
      headers: createRateLimitHeaders(burstResult)
    };
  }
  
  // Then check database-backed sustained limit (persists across cold starts)
  // deno-lint-ignore no-explicit-any
  const sustainedResult = await checkDatabaseRateLimit(supabase as any, senderId, {
    windowMs: WEBHOOK_RATE_LIMIT.windowMs,
    maxRequests: WEBHOOK_RATE_LIMIT.maxRequests,
    keyPrefix: WEBHOOK_RATE_LIMIT.keyPrefix
  });
  
  if (!sustainedResult.allowed) {
    console.warn(`Sustained rate limit exceeded for sender: ${senderId}`);
  }
  
  return {
    allowed: sustainedResult.allowed,
    remaining: sustainedResult.remaining,
    headers: createRateLimitHeaders(sustainedResult)
  };
}

function isDuplicateMessage(messageId: string): boolean {
  const now = Date.now();
  
  // Clean up old entries
  for (const [id, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
  
  if (processedMessages.has(messageId)) {
    console.log(`Duplicate message detected (in-memory): ${messageId}`);
    return true;
  }
  
  processedMessages.set(messageId, now);
  return false;
}

// Database-backed deduplication for persistent idempotency across cold starts
async function _checkAndMarkProcessed(messageId: string, platform: string): Promise<boolean> {
  // Try to insert into webhook_processed_messages table
  // If it fails with unique violation, the message was already processed
  const { error } = await supabase
    .from('webhook_processed_messages')
    .insert({
      external_id: messageId,
      platform: platform,
      processed_at: new Date().toISOString()
    });
  
  if (error) {
    if (error.code === '23505') { // Unique violation - already processed
      console.log(`Duplicate message detected (database): ${messageId}`);
      return true;
    }
    // Other errors - log but don't block (fall back to in-memory only)
    console.error('Error checking message dedup:', error);
  }
  
  return false;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || '';
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!;

const supabase: AppSupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Vault enabled flag (set during initialization)
let vaultEnabled = false;

// Language code to full name mapping
const languageNames: Record<string, string> = {
  en: 'English', es: 'Spanish', zh: 'Chinese (Mandarin)', ar: 'Arabic',
  fr: 'French', pt: 'Portuguese', de: 'German', ja: 'Japanese',
  ko: 'Korean', it: 'Italian', tl: 'Tagalog', ceb: 'Cebuano', ilo: 'Ilocano',
};

function getLanguageName(code: string): string {
  if (code.startsWith('custom:')) return code.replace('custom:', '').charAt(0).toUpperCase() + code.replace('custom:', '').slice(1);
  return languageNames[code] || code;
}

function isExemptOrganization(orgName: string): boolean {
  const lowerName = orgName.toLowerCase();
  return lowerName.includes('guilcor') || lowerName.includes('cohost solutions');
}

function buildLanguageInstructions(allowedLanguages: string[], languageLockEnabled: boolean, isExempt: boolean): string {
  if (isExempt || !languageLockEnabled) {
    return `CRITICAL LANGUAGE INSTRUCTIONS:
- Automatically detect the language(s) the lead is using and ALWAYS respond in the same language(s).
- If the lead uses mixed languages (e.g., Taglish), respond in the same mixed style.
- Mirror whatever language the user prefers - you are NOT restricted to any specific languages.`;
  }
  const languageList = allowedLanguages.map(getLanguageName).join(', ');
  const primaryLanguage = getLanguageName(allowedLanguages[0] || 'en');
  return `CRITICAL LANGUAGE INSTRUCTIONS:
- You are ONLY allowed to respond in: ${languageList}. Default: ${primaryLanguage}.
- If the lead uses a language NOT in your allowed list, politely respond in ${primaryLanguage}.
- NEVER respond in a language outside your allowed list.`;
}

// Shared conversation instructions for all agents
const sharedInstructions = `
CONVERSATION CONTINUITY INSTRUCTIONS:
- You have access to the FULL conversation history. Use it to maintain context.
- NEVER repeat information you've already provided unless specifically asked.
- NEVER ask questions you've already asked - reference previous answers instead.
- Track what you've discussed and build upon it naturally.
`;

// Status update types from Meta webhooks
interface StatusUpdate {
  platform: 'messenger' | 'whatsapp' | 'instagram';
  messageId: string;
  status: 'delivered' | 'read' | 'sent' | 'failed';
  timestamp: number;
  recipientId?: string;
}

// Reaction types from Meta webhooks
interface ReactionUpdate {
  platform: 'messenger' | 'whatsapp' | 'instagram';
  messageId: string;
  emoji: string;
  action: 'react' | 'unreact';
  senderId: string;
  timestamp: number;
}

// Type guard for webhook body structure
function isWebhookBody(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}

// Extract reaction updates from Meta webhooks
function extractReactionUpdate(body: unknown): ReactionUpdate | null {
  try {
    if (!isWebhookBody(body)) return null;
    
    // Messenger/Instagram reactions
    const entry = Array.isArray(body.entry) ? body.entry : [];
    const firstEntry = entry[0];
    if (!isWebhookBody(firstEntry)) return null;
    
    const messaging = Array.isArray(firstEntry.messaging) ? firstEntry.messaging : [];
    const firstMsg = messaging[0];
    if (isWebhookBody(firstMsg) && isWebhookBody(firstMsg.reaction)) {
      const reaction = firstMsg.reaction;
      const platform = body.object === 'instagram' ? 'instagram' : 'messenger';
      
      console.log('Reaction update:', JSON.stringify(reaction));
      
      return {
        platform,
        messageId: typeof reaction.mid === 'string' ? reaction.mid : '',
        emoji: typeof reaction.emoji === 'string' ? reaction.emoji : '',
        action: typeof reaction.action === 'string' && reaction.action === 'unreact' ? 'unreact' : 'react',
        senderId: typeof firstMsg.sender === 'object' && firstMsg.sender !== null && typeof (firstMsg.sender as Record<string, unknown>).id === 'string' ? ((firstMsg.sender as Record<string, unknown>).id as string) : '',
        timestamp: typeof firstMsg.timestamp === 'number' ? firstMsg.timestamp : Date.now()
      };
    }
    
    // Try WhatsApp reactions
    const changes = Array.isArray(firstEntry.changes) ? firstEntry.changes : [];
    const firstChange = changes[0];
    if (!isWebhookBody(firstChange) || !isWebhookBody(firstChange.value)) return null;
    
    const value = firstChange.value as Record<string, unknown>;
    const messages = Array.isArray(value.messages) ? value.messages : [];
    const firstMessage = messages[0];
    if (!isWebhookBody(firstMessage) || firstMessage.type !== 'reaction') return null;
    
    const reaction = firstMessage.reaction;
    if (!isWebhookBody(reaction)) return null;
    
    return {
      platform: 'whatsapp',
      messageId: typeof firstMessage.id === 'string' ? firstMessage.id : '',
      emoji: typeof reaction.emoji === 'string' ? reaction.emoji : '',
      action: 'react',
      senderId: typeof firstMessage.from === 'string' ? firstMessage.from : '',
      timestamp: typeof firstMessage.timestamp === 'number' ? firstMessage.timestamp : Date.now()
    };
  } catch (err) {
    console.error('Error extracting reaction update:', err);
  }
  return null;
}

// Handle reaction updates by updating the communications metadata
async function handleReactionUpdate(reaction: ReactionUpdate): Promise<void> {
  console.log(`Processing ${reaction.platform} reaction: ${reaction.action} ${reaction.emoji} for message ${reaction.messageId}`);

  try {
    // Find the message by external_id
    const { data: comm, error: findError } = await supabase
      .from('communications')
      .select('id, metadata')
      .eq('external_id', reaction.messageId)
      .single();

    if (findError || !comm) {
      console.log('Message not found for reaction:', reaction.messageId);
      return;
    }

    // Get existing reactions from metadata
    const metadata = (comm.metadata || {}) as Record<string, unknown>;
    const reactions = metadata.reactions || {};

    if (reaction.action === 'react') {
      // Add reaction
      if (!reactions[reaction.emoji]) {
        reactions[reaction.emoji] = [];
      }
      if (!reactions[reaction.emoji].includes(reaction.senderId)) {
        reactions[reaction.emoji].push(reaction.senderId);
      }
    } else {
      // Remove reaction
      if (reactions[reaction.emoji]) {
        reactions[reaction.emoji] = reactions[reaction.emoji].filter(
          (id: string) => id !== reaction.senderId
        );
        if (reactions[reaction.emoji].length === 0) {
          delete reactions[reaction.emoji];
        }
      }
    }

    // Update metadata with new reactions
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        metadata: { ...metadata, reactions },
        updated_at: new Date().toISOString()
      })
      .eq('id', comm.id);

    if (updateError) {
      console.error('Error updating reaction:', updateError);
    } else {
      console.log(`Updated reactions for message ${reaction.messageId}`);
    }
  } catch (err) {
    console.error('Error handling reaction update:', err);
  }
}

// Extract status updates from Meta webhooks
function extractStatusUpdate(body: unknown): StatusUpdate | null {
  try {
    const b = body as unknown & Record<string, unknown>;
    
    // WhatsApp status updates
    if (b.entry?.[0]?.changes?.[0]?.value?.statuses) {
      const statuses = (b.entry as unknown[])[0] as Record<string, unknown>;
      const changes = statuses.changes as unknown[];
      const firstChange = changes[0] as Record<string, unknown>;
      const value = firstChange.value as Record<string, unknown>;
      const statusesArray = value.statuses as unknown[];
      const firstStatus = statusesArray[0] as Record<string, unknown>;
      
      console.log('WhatsApp status update:', JSON.stringify(firstStatus));
      return {
        platform: 'whatsapp',
        messageId: typeof firstStatus.id === 'string' ? firstStatus.id : '',
        status: (typeof firstStatus.status === 'string' ? firstStatus.status : 'sent') as StatusUpdate['status'],
        timestamp: typeof firstStatus.timestamp === 'string' ? parseInt(firstStatus.timestamp) * 1000 : Date.now(),
        recipientId: typeof firstStatus.recipient_id === 'string' ? firstStatus.recipient_id : ''
      };
    }

    // Messenger delivery receipts
    if (b.entry?.[0]?.messaging?.[0]?.delivery) {
      const entries = b.entry as unknown[];
      const firstEntry = entries[0] as Record<string, unknown>;
      const messaging = firstEntry.messaging as unknown[];
      const firstMsg = messaging[0] as Record<string, unknown>;
      const delivery = firstMsg.delivery as Record<string, unknown>;
      const mids = delivery.mids as unknown[];
      
      console.log('Messenger delivery receipt:', JSON.stringify(delivery));
      if (mids && mids.length > 0) {
        return {
          platform: 'messenger',
          messageId: typeof mids[0] === 'string' ? mids[0] : '',
          status: 'delivered',
          timestamp: typeof delivery.watermark === 'number' ? delivery.watermark : Date.now(),
          recipientId: typeof firstMsg.recipient === 'object' && firstMsg.recipient !== null ? typeof (firstMsg.recipient as Record<string, unknown>).id === 'string' ? ((firstMsg.recipient as Record<string, unknown>).id as string) : '' : ''
        };
      }
    }

    // Messenger read receipts
    if (b.entry?.[0]?.messaging?.[0]?.read) {
      const entries = b.entry as unknown[];
      const firstEntry = entries[0] as Record<string, unknown>;
      const messaging = firstEntry.messaging as unknown[];
      const firstMsg = messaging[0] as Record<string, unknown>;
      const read = firstMsg.read as Record<string, unknown>;
      
      console.log('Messenger read receipt:', JSON.stringify(read));
      return {
        platform: 'messenger',
        messageId: `read_${typeof read.watermark === 'number' ? read.watermark : '0'}`,
        status: 'read',
        timestamp: typeof read.watermark === 'number' ? read.watermark : Date.now(),
        recipientId: typeof firstMsg.recipient === 'object' && firstMsg.recipient !== null ? typeof (firstMsg.recipient as Record<string, unknown>).id === 'string' ? ((firstMsg.recipient as Record<string, unknown>).id as string) : '' : ''
      };
    }

    // Instagram delivery/read receipts (same structure as Messenger)
    if (b.object === 'instagram' && b.entry?.[0]?.messaging?.[0]?.delivery) {
      const entries = b.entry as unknown[];
      const firstEntry = entries[0] as Record<string, unknown>;
      const messaging = firstEntry.messaging as unknown[];
      const firstMsg = messaging[0] as Record<string, unknown>;
      const delivery = firstMsg.delivery as Record<string, unknown>;
      const mids = delivery.mids as unknown[];
      
      console.log('Instagram delivery receipt:', JSON.stringify(delivery));
      if (mids && mids.length > 0) {
        return {
          platform: 'instagram',
          messageId: typeof mids[0] === 'string' ? mids[0] : '',
          status: 'delivered',
          timestamp: typeof delivery.watermark === 'number' ? delivery.watermark : Date.now()
        };
      }
    }

    if (b.object === 'instagram' && b.entry?.[0]?.messaging?.[0]?.read) {
      const entries = b.entry as unknown[];
      const firstEntry = entries[0] as Record<string, unknown>;
      const messaging = firstEntry.messaging as unknown[];
      const firstMsg = messaging[0] as Record<string, unknown>;
      const read = firstMsg.read as Record<string, unknown>;
      
      console.log('Instagram read receipt:', JSON.stringify(read));
      return {
        platform: 'instagram',
        messageId: `read_${typeof read.watermark === 'number' ? read.watermark : '0'}`,
        status: 'read',
        timestamp: typeof read.watermark === 'number' ? read.watermark : Date.now()
      };
    }
  } catch (err) {
    console.error('Error extracting status update:', err);
  }
  return null;
}

// Handle status updates by updating the communications table
async function handleStatusUpdate(statusUpdate: StatusUpdate): Promise<void> {
  console.log(`Processing ${statusUpdate.platform} status update: ${statusUpdate.status} for message ${statusUpdate.messageId}`);

  try {
    // For read receipts, we need to update all unread messages for the specific lead
    if (statusUpdate.status === 'read' && statusUpdate.messageId.startsWith('read_')) {
      const watermark = parseInt(statusUpdate.messageId.replace('read_', ''));
      const watermarkDate = new Date(watermark).toISOString();
      
      // First, find a recent outbound message to get the lead_id context
      const { data: recentMessage, error: findError } = await supabase
        .from('communications')
        .select('lead_id, organization_id')
        .eq('channel', statusUpdate.platform)
        .eq('direction', 'outbound')
        .in('status', ['sent', 'delivered'])
        .lt('created_at', watermarkDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findError || !recentMessage) {
        console.log('No matching outbound message found for read receipt');
        return;
      }

      // Update only messages for this specific lead
      const { data: updated, error } = await supabase
        .from('communications')
        .update({ 
          status: 'read',
          updated_at: new Date().toISOString()
        })
        .eq('channel', statusUpdate.platform)
        .eq('direction', 'outbound')
        .eq('lead_id', recentMessage.lead_id)
        .in('status', ['sent', 'delivered'])
        .lt('created_at', watermarkDate)
        .select('id');

      if (error) {
        console.error('Error updating read status:', error);
      } else {
        console.log(`Updated ${updated?.length || 0} messages to read status for lead ${recentMessage.lead_id}`);
      }
      return;
    }

    // For specific message status updates (delivered, sent, failed)
    const { data: updated, error } = await supabase
      .from('communications')
      .update({ 
        status: statusUpdate.status,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', statusUpdate.messageId)
      .select('id');

    if (error) {
      console.error('Error updating message status:', error);
    } else if (updated && updated.length > 0) {
      console.log(`Updated message ${statusUpdate.messageId} to status ${statusUpdate.status}`);
    } else {
      console.log(`No message found with external_id ${statusUpdate.messageId}`);
    }
  } catch (err) {
    console.error('Error handling status update:', err);
  }
}

// Platform detection based on webhook payload structure
function detectPlatform(body: unknown): 'messenger' | 'whatsapp' | 'instagram' | null {
  console.log('Detecting platform from body:', JSON.stringify(body).slice(0, 300));
  
  const b = body as unknown & Record<string, unknown>;
  
  // Skip if this is a status update (already handled)
  const entries = Array.isArray(b.entry) ? (b.entry as unknown[]) : [];
  if (entries.length > 0) {
    const firstEntry = entries[0] as unknown & Record<string, unknown>;
    
    // Check WhatsApp status updates
    if (Array.isArray(firstEntry.changes)) {
      const changes = firstEntry.changes as unknown[];
      if (changes.length > 0) {
        const firstChange = changes[0] as unknown & Record<string, unknown>;
        if (typeof firstChange.value === 'object' && firstChange.value !== null) {
          const value = firstChange.value as Record<string, unknown>;
          if (Array.isArray(value.statuses)) return null;
        }
      }
    }
    
    // Check messenger/Instagram delivery/read
    if (Array.isArray(firstEntry.messaging)) {
      const messaging = firstEntry.messaging as unknown[];
      if (messaging.length > 0) {
        const firstMsg = messaging[0] as unknown & Record<string, unknown>;
        if (typeof firstMsg.delivery === 'object' || typeof firstMsg.read === 'object') return null;
      }
    }
  }
  
  // Identify messenger platform
  if (b.object === 'page' && entries.length > 0) {
    const firstEntry = entries[0] as unknown & Record<string, unknown>;
    if (Array.isArray(firstEntry.messaging)) {
      console.log('Detected platform: messenger');
      return 'messenger';
    }
  }
  
  // Identify WhatsApp platform
  if (b.object === 'whatsapp_business_account') {
    console.log('Detected platform: whatsapp');
    return 'whatsapp';
  }
  
  if (entries.length > 0) {
    const firstEntry = entries[0] as unknown & Record<string, unknown>;
    if (Array.isArray(firstEntry.changes)) {
      const changes = firstEntry.changes as unknown[];
      if (changes.length > 0) {
        const firstChange = changes[0] as unknown & Record<string, unknown>;
        if (typeof firstChange.value === 'object' && firstChange.value !== null) {
          const value = firstChange.value as Record<string, unknown>;
          if (value.messaging_product === 'whatsapp') {
            console.log('Detected platform: whatsapp');
            return 'whatsapp';
          }
        }
      }
    }
  }
  
  // Identify Instagram platform
  if (b.object === 'instagram' && entries.length > 0) {
    const firstEntry = entries[0] as unknown & Record<string, unknown>;
    if (Array.isArray(firstEntry.messaging)) {
      console.log('Detected platform: instagram');
      return 'instagram';
    }
  }
  
  console.log('Could not detect platform, object:', b.object);
  return null;
}

// Extract message data based on platform - now includes image URLs
function extractMessageData(
  body: unknown,
  platform: string,
): {
  senderId: string;
  messageText: string;
  pageId: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  imageUrls?: string[];
} | null {
  try {
    if (!isWebhookBody(body)) return null;

    if (platform === 'messenger') {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      const firstEntry = entries[0];
      if (!isWebhookBody(firstEntry)) return null;

      const messagingArr = Array.isArray(firstEntry.messaging) ? firstEntry.messaging : [];
      const messaging = messagingArr[0];
      if (!isWebhookBody(messaging)) return null;

      const messageObj = isWebhookBody(messaging.message) ? messaging.message : {};
      const senderObj = isWebhookBody(messaging.sender) ? messaging.sender : {};
      const recipientObj = isWebhookBody(messaging.recipient) ? messaging.recipient : {};

      const pageId = typeof firstEntry.id === 'string' ? firstEntry.id : '';
      const isEcho = Boolean((messageObj as Record<string, unknown>).is_echo) || (typeof senderObj.id === 'string' && senderObj.id === pageId);

      const leadExternalId = isEcho
        ? (typeof recipientObj.id === 'string' ? recipientObj.id : undefined)
        : (typeof senderObj.id === 'string' ? senderObj.id : undefined);

      if (!leadExternalId) {
        console.warn('Messenger payload missing lead id (sender/recipient)');
        return null;
      }

      const attachments = Array.isArray((messageObj as Record<string, unknown>).attachments)
        ? ((messageObj as { attachments: unknown[] }).attachments)
        : [];

      const imageUrls: string[] = [];
      let hasNonTextAttachment = false;

      for (const attachment of attachments) {
        const attObj = attachment as Record<string, unknown>;
        const type = typeof attObj.type === 'string' ? attObj.type : '';
        const payload = isWebhookBody(attObj.payload) ? attObj.payload : {};
        const url = typeof payload.url === 'string' ? payload.url : '';
        if (type === 'image' && url) {
          imageUrls.push(url);
        } else if (type) {
          hasNonTextAttachment = true;
        }
      }

      const postbackObj = isWebhookBody(messaging.postback) ? messaging.postback : {};
      const postbackText =
        (typeof postbackObj.title === 'string' && postbackObj.title.trim()) ||
        (typeof postbackObj.payload === 'string' && postbackObj.payload.trim()) ||
        '';

      const rawTextValue = (messageObj as Record<string, unknown>).text;
      const rawText = typeof rawTextValue === 'string' ? rawTextValue : '';
      const hasPostback = Boolean(postbackObj && Object.keys(postbackObj).length > 0);

      const messageText =
        rawText.trim() ||
        postbackText ||
        (hasPostback ? '[Postback received]' : '') ||
        (imageUrls.length > 0 ? '[Image sent]' : (hasNonTextAttachment ? '[Attachment received]' : ''));

      const fallbackMessageId = typeof messaging.timestamp === 'number'
        ? `ts_${messaging.timestamp}`
        : crypto.randomUUID();

      const messageIdCandidate = (messageObj as Record<string, unknown>).mid;
      const postbackMid = (postbackObj as Record<string, unknown>).mid;

      const result = {
        senderId: leadExternalId ?? '',
        messageText,
        pageId,
        messageId: typeof messageIdCandidate === 'string'
          ? messageIdCandidate
          : typeof postbackMid === 'string'
            ? postbackMid
            : fallbackMessageId,
        direction: isEcho && !hasPostback ? 'outbound' as const : 'inbound' as const,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      console.log(
        'Extracted messenger data:',
        JSON.stringify({ ...result, imageCount: imageUrls.length, isEcho }),
      );
      return result;
    }

    if (platform === 'whatsapp') {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      const firstEntry = entries[0];
      if (!isWebhookBody(firstEntry)) return null;

      const changes = Array.isArray(firstEntry.changes) ? firstEntry.changes : [];
      const firstChange = changes[0];
      if (!isWebhookBody(firstChange) || !isWebhookBody(firstChange.value)) return null;

      const value = firstChange.value;
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const message = messages[0];
      if (!isWebhookBody(message)) {
        console.log('No WhatsApp message found in payload');
        return null;
      }

      let messageText = '';
      const imageUrls: string[] = [];

      const messageType = typeof message.type === 'string' ? message.type : '';
      if (messageType === 'text' && isWebhookBody(message.text)) {
        messageText = typeof message.text.body === 'string' ? message.text.body : '';
      } else if (messageType === 'image' && isWebhookBody(message.image)) {
        const caption = typeof message.image.caption === 'string' ? message.image.caption : '';
        messageText = caption || '[Image sent]';
        if (typeof message.image.id === 'string') {
          messageText = caption || '[Image received - analyzing...]';
        }
      } else if (messageType === 'video' && isWebhookBody(message.video)) {
        messageText = typeof message.video.caption === 'string' ? message.video.caption : '[Video received]';
      } else if (messageType === 'audio') {
        messageText = '[Voice message received]';
      } else if (messageType === 'document' && isWebhookBody(message.document)) {
        const filename = typeof message.document.filename === 'string' ? message.document.filename : 'file';
        messageText = `[Document received: ${filename}]`;
      } else if (messageType === 'sticker') {
        messageText = '[Sticker received]';
      } else if (messageType === 'location' && isWebhookBody(message.location)) {
        const lat = typeof message.location.latitude === 'number' ? message.location.latitude : '';
        const lng = typeof message.location.longitude === 'number' ? message.location.longitude : '';
        messageText = `[Location shared: ${lat}, ${lng}]`;
      } else if (messageType === 'contacts') {
        messageText = '[Contact shared]';
      } else if (messageType === 'interactive' && isWebhookBody(message.interactive)) {
        if (message.interactive.type === 'button_reply' && isWebhookBody(message.interactive.button_reply)) {
          messageText = typeof message.interactive.button_reply.title === 'string'
            ? message.interactive.button_reply.title
            : '[Button clicked]';
        } else if (message.interactive.type === 'list_reply' && isWebhookBody(message.interactive.list_reply)) {
          messageText = typeof message.interactive.list_reply.title === 'string'
            ? message.interactive.list_reply.title
            : '[List item selected]';
        } else {
          messageText = '[Interactive message]';
        }
      } else {
        messageText = `[${messageType || 'Unknown'} message received]`;
      }

      const senderId = typeof message.from === 'string' ? message.from : '';
      const pageId = isWebhookBody(value.metadata) && typeof value.metadata.phone_number_id === 'string'
        ? value.metadata.phone_number_id
        : '';
      const messageId = typeof message.id === 'string' ? message.id : crypto.randomUUID();

      const result = {
        senderId,
        messageText,
        pageId,
        messageId,
        direction: 'inbound' as const,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };
      console.log('Extracted WhatsApp data:', JSON.stringify(result));
      return result;
    }

    if (platform === 'instagram') {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      const firstEntry = entries[0];
      if (!isWebhookBody(firstEntry)) return null;

      const messagingArr = Array.isArray(firstEntry.messaging) ? firstEntry.messaging : [];
      const messaging = messagingArr[0];
      if (!isWebhookBody(messaging)) return null;

      const messageObj = isWebhookBody(messaging.message) ? messaging.message : {};
      const senderObj = isWebhookBody(messaging.sender) ? messaging.sender : {};
      const recipientObj = isWebhookBody(messaging.recipient) ? messaging.recipient : {};

      const pageId = typeof firstEntry.id === 'string' ? firstEntry.id : '';
      const isEcho = Boolean((messageObj as Record<string, unknown>).is_echo) || (typeof senderObj.id === 'string' && senderObj.id === pageId);

      const leadExternalId = isEcho
        ? (typeof recipientObj.id === 'string' ? recipientObj.id : undefined)
        : (typeof senderObj.id === 'string' ? senderObj.id : undefined);

      if (!leadExternalId) {
        console.warn('Instagram payload missing lead id (sender/recipient)');
        return null;
      }

      const attachments = Array.isArray((messageObj as Record<string, unknown>).attachments)
        ? ((messageObj as { attachments: unknown[] }).attachments)
        : [];

      const imageUrls: string[] = [];
      let hasNonTextAttachment = false;

      for (const attachment of attachments) {
        const attObj = attachment as Record<string, unknown>;
        const type = typeof attObj.type === 'string' ? attObj.type : '';
        const payload = isWebhookBody(attObj.payload) ? attObj.payload : {};
        const url = typeof payload.url === 'string' ? payload.url : '';
        if (type === 'image' && url) {
          imageUrls.push(url);
        } else if (type) {
          hasNonTextAttachment = true;
        }
      }

      const rawTextValue = (messageObj as Record<string, unknown>).text;
      const rawText = typeof rawTextValue === 'string' ? rawTextValue : '';

      const messageText =
        rawText.trim() ||
        (imageUrls.length > 0 ? '[Image sent]' : (hasNonTextAttachment ? '[Attachment received]' : ''));

      const fallbackMessageId = typeof messaging.timestamp === 'number'
        ? `ts_${messaging.timestamp}`
        : crypto.randomUUID();

      const messageIdCandidate = (messageObj as Record<string, unknown>).mid;

      const result = {
        senderId: leadExternalId ?? '',
        messageText,
        pageId,
        messageId: typeof messageIdCandidate === 'string' ? messageIdCandidate : fallbackMessageId,
        direction: isEcho ? 'outbound' as const : 'inbound' as const,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      console.log(
        'Extracted Instagram data:',
        JSON.stringify({ ...result, imageCount: imageUrls.length, isEcho }),
      );
      return result;
    }
  } catch (e) {
    console.error('Error extracting message data:', e);
  }
  return null;
}

// Record webhook health for monitoring
async function recordWebhookHealth(
  platformId: string,
  _organizationId: string,
  _platform: string,
  received: boolean,
  _processed: boolean,
  _error: string | null
) {
  try {
    // Update last_webhook_received timestamp on social_platforms table
    if (received) {
      await supabase
        .from('social_platforms')
        .update({ 
          last_webhook_received: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', platformId);
    }
  } catch (e) {
    console.error('Error recording webhook health:', e);
  }
}

// Get platform configuration by page ID
async function getPlatformConfig(pageId: string, platform: string): Promise<{
  platform: unknown;
  organization: unknown;
  accessToken: string;
} | null> {
  // Ensure pageId is a string since it's stored as TEXT in database
  const pageIdStr = String(pageId);
  console.log(`Looking up ${platform} platform configuration for page ID: ${pageIdStr} (type: ${typeof pageId})`);
  
  // For Messenger/Facebook, check both social_platforms and facebook_pages tables
  if (platform === 'messenger' || platform === 'facebook') {
    // First, try to find in facebook_pages table (for pages connected via facebook-connect or manually added)
    const { data: fbPageData, error: fbPageError } = await supabase
      .from('facebook_pages')
      .select(`*`)
      .eq('page_id', pageIdStr)
      .eq('is_enabled', true)
      .maybeSingle();

    console.log(`[Facebook Pages] Query result - error: ${fbPageError?.message || 'none'}, data: ${fbPageData ? 'found' : 'not found'}`);

    if (!fbPageError && fbPageData) {
      console.log(`Found matching facebook page config: ${fbPageData.id}`);
      
      // Get access token (may need decryption)
      let accessToken = fbPageData.access_token;
      
      // Decrypt access token if encrypted
      if (accessToken && vaultEnabled) {
        try {
          // deno-lint-ignore no-explicit-any
          const decrypted = await vaultDecrypt(supabase as any, accessToken as string);
          accessToken = decrypted;
          console.log('[Vault] Successfully decrypted facebook_pages access token');
        } catch (err) {
          console.warn('[Vault] Decryption failed, attempting to use token as-is:', err);
          // Token might be plaintext or encrypted with different method - try as-is
          // Don't fail here, let the API call fail if token is actually invalid
        }
      }
      
      // Fetch organization separately
      let org = null;
      if (fbPageData.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, ai_agent_type, allowed_languages, language_lock_enabled, sales_process_config, conversion_criteria, agent_takeover_message, ai_handback_message, default_country_code')
          .eq('id', fbPageData.organization_id)
          .maybeSingle();
        org = orgData;
      }
      
      return {
        platform: fbPageData,
        organization: org,
        accessToken: (accessToken ?? '') as string,
      };
    }
  }
  
  // Map webhook platform to stored platform name (webhooks use 'messenger' but stored as 'facebook')
  const platformsToCheck = platform === 'messenger' ? ['messenger', 'facebook'] : [platform];
  
  // Fall back to social_platforms (for Instagram and WhatsApp)
  const { data, error } = await supabase
    .from('social_platforms')
    .select(`
      *,
      organizations (
        id, name, ai_agent_type, allowed_languages, language_lock_enabled,
        sales_process_config, conversion_criteria,
        agent_takeover_message, ai_handback_message, default_country_code
      )
    `)
    .in('platform', platformsToCheck)
    .eq('is_enabled', true)
    .limit(10);

  if (error) {
    console.error('Error fetching platform config:', error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log(`No enabled ${platformsToCheck.join(' or ')} configurations found`);
    return null;
  }

  // Find the matching configuration by checking credentials.page_id or credentials.business_account_id
  for (const config of data) {
    const credentials = (config.credentials ?? {}) as Record<string, unknown>;
    
    // Check various credential fields that might contain the page ID
    if (
      credentials?.page_id === pageId ||
      credentials?.business_account_id === pageId ||
      credentials?.instagram_account_id === pageId ||
      credentials?.instagram_business_account_id === pageId ||
      credentials?.phone_number_id === pageId ||
      credentials?.waba_id === pageId
    ) {
      console.log(`Found matching platform config: ${config.id}`);
      
      // Get access token (may need decryption)
      let accessToken = credentials?.access_token;
      
      // Decrypt access token if encrypted
      if (accessToken && vaultEnabled) {
        try {
          // deno-lint-ignore no-explicit-any
          const decrypted = await vaultDecrypt(supabase as any, accessToken as string);
          accessToken = decrypted;
          console.log('[Vault] Successfully decrypted social_platforms access token');
        } catch (err) {
          console.warn('[Vault] Decryption failed, attempting to use token as-is:', err);
          // Token might be plaintext or encrypted with different method - try as-is
          // Don't fail here, let the API call fail if token is actually invalid
        }
      }
      
      return {
        platform: config,
        organization: config.organizations,
        accessToken: (accessToken ?? '') as string,
      };
    }
  }

  // Fallback: return the first config if only one exists (for backwards compatibility)
  if (data.length === 1) {
    console.log('Single configuration found, using it as fallback');
    const config = data[0];
    const credentials = (config.credentials ?? {}) as Record<string, unknown>;
    let accessToken = credentials?.access_token;
    
    // Decrypt access token if encrypted
    if (accessToken && vaultEnabled) {
      try {
        // deno-lint-ignore no-explicit-any
        const decrypted = await vaultDecrypt(supabase as any, accessToken as string);
        accessToken = decrypted;
        console.log('[Vault] Successfully decrypted fallback access token');
      } catch (err) {
        console.warn('[Vault] Fallback decryption failed, attempting to use token as-is:', err);
        // Token might be plaintext or encrypted with different method - try as-is
        // Don't fail here, let the API call fail if token is actually invalid
      }
    }
    
    return {
      platform: config,
      organization: config.organizations,
      accessToken: (accessToken ?? '') as string,
    };
  }

  console.log(`No matching configuration found for page ID: ${pageId}`);
  return null;
}

// Fetch user profile name and picture from Facebook Graph API
async function fetchUserProfileName(senderId: string, accessToken: string, platform: string): Promise<{ name: string | null; pictureUrl: string | null } | null> {
  if (platform !== 'messenger' && platform !== 'instagram') {
    return null;
  }
  
  try {
    console.log(`Fetching profile for ${platform} user: ${senderId}`);
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${senderId}?fields=name,first_name,last_name,picture&access_token=${encodeURIComponent(accessToken)}`
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to fetch user profile:', response.status, JSON.stringify(errorData));
      return null;
    }
    
    const data = await response.json();
    const name = data.name || (data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : null);
    const pictureUrl = data.picture?.data?.url || null;
    console.log(`Fetched profile - name: ${name}, has picture: ${!!pictureUrl}`);
    return { name, pictureUrl };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Extract and validate phone numbers from message text
// Returns the first valid phone number found, or null if none
// Handles various international and local formats
function extractPhoneNumber(messageText: string): string | null {
  if (!messageText) return null;
  
  // First, check if message looks like it contains phone context
  // This helps avoid false positives from random number sequences
  const phoneContextPatterns = [
    /\b(phone|number|contact|call|text|reach|mobile|cell|whatsapp|viber|telegram)\b/i,
    /\b(my\s*(#|num|no\.?))\b/i,
    /\b(here'?s?\s*my)\b/i,
    /\b(you\s*can\s*(reach|contact|call|text))\b/i,
  ];
  
  const hasPhoneContext = phoneContextPatterns.some(p => p.test(messageText));
  
  // Patterns to EXCLUDE (dates, prices, IDs, times) - prevents false positives
  const excludePatterns = [
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g,  // Dates: 01/15/2024, 2024-01-15
    /\$[\d,]+\.?\d*/g,                          // Prices: $1,234.56
    /\d{1,2}:\d{2}/g,                           // Times: 10:30
    /#\d+/g,                                     // IDs: #12345
    /order\s*#?\s*\d+/gi,                       // Order numbers
    /booking\s*#?\s*\d+/gi,                     // Booking numbers
    /ref(?:erence)?\s*#?\s*:?\s*\d+/gi,        // Reference numbers (including "reference")
    /confirmation\s*#?\s*:?\s*\d+/gi,          // Confirmation numbers
    /ext(?:ension)?\s*#?\s*:?\s*\d+/gi,        // Extension numbers
    /serial\s*#?\s*:?\s*\d+/gi,                 // Serial numbers
    /invoice\s*#?\s*:?\s*\d+/gi,                // Invoice numbers
    /receipt\s*#?\s*:?\s*\d+/gi,                // Receipt numbers
    /id\s*#?\s*:?\s*\d+/gi,                     // ID numbers
    /year\s*[:;]?\s*\d{4}/gi,                   // Years: "year: 2024"
    /\d{4}\s*(?:model|year|version)/gi,        // Model/version numbers: "2024 model"
    /v\d+\.\d+/gi,                              // Version numbers: v1.2, v2.0
    /\(\s*\d+\s*\)/g,                           // Numbers in parentheses: (123)
  ];
  
  // Remove excluded patterns from consideration
  let cleanedText = messageText;
  for (const pattern of excludePatterns) {
    cleanedText = cleanedText.replace(pattern, ' ');
  }
  
  // Phone number patterns (ordered by specificity)
  const phonePatterns = [
    // International with + prefix (most reliable)
    // +1 234 567 8901, +63 917 123 4567, +63-917-123-4567, +44 20 7946 0958
    /\+\d{1,4}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{0,4}/g,
    
    // Country code without + (63 917 123 4567, 1-800-123-4567)
    /\b(1|44|63|61|81|82|86|91)\s*[\-\.]?\s*\(?\d{2,4}\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{0,4}\b/g,
    
    // US/Canada format: (123) 456-7890, 123-456-7890, 123.456.7890
    /\(?\d{3}\)?\s*[\-\.]?\s*\d{3}\s*[\-\.]?\s*\d{4}\b/g,
    
    // Philippine mobile: 09XX XXX XXXX or 09XXXXXXXXX (starts with 09, 11 digits)
    /\b09\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{4}\b/g,
    
    // Philippine landline: (02) 8XXX-XXXX or 02-8XXX-XXXX
    /\(?\s*0?2\s*\)?[\s\-\.]?\d{4}[\s\-\.]?\d{4}\b/g,
    
    // Generic local mobile (starts with 0, 10-11 digits with optional separators)
    /\b0\d{2,3}[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}\b/g,
    
    // Continuous digits (10-12 digits) - only if phone context exists
    ...(hasPhoneContext ? [/\b\d{10,12}\b/g] : []),
  ];
  
  for (const pattern of phonePatterns) {
    const matches = cleanedText.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Clean up: keep only digits and leading +
        let phone = match.trim();
        const hasPlus = phone.startsWith('+');
        phone = phone.replace(/[^\d]/g, ''); // Remove all non-digits
        if (hasPlus) phone = '+' + phone;
        
        // Validate digit count (international: 10-15, local: 10-11)
        const digitCount = phone.replace(/\D/g, '').length;
        
        if (digitCount >= 10 && digitCount <= 15) {
          // Additional validation for Philippine numbers
          if (phone.startsWith('09') && digitCount !== 11) continue;
          if (phone.startsWith('+63') && digitCount !== 12) continue;
          if (phone.startsWith('63') && !phone.startsWith('+') && digitCount !== 12) {
            phone = '+' + phone; // Add missing +
          }
          
          console.log(`[Phone Extraction] Found valid phone: ${phone} (context: ${hasPhoneContext})`);
          return phone;
        }
      }
    }
  }
  
  return null;
}


// Format phone number with org's default country code if local number
function formatPhoneWithCountryCode(phone: string, defaultCountryCode: string | null): string {
  if (!phone) return phone;
  
  // Already has + prefix - return as-is (already international format)
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Already starts with country code digits (e.g., "63..." for Philippines)
  // Add + prefix if it looks like a country code
  if (/^(1|44|63|61|81|82|86|91)\d{9,}$/.test(phone)) {
    console.log(`[Phone Format] Adding + prefix to ${phone}`);
    return '+' + phone;
  }
  
  // Local number (starts with 0) - apply org's default country code
  if (phone.startsWith('0') && defaultCountryCode) {
    // Remove leading 0 and prepend country code
    const localNumber = phone.substring(1);
    const formatted = defaultCountryCode + localNumber;
    console.log(`[Phone Format] Converted local ${phone} -> ${formatted} using org code ${defaultCountryCode}`);
    return formatted;
  }
  
  // If no default country code or doesn't start with 0, return as-is
  return phone;
}

// Update lead with extracted phone number if not already set
async function updateLeadPhoneIfEmpty(leadId: string, phone: string, defaultCountryCode: string | null = null): Promise<boolean> {
  try {
    // Format phone with country code if needed
    const formattedPhone = formatPhoneWithCountryCode(phone, defaultCountryCode);
    
    // Only update if phone is currently null/empty
    const { data, error } = await supabase
      .from('leads')
      .update({ phone: formattedPhone, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .is('phone', null)  // Only update if phone is null
      .select('id')
      .single();
    
    if (error) {
      // Not an error if no rows matched (phone already set)
      if (error.code === 'PGRST116') {
        console.log(`[Phone Extraction] Lead ${leadId} already has a phone number, skipping`);
        return false;
      }
      console.error('[Phone Extraction] Error updating lead phone:', error);
      return false;
    }
    
    if (data) {
      console.log(`[Phone Extraction] Successfully updated lead ${leadId} with phone: ${formattedPhone}`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('[Phone Extraction] Exception updating lead phone:', err);
    return false;
  }
}

// Get or create lead for the sender - with proper race condition handling
// Now uses platform_user_id for lookups instead of phone field
async function getOrCreateLead(senderId: string, platform: string, organizationId: string, accessToken?: string) {
  const sourceDisplayName = platform === 'messenger' ? 'Facebook' :
                            platform === 'whatsapp' ? 'WhatsApp' :
                            platform === 'instagram' ? 'Instagram' : platform;

  // First, try to find an existing lead by org + platform_user_id
  const { data: existingLeads, error: findError } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('platform_user_id', senderId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) {
    console.error('Error finding lead:', findError);
  }

  if (existingLeads && existingLeads.length > 0) {
    console.log(`Found existing lead: ${existingLeads[0].id}`);
    return existingLeads[0];
  }

  // If no lead is found, create a new one
  let leadName = `${sourceDisplayName} User`;
  let profilePictureUrl: string | null = null;
  
  if (accessToken) {
    const profileData = await fetchUserProfileName(senderId, accessToken, platform);
    if (profileData) {
      if (profileData.name) {
        leadName = profileData.name;
      }
      profilePictureUrl = profileData.pictureUrl;
    }
  }

  console.log(`Creating new lead for ${sourceDisplayName}: ${leadName} (has photo: ${!!profilePictureUrl})`);
  const { data: newLead, error: createError } = await supabase
    .from('leads')
    .insert({
      name: leadName,
      organization_id: organizationId,
      source: sourceDisplayName,
      platform_user_id: senderId,  // Store platform ID here, NOT in phone
      avatar_url: profilePictureUrl,  // Store profile photo from social media
      status: 'new',
      is_ai_managed: true,
    })
    .select()
    .single();

  if (createError) {
    // Handle race condition - if another webhook created the lead, fetch it
    if (createError.code === '23505') { // unique_violation
      console.log('Lead creation race condition, fetching existing lead');
      const { data: retryLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform_user_id', senderId)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (retryLeads && retryLeads.length > 0) {
        console.log(`Found lead after race condition: ${retryLeads[0].id}`);
        return retryLeads[0];
      }
    }
    console.error('Error creating lead:', createError);
    return null;
  }

  console.log(`Created new lead: ${newLead.id} with name: ${leadName}`);
  return newLead;
}

// Get or create AI conversation (still needed for external_id tracking)
// IMPORTANT: Now lookups are NOT filtered by status to prevent duplicate creation
async function getOrCreateConversation(leadId: string, organizationId: string, platform: string, senderId: string) {
  console.log(`Looking for conversation for lead ${leadId} on ${platform}`);
  
  // Always check for ANY existing conversation first (regardless of status)
  // This prevents creating duplicates when conversations exist but have different statuses
  const { data: existingConvos, error: findError } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('lead_id', leadId)
    .eq('platform', platform)
    .order('created_at', { ascending: true }) // Get oldest first for consistency
    .limit(1);
  
  if (findError) {
    console.error('Error finding conversation:', findError);
  }
  
  if (existingConvos && existingConvos.length > 0) {
    const existingConvo = existingConvos[0];
    console.log(`Found existing conversation: ${existingConvo.id} (status: ${existingConvo.status})`);
    
    // If the conversation is not active, reactivate it
    if (existingConvo.status !== 'active') {
      console.log(`Reactivating conversation ${existingConvo.id}`);
      const { data: updatedConvo } = await supabase
        .from('ai_conversations')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existingConvo.id)
        .select()
        .single();
      return updatedConvo || existingConvo;
    }
    
    return existingConvo;
  }
  
  // Create new conversation only if none exists
  console.log(`Creating new conversation for lead ${leadId}`);
  const { data: newConvo, error } = await supabase
    .from('ai_conversations')
    .insert({
      lead_id: leadId,
      organization_id: organizationId,
      platform: platform,
      external_id: senderId,
      status: 'active'
    })
    .select()
    .single();
  
  if (error) {
    // If insert failed due to any error, try to fetch existing again (race condition or duplicate)
    console.log('Conversation creation failed, checking for existing:', error.code, error.message);
    const { data: retryConvo } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lead_id', leadId)
      .eq('platform', platform)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (retryConvo && retryConvo.length > 0) {
      console.log(`Found conversation after retry: ${retryConvo[0].id}`);
      return retryConvo[0];
    }
    
    console.error('Error creating conversation and no existing found:', error);
    return null;
  }
  
  console.log(`Created new conversation: ${newConvo.id}`);
  return newConvo;
}

// Get conversation history from communications table
async function getConversationHistory(leadId: string, organizationId: string, platform: string) {
  // IMPORTANT: Fetch the MOST RECENT messages (not the oldest), then reverse to keep chronological order.
  // This ensures Cece’s guardrails (and the AI) see the latest availability offer / date range, avoiding “looping” and stale context.
  const { data: messages, error } = await supabase
    .from('communications')
    .select('direction, content, created_at, metadata')
    .eq('lead_id', leadId)
    .eq('organization_id', organizationId)
    .eq('channel', platform)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ConversationHistory] Database error fetching for lead:', leadId, error);
    
    // Log critical error for monitoring
    try {
      const { error: logError } = await supabase.from('audit_logs').insert({
        action: 'conversation_history_fetch_error',
        resource_type: 'communication',
        resource_id: leadId,
        details: {
          organization_id: organizationId,
          platform,
          error_code: error.code,
          error_message: error.message
        }
      });
      if (logError) {
        console.warn('[ConversationHistory] Failed to log error to audit:', logError);
      }
    } catch (logErr) {
      console.warn('[ConversationHistory] Failed to log error:', logErr);
    }
    
    return [];
  }

  const ordered = (messages || []).slice().reverse();

  // Map to AI message format - include images as multimodal content when present
  const history = ordered.map(m => {
    const metadata = m.metadata as Record<string, unknown> | null;
    const imageUrls = metadata?.image_urls as string[] | undefined;
    
    // If there are images, create multimodal content
    if (imageUrls && imageUrls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }
      for (const url of imageUrls) {
        content.push({ type: 'image_url', image_url: { url } });
      }
      return {
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: content,
      };
    }
    
    // No images, just text
    return {
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    };
  });

  console.log(`Retrieved ${history.length} messages from history (with image support)`);
  return history;
}

// Get knowledge base for organization - NOW INCLUDES IMAGE URLs
async function getKnowledgeBase(organizationId: string): Promise<string> {
  // Fetch knowledge base entries WITH image_url
  const { data: entries, error } = await supabase
    .from('knowledge_base_entries')
    .select('title, content, category, image_url')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('[KnowledgeBase] Error fetching entries for org:', organizationId, error);
    // Continue anyway - KB is not critical, system can work without it
  }
  
  // Also fetch room units with their images
  const { data: roomUnits, error: roomError } = await supabase
    .from('room_units')
    .select('name, description, image_url, price_per_night, capacity')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  
  if (roomError) {
    console.error('[KnowledgeBase] Error fetching room units for org:', organizationId, roomError);
    // Continue anyway - room list is not critical
  }
  
  const parts: string[] = [];
  
  // Format knowledge base entries with image URLs
  if (entries && entries.length > 0) {
    console.log(`Retrieved ${entries.length} knowledge base entries`);
    for (const e of entries) {
      let entryText = `## ${e.title}${e.category ? ` (${e.category})` : ''}\n${e.content}`;
      // Show all images if image_urls array exists, otherwise fallback to image_url
      const entryRecord = e as Record<string, unknown>;
      const images = entryRecord.image_urls && Array.isArray(entryRecord.image_urls) && entryRecord.image_urls.length > 0
        ? entryRecord.image_urls as string[]
        : (e.image_url ? [e.image_url] : []);
      if (images.length > 0) {
        entryText += '\n📷 Images: ' + images.map((url: string, idx: number) => 
          `[IMAGE${images.length > 1 ? ` ${idx + 1}` : ''}: ${url}]`
        ).join(' ');
      }
      parts.push(entryText);
    }
  }
  
  // Format room units with image URLs
  if (roomUnits && roomUnits.length > 0) {
    console.log(`Retrieved ${roomUnits.length} room units with images`);
    parts.push('\n## ROOM/UNIT PHOTOS');
    for (const room of roomUnits) {
      let roomText = `### ${room.name}`;
      if (room.description) roomText += `\n${room.description}`;
      if (room.price_per_night) roomText += `\nPrice: ₱${room.price_per_night}/night`;
      if (room.capacity) roomText += `\nCapacity: ${room.capacity} guests`;
      // Show all images if image_urls array exists, otherwise fallback to image_url
      const roomRecord = room as Record<string, unknown>;
      const images = roomRecord.image_urls && Array.isArray(roomRecord.image_urls) && roomRecord.image_urls.length > 0
        ? roomRecord.image_urls as string[]
        : (room.image_url ? [room.image_url] : []);
      if (images.length > 0) {
        roomText += '\n📷 Photos: ' + images.map((url: string, idx: number) => 
          `[IMAGE${images.length > 1 ? ` ${idx + 1}` : ''}: ${url}]`
        ).join(' ');
      }
      parts.push(roomText);
    }
  }
  
  if (parts.length === 0) {
    console.log('No knowledge base entries or room units found');
    return '';
  }
  
  return parts.join('\n\n');
}

// ============= AVAILABILITY GUARDRAIL SYSTEM =============
// Prevents AI hallucinations about room availability by querying live data

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// Enhanced parse result that tracks what was found
interface DateParseResult {
  type: 'complete' | 'single_date' | 'relative' | 'none';
  dateRange?: DateRange;
  singleDate?: string; // YYYY-MM-DD for single date
  relativeText?: string; // The relative term detected (e.g., "tomorrow", "weekend")
  resolvedDate?: string; // The actual date the relative term resolves to
}

const monthMap: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

// Detect relative date terms and resolve them to actual dates (for confirmation)
function detectRelativeDate(text: string): { term: string; resolvedDate: string } | null {
  const lower = text.toLowerCase();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
  // "today" or "later today" or "mamaya"
  if (/\b(today|later\s*(?:po|today)?|mamaya|ngayon|tonight)\b/i.test(lower)) {
    const todayStr = today.toISOString().split('T')[0];
    return { term: 'today', resolvedDate: todayStr };
  }
  
  // "tomorrow" or "bukas"
  if (/\b(tomorrow|bukas|tom(?:orrow)?)\b/i.test(lower)) {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return { term: 'tomorrow', resolvedDate: tomorrow.toISOString().split('T')[0] };
  }
  
  // "this weekend" or "weekend"
  if (/\b(this\s*weekend|weekend|sabado|linggo)\b/i.test(lower)) {
    const dayOfWeek = today.getUTCDay();
    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(today);
    saturday.setUTCDate(saturday.getUTCDate() + daysUntilSat);
    return { term: 'this weekend', resolvedDate: saturday.toISOString().split('T')[0] };
  }
  
  // "next week"
  if (/\bnext\s*week\b/i.test(lower)) {
    const daysUntilMonday = (8 - today.getUTCDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    return { term: 'next week', resolvedDate: nextMonday.toISOString().split('T')[0] };
  }
  
  return null;
}

// Build a clarification question for incomplete date info
function buildDateClarificationQuestion(parseResult: DateParseResult): string {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  };
  
  if (parseResult.type === 'relative' && parseResult.relativeText && parseResult.resolvedDate) {
    const formattedDate = formatDate(parseResult.resolvedDate);
    return `Just to confirm, you'd like to check in ${parseResult.relativeText} (${formattedDate})? When would you be checking out?`;
  }
  
  if (parseResult.type === 'single_date' && parseResult.singleDate) {
    const formattedDate = formatDate(parseResult.singleDate);
    return `I'll check availability for ${formattedDate}. When would you be checking out?`;
  }
  
  return `I'd love to help you check availability! Could you let me know your check-in and check-out dates?`;
}

function utcDateFromYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function inferYearForMonthDay(month: number, day: number): number {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();
  
  // If the date is in the past this year, assume next year
  if (month < currentMonth || (month === currentMonth && day < currentDay)) {
    return currentYear + 1;
  }
  return currentYear;
}

// Normalize common typos in month names
function normalizeMonthTypos(text: string): string {
  return text
    .replace(/\bja\s+(\d)/gi, 'jan $1')
    .replace(/\bfe\s+(\d)/gi, 'feb $1')
    .replace(/\bma\s+(\d)/gi, 'mar $1')
    .replace(/\bap\s+(\d)/gi, 'apr $1')
    .replace(/\bju\s+(\d)/gi, 'jun $1')
    .replace(/\bjl\s+(\d)/gi, 'jul $1')
    .replace(/\bau\s+(\d)/gi, 'aug $1')
    .replace(/\bse\s+(\d)/gi, 'sep $1')
    .replace(/\boc\s+(\d)/gi, 'oct $1')
    .replace(/\bno\s+(\d)/gi, 'nov $1')
    .replace(/\bde\s+(\d)/gi, 'dec $1')
    // Also handle "jan17" without space
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d)/gi, '$1 $2');
}

// Parse a single date mention and return { month, day }
function parseSingleDate(text: string): { month: number; day: number } | null {
  const lower = normalizeMonthTypos(text.toLowerCase());
  
  // Pattern: "Jan 9", "January 9", "jan 9th"
  const monthFirstPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
  // Pattern: "9 Jan", "9th of January"
  const dayFirstPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
  
  let match = lower.match(monthFirstPattern);
  if (match) {
    const month = monthMap[match[1].toLowerCase().substring(0, 3)];
    const day = parseInt(match[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { month, day };
    }
  }
  
  match = lower.match(dayFirstPattern);
  if (match) {
    const month = monthMap[match[2].toLowerCase().substring(0, 3)];
    const day = parseInt(match[1]);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { month, day };
    }
  }
  
  return null;
}

// ============= DATE RANGE VALIDATION =============
// Ensures parsed date ranges are logically valid and reasonable

/**
 * Validate that a date range is logically correct.
 * Returns true if valid, false if dates are inverted or span unreasonable timeframes.
 */
function isValidDateRange(startDate: string, endDate: string): boolean {
  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    // Check that start <= end
    if (start > end) {
      console.warn(`[DateValidator] Invalid range: start (${startDate}) > end (${endDate})`);
      return false;
    }
    
    // Check that range doesn't exceed 366 days (1 year + leap day)
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    if (daysDiff > 366) {
      console.warn(`[DateValidator] Range too long: ${Math.round(daysDiff)} days (max 366)`);
      return false;
    }
    
    // Check that end is not more than 2 years in the future (booking constraint)
    const today = new Date();
    const twoYearsFromNow = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()).getTime();
    if (end > twoYearsFromNow) {
      console.warn(`[DateValidator] End date too far in future: ${endDate}`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[DateValidator] Error validating date range:', err);
    return false;
  }
}

/**
 * Validate and fix date range if needed.
 * Returns the validated range, or null if invalid and unfixable.
 */
function validateAndFixDateRange(dateRange: DateRange | null): DateRange | null {
  if (!dateRange) return null;
  
  // Validate basic structure
  if (!dateRange.start || !dateRange.end) {
    console.warn('[DateValidator] Invalid range structure:', dateRange);
    return null;
  }
  
  // Check if dates are swapped
  if (dateRange.start > dateRange.end) {
    const daysDiff = (new Date(dateRange.start).getTime() - new Date(dateRange.end).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 366) {
      // Too far apart to be a simple swap - reject
      console.warn('[DateValidator] Dates too far apart to swap:', daysDiff, 'days');
      return null;
    }
    
    // Safe to swap
    console.log('[DateValidator] Swapping inverted dates');
    return { start: dateRange.end, end: dateRange.start };
  }
  
  // Validate final range
  if (!isValidDateRange(dateRange.start, dateRange.end)) {
    return null;
  }
  
  return dateRange;
}

// Extract all dates mentioned in text
function extractAllDates(text: string): { month: number; day: number }[] {
  const lower = normalizeMonthTypos(text.toLowerCase());
  const dates: { month: number; day: number }[] = [];
  
  // Pattern for "Month Day" format
  const monthFirstRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
  let match;
  while ((match = monthFirstRegex.exec(lower)) !== null) {
    const month = monthMap[match[1].toLowerCase().substring(0, 3)];
    const day = parseInt(match[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      dates.push({ month, day });
    }
  }
  
  // Pattern for just day numbers in context (e.g., "check out is 19" when month is known)
  // This will be handled by tryParseDateRangeFromConversation
  
  return dates;
}

function tryParseDateRange(text: string): DateRange | null {
  // Normalize typos first
  const normalized = normalizeMonthTypos(text);
  const lower = normalized.toLowerCase();
  
  // First, try to find two dates in the text (check-in and check-out)
  const allDates = extractAllDates(normalized);
  
  if (allDates.length >= 2) {
    // Use first two dates as check-in and check-out
    const [d1, d2] = allDates;
    const year1 = inferYearForMonthDay(d1.month, d1.day);
    const year2 = inferYearForMonthDay(d2.month, d2.day);
    const start = utcDateFromYMD(year1, d1.month, d1.day);
    const end = utcDateFromYMD(year2, d2.month, d2.day);
    console.log(`[DateParser] Found two dates: ${start} to ${end}`);
    // Validate the parsed range
    return validateAndFixDateRange({ start, end });
  }
  
  // Pattern: "17 to 19" or "17-19" when month context exists nearby
  const dayRangePattern = /\b(\d{1,2})\s*(?:to|-|\/)\s*(\d{1,2})\b/i;
  const _dayRangeMatch = lower.match(dayRangePattern);
  
  // Pattern: "jan 17 / check out is 19" or "check in jan 17, checkout 19"
  // Look for month + day followed by just a day number
  const monthDayPlusDayPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[^0-9]+)(?:check\s*out|checkout|out|to|until|-|\/)[^0-9]*(\d{1,2})(?:st|nd|rd|th)?\b/i;
  const rangeMatch = lower.match(monthDayPlusDayPattern);
  if (rangeMatch) {
    const monthStr = rangeMatch[1];
    const startDay = parseInt(rangeMatch[2]);
    const endDay = parseInt(rangeMatch[3]);
    const month = monthMap[monthStr.toLowerCase().substring(0, 3)];
    
    if (month !== undefined && startDay >= 1 && startDay <= 31 && endDay >= 1 && endDay <= 31) {
      const startYear = inferYearForMonthDay(month, startDay);
      // If end day is less than start day, it might be next month
      let endMonth = month;
      let endYear = startYear;
      if (endDay < startDay) {
        endMonth = (month + 1) % 12;
        if (endMonth < month) endYear++;
      }
      const start = utcDateFromYMD(startYear, month, startDay);
      const end = utcDateFromYMD(endYear, endMonth, endDay);
      console.log(`[DateParser] Parsed range pattern: ${start} to ${end}`);
      // Validate the parsed range
      return validateAndFixDateRange({ start, end });
    }
  }
  
  // Single date patterns
  if (allDates.length === 1) {
    const d = allDates[0];
    const year = inferYearForMonthDay(d.month, d.day);
    const dateStr = utcDateFromYMD(year, d.month, d.day);
    return { start: dateStr, end: dateStr };
  }
  
  // Pattern: "YYYY-MM-DD"
  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const dateStr = utcDateFromYMD(parseInt(y), parseInt(m) - 1, parseInt(d));
    return { start: dateStr, end: dateStr };
  }
  
  return null;
}

// Enhanced date parsing that returns detailed info about what was parsed
function parseWithDetails(currentMessage: string, conversationHistory: Array<{ role: string; content: string }>): DateParseResult {
  const normalizedMessage = normalizeMonthTypos(currentMessage);
  
  // ✅ FIRST: Check for relative date terms like "tomorrow", "later today", "weekend"
  const relativeDate = detectRelativeDate(currentMessage);
  if (relativeDate) {
    console.log(`[DateParser] Detected relative date "${relativeDate.term}" → ${relativeDate.resolvedDate}`);
    return {
      type: 'relative',
      relativeText: relativeDate.term,
      resolvedDate: relativeDate.resolvedDate
    };
  }

  // ✅ Check for explicit date range in current message
  const directRange = tryParseDateRange(normalizedMessage);
  if (directRange) {
    // If start === end, this is actually a single date, not a complete range
    if (directRange.start === directRange.end) {
      console.log(`[DateParser] Found single date in current message (via tryParseDateRange): ${directRange.start}`);
      return { type: 'single_date', singleDate: directRange.start };
    }
    console.log(`[DateParser] Found complete range in current message: ${directRange.start} to ${directRange.end}`);
    return { type: 'complete', dateRange: directRange };
  }
  
  // ✅ Check for single date in current message (fallback)
  const singleDateMatch = parseSingleDate(normalizedMessage);
  if (singleDateMatch) {
    const year = inferYearForMonthDay(singleDateMatch.month, singleDateMatch.day);
    const singleDateStr = utcDateFromYMD(year, singleDateMatch.month, singleDateMatch.day);
    console.log(`[DateParser] Found single date in current message: ${singleDateStr}`);
    return { type: 'single_date', singleDate: singleDateStr };
  }

  // Only use USER messages for context date extraction
  const recentUserMessages = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-8);

  // Ensure content is always a string (handle null/undefined and multimodal array content)
  const getTextContent = (content: string | Array<{ type: string; text?: string }> | null | undefined): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text)
        .join(' ');
    }
    return '';
  };

  const allText = [...recentUserMessages.map(m => normalizeMonthTypos(getTextContent(m.content))), normalizedMessage].join(' ');

  // Try to parse from combined context
  const contextRange = tryParseDateRange(allText);
  if (contextRange) {
    console.log(`[DateParser] Found date range from conversation context: ${contextRange.start} to ${contextRange.end}`);
    return { type: 'complete', dateRange: contextRange };
  }

  // Look for check-in/check-out mentions across messages
  const checkInPatterns = /check\s*-?\s*in[:\s]+(\w+\s+\d+|\d+\s+\w+)/i;
  const checkOutPatterns = /check\s*-?\s*out[:\s]+(\w+\s+\d+|\d+\s+\w+|\d{1,2})/i;

  let checkInDate: { month: number; day: number } | null = null;
  let checkOutDate: { month: number; day: number } | null = null;
  let lastKnownMonth: number | null = null;

  const dayToDay = allText.match(/\b(\d{1,2})\s*(?:to|-|\/)\s*(\d{1,2})\b/i);

  for (const msg of [...recentUserMessages, { role: 'user', content: normalizedMessage }]) {
    const content = normalizeMonthTypos(getTextContent(msg.content));

    const monthMention = content.toLowerCase().match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (monthMention) {
      lastKnownMonth = monthMap[monthMention[1].toLowerCase().substring(0, 3)];
    }

    const checkInMatch = content.match(checkInPatterns);
    if (checkInMatch) {
      const parsed = parseSingleDate(checkInMatch[1]);
      if (parsed) checkInDate = parsed;
    }

    const checkOutMatch = content.match(checkOutPatterns);
    if (checkOutMatch) {
      const parsed = parseSingleDate(checkOutMatch[1]);
      if (parsed) {
        checkOutDate = parsed;
      } else {
        const dayOnly = checkOutMatch[1].match(/^(\d{1,2})$/);
        if (dayOnly && lastKnownMonth !== null) {
          checkOutDate = { month: lastKnownMonth, day: parseInt(dayOnly[1]) };
        }
      }
    }

    const standaloneDate = parseSingleDate(content);
    if (standaloneDate && !checkInDate) {
      checkInDate = standaloneDate;
    } else if (standaloneDate && checkInDate && !checkOutDate) {
      checkOutDate = standaloneDate;
    }
  }

  // Handle "17 to 19" pattern with month from context
  if (dayToDay && lastKnownMonth !== null && !checkInDate) {
    const startDay = parseInt(dayToDay[1]);
    const endDay = parseInt(dayToDay[2]);
    if (startDay >= 1 && startDay <= 31 && endDay >= 1 && endDay <= 31) {
      const startYear = inferYearForMonthDay(lastKnownMonth, startDay);
      let endMonth = lastKnownMonth;
      let endYear = startYear;
      if (endDay < startDay) {
        endMonth = (lastKnownMonth + 1) % 12;
        if (endMonth < lastKnownMonth) endYear++;
      }
      const start = utcDateFromYMD(startYear, lastKnownMonth, startDay);
      const end = utcDateFromYMD(endYear, endMonth, endDay);
      console.log(`[DateParser] Parsed day-to-day range with month context: ${start} to ${end}`);
      return { type: 'complete', dateRange: { start, end } };
    }
  }

  // If we found both dates
  if (checkInDate && checkOutDate) {
    const startYear = inferYearForMonthDay(checkInDate.month, checkInDate.day);
    let endYear = inferYearForMonthDay(checkOutDate.month, checkOutDate.day);

    if (checkOutDate.month < checkInDate.month ||
        (checkOutDate.month === checkInDate.month && checkOutDate.day < checkInDate.day)) {
      endYear = startYear + 1;
    }

    const start = utcDateFromYMD(startYear, checkInDate.month, checkInDate.day);
    const end = utcDateFromYMD(endYear, checkOutDate.month, checkOutDate.day);
    console.log(`[DateParser] Assembled range from check-in/out: ${start} to ${end}`);
    return { type: 'complete', dateRange: { start, end } };
  }
  
  // If we only found check-in date
  if (checkInDate && !checkOutDate) {
    const year = inferYearForMonthDay(checkInDate.month, checkInDate.day);
    const singleDateStr = utcDateFromYMD(year, checkInDate.month, checkInDate.day);
    console.log(`[DateParser] Found only check-in date from context: ${singleDateStr}`);
    return { type: 'single_date', singleDate: singleDateStr };
  }

  return { type: 'none' };
}

// Parse date range from conversation context (for follow-up messages) - legacy wrapper
function tryParseDateRangeFromConversation(currentMessage: string, conversationHistory: Array<{ role: string; content: string }>): DateRange | null {
  const result = parseWithDetails(currentMessage, conversationHistory);
  if (result.type === 'complete' && result.dateRange) {
    return result.dateRange;
  }
  return null;
}

// Parse a date range from a string like "January 17, 2026 to January 19"
function parseDateRangeFromString(dateStr: string): DateRange | null {
  if (!dateStr) return null;
  
  // Try to use tryParseDateRange which handles various formats
  const result = tryParseDateRange(dateStr);
  if (result) return result;
  
  // Manual parsing for "Month Day to Month Day" format
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                      'july', 'august', 'september', 'october', 'november', 'december'];
  
  const pattern = /(\w+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\s*(?:to|-)\s*(\w+)?\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?/i;
  const match = dateStr.match(pattern);
  
  if (match) {
    const startMonthName = match[1].toLowerCase();
    const startDay = parseInt(match[2]);
    const startYear = match[3] ? parseInt(match[3]) : new Date().getFullYear();
    const endMonthName = match[4] ? match[4].toLowerCase() : startMonthName;
    const endDay = parseInt(match[5]);
    const endYear = match[6] ? parseInt(match[6]) : startYear;
    
    const startMonth = monthNames.indexOf(startMonthName);
    const endMonth = monthNames.indexOf(endMonthName);
    
    if (startMonth >= 0 && endMonth >= 0) {
      const start = utcDateFromYMD(startYear, startMonth, startDay);
      const end = utcDateFromYMD(endYear, endMonth, endDay);
      console.log(`[DateParser] Parsed from string "${dateStr}": ${start} to ${end}`);
      return { start, end };
    }
  }
  
  return null;
}

function looksLikeAvailabilityInquiry(text: string): boolean {
  const lower = text.toLowerCase();
  const availabilityKeywords = [
    // English
    'available', 'availability', 'free', 'open', 'vacant', 'booking', 'book',
    'reserve', 'reservation', 'stay', 'check in', 'check-in', 'checkin',
    'room for', 'rooms for', 'night', 'nights', 'accomodation', 'accommodation',
    // Filipino/Tagalog/Cebuano - asking about availability
    'pwede', 'pwde', 'pede', 'pde', 'meron', 'may', 'bakante', 'libre',
    'kuha', 'gusto', 'naa', 'aduna', 'ana', 'ani', 'avail', 'inquire',
    // Room-related
    'avida', 'unit', 'condo', 'apartment', 'villa', 'resort', 'hotel',
    // Asking patterns
    'magkano', 'how much', 'price', 'rate', 'rates'
  ];
  
  const hasDateMention = tryParseDateRange(text) !== null;
  const hasKeyword = availabilityKeywords.some(kw => lower.includes(kw));
  
  // Also detect date + room/property name patterns (like "avida jan 12")
  const hasPropertyWithDate = hasDateMention && /\b(avida|haven|nest|nook|unit|room)\b/i.test(text);
  
  return (hasDateMention && hasKeyword) || hasPropertyWithDate;
}

// Check if message looks like a guest count reply
function looksLikeGuestCountReply(text: string): boolean {
  const lower = text.toLowerCase();
  const guestPatterns = [
    /\b\d+\s*pax\b/i,
    /\bfor\s*\d+\s*(people|person|guests?|pax)?\b/i,
    /\b\d+\s*(people|person|guests?)\b/i,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(people|person|guests?|pax)?\b/i,
    /\bjust\s*(me|us|myself)\b/i,
    /\b(solo|alone)\b/i,
    /\bcouple\b/i,
    /\bfamily\b/i,
  ];
  return guestPatterns.some(p => p.test(lower));
}

// Check if message looks like a booking confirmation response
// This is a FAST PATH check - for obvious confirmations
function looksLikeBookingConfirmation(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Only very obvious patterns for the fast path
  const obviousPatterns = [
    /^(yes|yep|yeah|yup|ok|okay|sure|oo|opo|sige|go)\b/i,
    /\b(book|reserve|reservation)\b/i,
    /\bproceed\b/i,
    /\bconfirm\b/i,
  ];
  return obviousPatterns.some(p => p.test(lower));
}

// Check if we're in an active booking flow context
function isInBookingFlowContext(conversationHistory: Array<{ role: string; content: string }>): {
  inFlow: boolean;
  roomName?: string;
  dateRange?: string;
  quoteSent?: boolean;
  guestCount?: number;
} {
  const recentMessages = conversationHistory.slice(-6);
  const recentAssistantMsgs = recentMessages.filter(m => m.role === 'assistant');
  
  for (const msg of recentAssistantMsgs) {
    const content = msg.content;
    const lower = content.toLowerCase();
    
    // Check if we sent a quote (this is a strong signal of booking flow)
    const quoteSent = lower.includes('here is your quote') || 
                      lower.includes('total price') ||
                      lower.includes('downpayment') ||
                      lower.includes('check-in date') ||
                      (lower.includes('php') && lower.includes('night'));
    
    // Check if we offered availability
    const offeredAvailability = lower.includes('available') || 
                                 lower.includes('would you like') ||
                                 lower.includes('following room');
    
    if (quoteSent || offeredAvailability) {
      // Extract room name - look for specific patterns that identify room names
      let roomName: string | undefined;
      
      // Pattern 1: "THE HAVEN - T1 12th AVIDA" style (all caps room name on its own line in quote)
      const quotedRoomMatch = content.match(/^(THE\s+[A-Z]+(?:\s*-\s*T\d+)?(?:\s+\d+\w+)?(?:\s+[A-Z]+)?)\s*$/im);
      if (quotedRoomMatch) {
        roomName = quotedRoomMatch[1].trim();
      }
      
      // Pattern 2: "reserve THE HAVEN - T1 12th Avida" or "book The Haven"
      if (!roomName) {
        const reserveMatch = content.match(/(?:reserve|book)\s+(THE\s+[A-Za-z]+(?:\s*-\s*T\d+)?(?:\s+\d+\w+)?(?:\s+[A-Za-z]+)?)/i);
        if (reserveMatch) {
          roomName = reserveMatch[1].trim();
        }
      }
      
      // Pattern 3: "following room is available: The Haven - T1 12th Avida"
      if (!roomName) {
        const availableMatch = content.match(/(?:following room[s]? (?:is|are) available)[:\s]+([^.!?\n]+)/i);
        if (availableMatch) {
          // Clean up - remove "Would you like..." suffix
          roomName = availableMatch[1].replace(/\.\s*Would you.*/i, '').trim();
        }
      }
      
      // Pattern 4: Look for known room prefixes
      if (!roomName) {
        const knownRoomMatch = content.match(/((?:The\s+)?(?:Haven|Nest|Nook|Suite|Studio|Penthouse)(?:\s*-\s*T\d+)?(?:\s+\d+\w+)?(?:\s+(?:Avida|Mesaverte|Aspira|Residences))?)/i);
        if (knownRoomMatch) {
          roomName = knownRoomMatch[1].trim();
        }
      }
      
      // Extract date range from quote or offer
      const datePatterns = [
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*,?\s*\d{4})?\s*(?:to|-)\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{1,2}/i,
        /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\s*(?:to|-)\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{1,2}/i,
      ];
      let dateRange: string | undefined;
      for (const p of datePatterns) {
        const m = content.match(p);
        if (m) {
          dateRange = m[0];
          break;
        }
      }
      
      // Extract guest count
      let guestCount: number | undefined;
      const paxMatch = content.match(/(\d+)\s*(?:pax|guest|people)/i);
      if (paxMatch) {
        guestCount = parseInt(paxMatch[1]);
      }
      
      console.log(`[Booking Flow Context] Room: ${roomName}, Dates: ${dateRange}, Guests: ${guestCount}, QuoteSent: ${quoteSent}`);
      return { inFlow: true, roomName, dateRange, quoteSent, guestCount };
    }
  }
  
  return { inFlow: false };
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: unknown) => p && typeof p === 'object' && (p as Record<string, unknown>).type === 'text' && typeof (p as Record<string, unknown>).text === 'string')
      .map((p: unknown) => (p as Record<string, string>).text)
      .join(' ')
      .trim();
  }
  return '';
}

function lastAssistantAskedForCheckout(
  conversationHistory: Array<{ role: string; content: string | Record<string, unknown> }>
): boolean {
  const recentAssistantMsgs = conversationHistory
    .slice(-10)
    .filter(m => m.role === 'assistant');

  for (let i = recentAssistantMsgs.length - 1; i >= 0; i--) {
    const text = extractTextContent(recentAssistantMsgs[i].content).toLowerCase();
    if (!text) continue;

    if (
      text.includes('checking out') ||
      text.includes('check out') ||
      text.includes('check-out') ||
      text.includes('checkout') ||
      /when\s+would\s+you\s+be\s+checking\s+out\??/i.test(text) ||
      /confirm\s+your\s+check-?out/i.test(text)
    ) {
      return true;
    }
  }

  return false;
}

// Check if user is showing booking intent (asking for payment = wants to book)
function looksLikeBookingIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const intentPatterns = [
    // Direct confirmations
    /^(yes|yep|yeah|yup|ok|okay|sure|oo|opo|sige|go)\b/i,
    /\b(book|reserve|reservation)\b/i,
    /\bproceed\b/i,
    /\bconfirm\b/i,
    // Payment intent = booking intent
    /\b(payment|bayad|gcash|bank|transfer|pay)\b/i,
    /\bpila\s*(ang|sa)?\s*(bayad|downpayment|payment)/i, // Bisaya "how much to pay"
    /\bunsa.*payment/i, // Bisaya "what payment"
    /\bready\s*(to|na)?\s*pay/i,
    /\bsend.*payment/i,
    // Providing personal info = booking intent
    /\bmy\s*name\s*is\b/i,
    /\bi('m| am)\s+[A-Z][a-z]+\b/, // "I'm John"
  ];
  return intentPatterns.some(p => p.test(lower));
}

// AI-driven booking intent detection - uses lightweight AI call to understand context
async function detectBookingIntentWithAI(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  openAIApiKey: string
): Promise<{
  wantsToBook: boolean;
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  clarificationQuestion?: string;
}> {
  const recentContext = conversationHistory.slice(-6).map(m => 
    `${m.role === 'assistant' ? 'AI' : 'Guest'}: ${m.content.substring(0, 500)}`
  ).join('\n');
  
  const prompt = `You are analyzing a hotel booking conversation to determine guest intent.

Recent conversation:
${recentContext}

Latest guest message: "${userMessage}"

Determine:
1. Does the guest want to proceed with booking/reservation? (yes/no/unclear)
2. Confidence level (high/medium/low)
3. If unclear, what ONE brief clarifying question should be asked?

Respond in JSON format only:
{"wantsToBook": true/false/null, "confidence": "high/medium/low", "clarificationQuestion": "question or null"}

Rules:
- If guest says anything affirmative after seeing availability/quote → wantsToBook: true
- If guest provides details (name, phone, dates) → wantsToBook: true  
- If guest asks about price/payment/how to pay → wantsToBook: true (showing intent)
- If completely unrelated topic → wantsToBook: false
- ONLY ask clarification if truly ambiguous - prefer assuming intent when in booking flow`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });
    
    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    return {
      wantsToBook: result.wantsToBook === true,
      confidence: result.confidence || 'low',
      needsClarification: result.wantsToBook === null && result.clarificationQuestion,
      clarificationQuestion: result.clarificationQuestion,
    };
  } catch (error) {
    console.error('[AI Intent] Error detecting booking intent:', error);
    // Fall back to pattern matching on error
    return {
      wantsToBook: looksLikeBookingConfirmation(userMessage),
      confidence: 'low',
      needsClarification: false,
    };
  }
}

// Check if recent AI message offered a room/reservation (legacy - kept for compatibility)
function lastAIMessageOfferedReservation(conversationHistory: Array<{ role: string; content: string }>): { offered: boolean; roomName?: string; dateRange?: string } {
  const flowContext = isInBookingFlowContext(conversationHistory);
  return {
    offered: flowContext.inFlow,
    roomName: flowContext.roomName,
    dateRange: flowContext.dateRange,
  };
}

// Enhanced version that checks conversation context for date-providing follow-ups
function looksLikeAvailabilityInquiryWithContext(
  text: string, 
  conversationHistory: Array<{ role: string; content: string }>
): boolean {
  // First check current message directly
  if (looksLikeAvailabilityInquiry(text)) {
    return true;
  }
  
  const lower = normalizeMonthTypos(text.toLowerCase());
  
  // Check if this looks like a date-providing follow-up (with typo normalization)
  const dateFollowUpPatterns = [
    /check\s*-?\s*out/i,
    /check\s*-?\s*in/i,
    /\bjan(?:uary)?\s+\d/i,
    /\bfeb(?:ruary)?\s+\d/i,
    /\bmar(?:ch)?\s+\d/i,
    /\bapr(?:il)?\s+\d/i,
    /\bmay\s+\d/i,
    /\bjune?\s+\d/i,
    /\bjuly?\s+\d/i,
    /\baug(?:ust)?\s+\d/i,
    /\bsep(?:t(?:ember)?)?\s+\d/i,
    /\boct(?:ober)?\s+\d/i,
    /\bnov(?:ember)?\s+\d/i,
    /\bdec(?:ember)?\s+\d/i,
    /\b\d{1,2}\s*(?:to|-|\/)\s*\d{1,2}\b/i, // "17 to 19" pattern
  ];
  
  const hasDatePattern = dateFollowUpPatterns.some(p => p.test(lower));
  const hasGuestCount = looksLikeGuestCountReply(text);
  
  // Look back in conversation to see if there was recent availability discussion
  const recentMessages = conversationHistory.slice(-8);
  const recentContext = recentMessages.map(m => normalizeMonthTypos(extractTextContent(m.content).toLowerCase())).join(' ');
  
  const availabilityContextKeywords = [
    'available', 'availability', 'when', 'date', 'dates', 'room', 'stay',
    'check-in', 'check in', 'check-out', 'check out', 'book', 'booking',
    'how many guests', 'how many pax', 'number of guests', 'guest count'
  ];
  
  const hasAvailabilityContext = availabilityContextKeywords.some(kw => recentContext.includes(kw));
  
  // Trigger guardrail if:
  // 1. Current message has date pattern AND recent context mentions availability
  // 2. Current message is a guest count reply AND we can find dates in recent conversation
  if (hasDatePattern && hasAvailabilityContext) {
    console.log('[Guardrail] Detected date-providing follow-up in availability context');
    return true;
  }
  
  if (hasGuestCount && hasAvailabilityContext) {
    // Check if we can find dates in recent conversation
    const dateRangeFromContext = tryParseDateRangeFromConversation(text, conversationHistory);
    if (dateRangeFromContext) {
      console.log('[Guardrail] Detected guest-count follow-up with dates in conversation context');
      return true;
    }
  }
  
  return false;
}

// Check if this is a booking confirmation flow
interface BookingConfirmationContext {
  isConfirmation: boolean;
  roomName?: string;
  dateRange?: DateRange;
  guestCount?: number;
}

function detectBookingConfirmationFlow(
  text: string,
  conversationHistory: Array<{ role: string; content: string }>
): BookingConfirmationContext {
  if (!looksLikeBookingConfirmation(text)) {
    return { isConfirmation: false };
  }
  
  const offerCheck = lastAIMessageOfferedReservation(conversationHistory);
  if (!offerCheck.offered) {
    return { isConfirmation: false };
  }
  
  console.log('[Guardrail] Detected booking confirmation after availability offer');
  
  // Try to extract context from conversation
  const dateRange = tryParseDateRangeFromConversation(text, conversationHistory);
  
  // Try to find guest count from recent messages
  let guestCount: number | undefined;
  const allText = conversationHistory.slice(-10).map(m => extractTextContent(m.content)).join(' ');
  const paxMatch = allText.match(/(\d+)\s*pax\b/i) || allText.match(/for\s*(\d+)/i);
  if (paxMatch) {
    guestCount = parseInt(paxMatch[1]);
  }
  
  return {
    isConfirmation: true,
    roomName: offerCheck.roomName,
    dateRange: dateRange || undefined,
    guestCount
  };
}

// ============= PHOTO SENDING GUARDRAIL (CECE) =============
// If the guest asks for photos/pictures, respond with real room/unit image URLs when available.
function looksLikePhotoRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('photo') ||
    lower.includes('photos') ||
    lower.includes('picture') ||
    lower.includes('pictures') ||
    lower.includes('pic') ||
    lower.includes('pics') ||
    lower.includes('images') ||
    lower.includes('image')
  );
}

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

function isMeaningfulRoomToken(token: string): boolean {
  if (token.length < 4) return false;
  if (/^\d+$/.test(token)) return false;
  const stop = new Set([
    'the', 'room', 'unit', 'tower', 'floor', 'residences', 'residence',
    'highrise', 'aspira', 'mesaverte', 'avida', 'cdo', 'city'
  ]);
  // NOTE: we intentionally do NOT stop-word "avida" in matching logic below; we handle it specially.
  return !stop.has(token);
}

type RoomUnitPhoto = { name: string; image_url: string; image_urls?: string[] };

function findMentionedRoomUnits(messageText: string, rooms: RoomUnitPhoto[]): RoomUnitPhoto[] {
  const msg = messageText.toLowerCase();

  // Special-case: "avida" should match any Avida room
  if (msg.includes('avida')) {
    const avidaRooms = rooms.filter(r => r.name.toLowerCase().includes('avida'));
    if (avidaRooms.length > 0) return avidaRooms;
  }

  const msgTokens = new Set(tokenizeForMatch(msg));

  return rooms.filter(room => {
    const roomTokens = tokenizeForMatch(room.name).filter(isMeaningfulRoomToken);
    return roomTokens.some(t => msg.includes(t) || msgTokens.has(t));
  });
}

async function getRoomUnitPhotoUrlsForMessage(organizationId: string, messageText: string): Promise<RoomUnitPhoto[]> {
  const { data: rooms, error } = await supabase
    .from('room_units')
    .select('name, image_url, image_urls')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .not('image_url', 'is', null);

  if (error) {
    console.error('[PhotoGuardrail] Error fetching room unit photos:', error);
    return [];
  }

  const roomPhotos = (rooms || [])
    .filter(r => typeof r.image_url === 'string' && r.image_url)
    .map(r => {
      // Collect all images: if image_urls array exists, use it; otherwise use single image_url
      const roomRecord = r as Record<string, unknown>;
      const allImages = roomRecord.image_urls && Array.isArray(roomRecord.image_urls) && roomRecord.image_urls.length > 0
        ? roomRecord.image_urls as string[]
        : (r.image_url ? [r.image_url] : []);
      return { 
        name: String(r.name), 
        image_url: String(r.image_url), // Keep for compatibility
        image_urls: allImages // Add array of all images
      };
    });

  return findMentionedRoomUnits(messageText, roomPhotos);
}

// ============= COMPREHENSIVE KB INTELLIGENCE SYSTEM =============
// The Knowledge Base is the SINGLE SOURCE OF TRUTH for all AI behavior
// This system ensures the AI follows KB instructions for ALL conversation types

interface KBInstruction {
  trigger: string;
  response: string;
  category: string;
  priority: number; // Higher = more important
}

interface KBContext {
  tone: string | null;
  personality: string | null;
  bookingFlow: string | null;
  paymentInfo: string | null;
  paymentAccounts: string | null; // GCash/Bank account details
  quoteFlow: string | null; // Quote creation instructions
  downpaymentPolicy: string | null;
  pricing: Map<string, string>;
  policies: string[];
  faqs: Map<string, string>;
  sampleConversations: string[];
  landingPages: Map<string, string>;
  greetings: string | null;
  fallbackResponses: string[];
}

// Parse the KB into structured context for intelligent responses
function parseKBContext(knowledgeBase: string): KBContext {
  const context: KBContext = {
    tone: null,
    personality: null,
    bookingFlow: null,
    paymentInfo: null,
    paymentAccounts: null,
    quoteFlow: null,
    downpaymentPolicy: null,
    pricing: new Map(),
    policies: [],
    faqs: new Map(),
    sampleConversations: [],
    landingPages: new Map(),
    greetings: null,
    fallbackResponses: []
  };
  
  if (!knowledgeBase) return context;
  
  // Extract tone/personality section
  const toneMatch = knowledgeBase.match(/(?:tone[-\s]?personality|personality|tone)[^\n]*\n([\s\S]*?)(?=\n##|\n\*\*|$)/i);
  if (toneMatch) {
    context.personality = toneMatch[1].trim();
  }
  
  // Extract booking flow / booking assistant instructions
  const bookingFlowMatch = knowledgeBase.match(/(?:booking\s*flow|booking\s*assistant|booking\s*process|creating\s*quotes)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (bookingFlowMatch) {
    context.bookingFlow = bookingFlowMatch[1].trim();
  }
  
  // Extract payment account details (GCash/BPI/Bank accounts with numbers)
  const accountPattern = /(?:BPI|GCASH|Bank\s*(?:Transfer|Account))[^\n]*\n(?:[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z]\.?\s+[A-Z][a-z]+)?)\n\d{9,}/gi;
  const accountMatches = knowledgeBase.match(accountPattern);
  if (accountMatches) {
    context.paymentAccounts = accountMatches.join('\n\n');
  }
  
  // Also try to extract full payment section
  const paymentSectionPattern = /(?:BPI[^\n]*\n[^\n]+\n\d+[\s\S]*?GCASH[^\n]*\n[^\n]+\n\d+)/gi;
  const paymentSection = knowledgeBase.match(paymentSectionPattern);
  if (paymentSection) {
    context.paymentAccounts = paymentSection[0];
  }
  
  // Extract quote creation flow
  const quoteMatch = knowledgeBase.match(/(?:quote\s*creation|creating\s*quotes|quote\s*format)[^\n]*\n([\s\S]*?)(?=\n##\s|2️⃣|$)/i);
  if (quoteMatch) {
    context.quoteFlow = quoteMatch[1].trim();
  }
  
  // Extract downpayment policy
  const dpMatch = knowledgeBase.match(/(?:downpayment|down\s*payment)[^\n]*\n([\s\S]*?)(?=\n\n|\n##|$)/i);
  if (dpMatch) {
    context.downpaymentPolicy = dpMatch[0].trim();
  }
  
  // Extract general payment info/terms
  const paymentMatch = knowledgeBase.match(/(?:payment\s*details|payment\s*info|payment\s*methods?|payment\s*instructions?)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (paymentMatch) {
    context.paymentInfo = paymentMatch[1].trim();
  }
  
  // Extract unit pricing (pattern: "Php X/ Y pax" or "₱X/night")
  const pricingPatterns = [
    /(?:The\s+)?(\w+(?:\s+\w+)?)\s*\|[^\n]*\n\s*(?:Php|₱)\s*([\d,]+)\s*\/\s*(\d+)\s*pax/gi,
    /(\w+(?:\s+\w+)?)[:\s]+(?:Php|₱)\s*([\d,]+)(?:\s*\/\s*(?:night|pax))?/gi
  ];
  for (const pattern of pricingPatterns) {
    let match;
    while ((match = pattern.exec(knowledgeBase)) !== null) {
      const unitName = match[1].trim();
      const priceInfo = match[0].trim();
      if (unitName.length > 2 && unitName.length < 50) {
        context.pricing.set(unitName.toLowerCase(), priceInfo);
      }
    }
  }
  
  // Extract landing pages (Unit Name followed by URL)
  const urlPattern = /([A-Za-z][^\n]+?(?:\([^)]+\))?)\s*\n\s*(https?:\/\/[^\s\n]+)/g;
  let urlMatch;
  while ((urlMatch = urlPattern.exec(knowledgeBase)) !== null) {
    const name = urlMatch[1].trim();
    if (name.length > 2 && name.length < 100 && !name.includes(':')) {
      context.landingPages.set(name.toLowerCase(), urlMatch[2]);
    }
  }
  
  // Extract welcome/greeting messages
  const welcomeMatch = knowledgeBase.match(/(?:welcome|greeting|first\s*message)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (welcomeMatch) {
    context.greetings = welcomeMatch[1].trim();
  }
  
  // Extract policies (check-in, check-out, cancellation, house rules)
  const policyPatterns = [
    /check[-\s]?in[:\s]+([^\n]+)/gi,
    /check[-\s]?out[:\s]+([^\n]+)/gi,
    /cancellation[:\s]+([^\n]+)/gi,
    /house\s*rules?[:\s]*\n([\s\S]*?)(?=\n\n|\n##|$)/gi
  ];
  for (const pattern of policyPatterns) {
    let match;
    while ((match = pattern.exec(knowledgeBase)) !== null) {
      context.policies.push(match[0].trim());
    }
  }
  
  // Extract sample conversations for learning response patterns
  const sampleMatch = knowledgeBase.match(/(?:sample[-\s]?conversations?|example[-\s]?responses?)[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (sampleMatch) {
    context.sampleConversations.push(sampleMatch[1].trim());
  }
  
  return context;
}

// Detect query type from user message
type QueryType = 'greeting' | 'pricing' | 'availability' | 'booking' | 'payment' | 'photos' | 'amenities' | 'policies' | 'location' | 'general';

function detectQueryType(message: string): QueryType {
  const msg = message.toLowerCase();
  
  // Greeting patterns
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|kumusta|musta)/i.test(msg) && msg.length < 30) {
    return 'greeting';
  }
  
  // Pricing/rates
  if (/(?:price|rate|cost|how\s*much|magkano|presyo|pila)/i.test(msg)) {
    return 'pricing';
  }
  
  // Availability
  if (/(?:available|availability|free|open|vacant|bakante)/i.test(msg)) {
    return 'availability';
  }
  
  // Booking/reservation
  if (/(?:book|reserve|reservation|stay|check[-\s]?in|check[-\s]?out)/i.test(msg)) {
    return 'booking';
  }
  
  // Payment
  if (/(?:pay|payment|gcash|bank|downpayment|deposit|bayad)/i.test(msg)) {
    return 'payment';
  }
  
  // Photos
  if (/(?:photo|picture|pic|image|litrato)/i.test(msg)) {
    return 'photos';
  }
  
  // Amenities
  if (/(?:amenity|amenities|pool|gym|parking|wifi|kitchen)/i.test(msg)) {
    return 'amenities';
  }
  
  // Policies
  if (/(?:policy|policies|rule|cancel|refund)/i.test(msg)) {
    return 'policies';
  }
  
  // Location
  if (/(?:location|where|address|direction|near|malapit)/i.test(msg)) {
    return 'location';
  }
  
  return 'general';
}

// Find the most relevant KB section for a query type
function findRelevantKBSection(queryType: QueryType, _knowledgeBase: string, kbContext: KBContext): string | null {
  switch (queryType) {
    case 'payment':
      return kbContext.paymentInfo;
    case 'booking':
      return kbContext.bookingFlow;
    case 'photos':
      if (kbContext.landingPages.size > 0) {
        const pages = Array.from(kbContext.landingPages.entries());
        return `For photos, share these landing pages:\n${pages.map(([name, url]) => `• ${name}: ${url}`).join('\n')}`;
      }
      return null;
    case 'pricing':
      if (kbContext.pricing.size > 0) {
        return Array.from(kbContext.pricing.values()).join('\n');
      }
      return null;
    case 'policies':
      return kbContext.policies.length > 0 ? kbContext.policies.join('\n') : null;
    default:
      return null;
  }
}

// Build enhanced system prompt with query-specific KB context
function buildEnhancedKBPrompt(queryType: QueryType, kbContext: KBContext, knowledgeBase: string): string {
  const sections: string[] = [];
  
  // Always include personality/tone if available
  if (kbContext.personality) {
    sections.push(`## YOUR PERSONALITY & TONE\n${kbContext.personality}`);
  }
  
  // Include query-specific context with higher priority
  const relevantSection = findRelevantKBSection(queryType, knowledgeBase, kbContext);
  if (relevantSection) {
    sections.push(`## PRIORITY: DIRECTLY RELEVANT TO THIS QUERY\nThe user is asking about ${queryType.toUpperCase()}. Use this information:\n${relevantSection}`);
  }
  
  // Include booking flow for booking-related queries
  if (['booking', 'availability', 'pricing'].includes(queryType)) {
    if (kbContext.bookingFlow) {
      sections.push(`## BOOKING FLOW TO FOLLOW\n${kbContext.bookingFlow}`);
    }
    if (kbContext.quoteFlow) {
      sections.push(`## QUOTE CREATION FORMAT\n${kbContext.quoteFlow}`);
    }
    if (kbContext.downpaymentPolicy) {
      sections.push(`## DOWNPAYMENT POLICY\n${kbContext.downpaymentPolicy}`);
    }
  }
  
  // Include payment info for payment queries
  if (queryType === 'payment') {
    if (kbContext.paymentAccounts) {
      sections.push(`## PAYMENT ACCOUNTS (SEND THESE EXACT DETAILS)\n${kbContext.paymentAccounts}`);
    }
    if (kbContext.paymentInfo) {
      sections.push(`## PAYMENT INFORMATION\n${kbContext.paymentInfo}`);
    }
    if (kbContext.downpaymentPolicy) {
      sections.push(`## DOWNPAYMENT POLICY\n${kbContext.downpaymentPolicy}`);
    }
  }
  
  return sections.join('\n\n');
}

// Extract actionable instructions from knowledge base content
// Now includes length validation, deduplication, and count limiting to prevent abuse
function extractKBInstructions(knowledgeBase: string): KBInstruction[] {
  const instructions: KBInstruction[] = [];
  if (!knowledgeBase) return instructions;
  
  // Common patterns for instructions in KB - expanded for flexibility
  const instructionPatterns = [
    // "when asked about X, say Y" or "if customer asks X, respond with Y"
    { pattern: /(?:when|if)(?:\s+(?:someone|customer|guest|user|they))?\s+(?:asks?|inquires?|wants?|requests?)\s+(?:about|for)?\s*[""']?([^""',\n]+)[""']?\s*(?:,|:)?\s*(?:say|respond|reply|answer|tell them|share|provide|give them)[:\s]+[""']?([^""'\n]+)[""']?/gi, priority: 10 },
    // "for X questions, share Y"
    { pattern: /for\s+([^,\n]+?)\s+(?:questions?|inquiries?|requests?)\s*[,:]\s*(?:share|provide|give|send|offer)[:\s]+[""']?([^""'\n]+)[""']?/gi, priority: 8 },
    // Bullet point instructions: "• When X → Y"
    { pattern: /[•\-\*]\s*(?:when|if)\s+([^→:,\n]+?)\s*[→:]\s*([^\n]+)/gi, priority: 9 },
    // "send them to: URL"
    { pattern: /(?:send|refer|direct)\s+(?:them|customer|guest)\s+to[:\s]+\s*(https?:\/\/[^\s\n]+)/gi, priority: 7 },
    // Numbered instructions
    { pattern: /\d+[.)]\s*(?:for|when|if)\s+([^,\n]+?)[,]\s*(?:do|say|respond|share|provide)\s+([^\n]+)/gi, priority: 6 },
    // "this is not something you tell someone directly" patterns
    { pattern: /this\s+is\s+not\s+something\s+you\s+(?:tell|say|share)[^,\n]*,\s*(?:only\s+)?(?:if|when)\s+([^,\n]+)/gi, priority: 10 },
    // "you can allow" patterns for flexibility
    { pattern: /if\s+they\s+(?:ask|request)\s+for\s+([^,\n]+?)\s+(?:instead\s+)?you\s+can\s+allow\s+it/gi, priority: 8 },
  ];
  
  for (const { pattern, priority } of instructionPatterns) {
    let match;
    while ((match = pattern.exec(knowledgeBase)) !== null) {
      if (match.length >= 2) {
        instructions.push({
          trigger: match[1]?.toLowerCase().trim() || '',
          response: match[match.length - 1]?.trim() || match[1]?.trim() || '',
          category: 'extracted',
          priority
        });
      }
    }
  }
  
  // ============= VALIDATION & DEDUPLICATION =============
  // Prevent KB instruction abuse: validate length, deduplicate, and limit count
  const seen = new Set<string>();
  const validated: KBInstruction[] = [];
  
  for (const instr of instructions) {
    // Validate trigger length (prevent resource exhaustion from huge patterns)
    if (instr.trigger.length > 200) {
      console.warn(`[KB Validation] Skipping instruction with oversized trigger (${instr.trigger.length} chars): ${instr.trigger.slice(0, 50)}...`);
      continue;
    }
    
    // Validate response length (prevent memory bloat)
    if (instr.response.length > 2000) {
      console.warn(`[KB Validation] Skipping instruction with oversized response (${instr.response.length} chars)`);
      continue;
    }
    
    // Require minimum trigger length (prevent meaningless patterns)
    if (instr.trigger.length < 2) {
      console.warn(`[KB Validation] Skipping instruction with too-short trigger: "${instr.trigger}"`);
      continue;
    }
    
    // Deduplicate by trigger + first 100 chars of response
    const dedupeKey = `${instr.trigger.toLowerCase()}|${instr.response.slice(0, 100).toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      console.log(`[KB Validation] Skipping duplicate instruction: "${instr.trigger}"`);
      continue;
    }
    
    seen.add(dedupeKey);
    validated.push(instr);
  }
  
  // Cap at 50 instructions to prevent performance degradation
  if (validated.length > 50) {
    console.warn(`[KB Validation] Reducing ${validated.length} instructions to 50 (sorting by priority)`);
    validated.length = 50;
  }
  
  // Sort by priority (highest first)
  validated.sort((a, b) => b.priority - a.priority);
  
  console.log(`[KB Validation] Extracted ${validated.length} valid KB instructions (from ${instructions.length} raw matches)`);
  
  return validated;
}

function formatForMessaging(text: string): string {
  if (!text) return text;
  
  return text
    // Remove markdown headers
    .replace(/#{1,6}\s+/g, '')
    // Remove markdown bold/italic but keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove markdown links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Normalize multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}

// ============= IMAGE URL VALIDATION =============
// Validates image URLs to ensure they're from trusted sources
// Prevents SSRF, malicious URLs, and invalid content

/**
 * Check if a URL is valid and from a trusted source for images.
 * Only allows HTTPS URLs from known safe domains.
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    console.warn('[ImageValidator] Invalid URL type:', typeof url);
    return false;
  }
  
  try {
    const parsed = new URL(url);
    
    // ✅ Only allow HTTPS (security requirement)
    if (parsed.protocol !== 'https:') {
      console.warn(`[ImageValidator] Rejecting non-HTTPS URL: ${parsed.protocol}`);
      return false;
    }
    
    // ✅ Allow known safe domains
    const safeDomains = [
      'lovable-uploads',           // Our own uploads
      'supabase.co',               // Supabase storage
      'graph.facebook.com',        // Facebook Graph API
      'scontent.xx.fbcdn.net',     // Facebook CDN
      'scontent.fmnl',             // Regional Facebook CDN variants
      'cdn.shopify.com',           // Common image hosting
      'images.pexels.com',         // Stock images
      'images.unsplash.com'        // Stock images
    ];
    
    const isSafeDomain = safeDomains.some(domain => 
      parsed.hostname.includes(domain) || parsed.hostname.endsWith(domain)
    );
    
    if (!isSafeDomain) {
      console.warn(`[ImageValidator] Rejecting untrusted domain: ${parsed.hostname}`);
      return false;
    }
    
    // ✅ Prevent excessively long URLs (potential attack vector)
    if (url.length > 2048) {
      console.warn(`[ImageValidator] Rejecting overly long URL (${url.length} chars)`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.warn('[ImageValidator] Invalid URL format:', err);
    return false;
  }
}

/**
 * Filter and validate an array of image URLs.
 * Returns only valid URLs, logs warnings for rejected ones.
 */
function validateImageUrls(urls: string[] | undefined): string[] {
  if (!urls || !Array.isArray(urls)) {
    return [];
  }
  
  const validated: string[] = [];
  
  for (const url of urls) {
    if (isValidImageUrl(url)) {
      validated.push(url);
    } else {
      console.warn(`[ImageValidator] Filtered out invalid image URL: ${url}`);
    }
  }
  
  // Limit to 5 images to prevent flooding
  if (validated.length > 5) {
    console.log(`[ImageValidator] Limiting ${validated.length} images to 5`);
    validated.length = 5;
  }
  
  return validated;
}

function getConfiguredOpeningMessage(org?: {
  sales_process_config?: { opening?: { enabled?: boolean; message?: string } } | null;
}): string | null {
  const openingConfig = org?.sales_process_config?.opening;

  if (openingConfig?.enabled && typeof openingConfig.message === 'string' && openingConfig.message.trim()) {
    return openingConfig.message.trim();
  }

  return null;
}

// Check if the user's message matches any KB instruction triggers
function findMatchingKBInstruction(
  userMessage: string,
  knowledgeBase: string,
  options?: { configuredOpeningMessage?: string | null }
): { found: boolean; response?: string; instruction?: string; queryType?: QueryType } {
  const msg = userMessage.toLowerCase();
  const queryType = detectQueryType(userMessage);
  const kbContext = parseKBContext(knowledgeBase);
  
  console.log(`[KB Intelligence] Query type detected: ${queryType}`);
  
  // 1. PHOTO REQUESTS - Check for landing pages
  if (queryType === 'photos' || looksLikePhotoRequest(msg)) {
    console.log('[KB Intelligence] Photo request detected, scanning KB for landing pages...');
    
    if (kbContext.landingPages.size > 0) {
      // Check if user is asking about a specific unit
      for (const [name, url] of kbContext.landingPages.entries()) {
        const unitTokens = name.split(/[\s()]+/).filter(t => t.length > 2);
        const matched = unitTokens.some(token => 
          token.length > 3 && msg.includes(token) && 
          !['the', 'and', 'for', 'with'].includes(token)
        );
        
        if (matched) {
          console.log(`[KB Intelligence] Matched specific unit: ${name}`);
          return {
            found: true,
            response: `You can check out photos and availability for ${name} here po: ${url} 😊`,
            instruction: `Photo request for "${name}" → Landing page`,
            queryType
          };
        }
      }
      
      // No specific unit matched - offer all landing pages
      const pages = Array.from(kbContext.landingPages.entries());
      const urlList = pages.map(([name, url]) => `• ${name}\n${url}`).join('\n\n');
      console.log(`[KB Intelligence] Offering all ${pages.length} landing pages`);
      return {
        found: true,
        response: `Here are our landing pages where you can check photos and availability po 📸\n\n${urlList}\n\nLet me know which unit interests you! 😊`,
        instruction: `Photo request → All landing pages (${pages.length})`,
        queryType
      };
    }
  }
  
  // 2. PAYMENT REQUESTS - Use exact payment accounts from KB
  // NOTE: We coordinate with the booking confirmation flow:
  // - "let's book" / "yes" → handled by booking confirmation guardrail (asks for name/contact first)
  // - "send payment details" / "where to pay" → handled here (sends payment accounts)
  if (queryType === 'payment') {
    // Explicit payment details request patterns (NOT booking confirmation triggers)
    // These should only fire when user is asking WHERE/HOW to pay, not just agreeing to book
    const explicitPaymentRequest = /(?:payment\s*details|send.*payment|gcash|bank.*details|account.*number|where.*pay|how.*pay|pila.*bayad|asa.*bayad|paying\s*now|send.*gcash|bank\s*transfer)/i.test(msg);
    
    // Avoid conflicting with booking confirmation flow (these are handled by guardrail)
    const isBookingConfirmation = /^(?:yes|okay|ok|sige|go|let'?s?\s*(?:do\s*it|book|proceed)|i'?ll?\s*(?:take\s*it|book)|book\s*(?:it|na)|sure|confirm)/i.test(msg.trim());
    
    if (explicitPaymentRequest && !isBookingConfirmation && kbContext.paymentAccounts) {
      console.log('[KB Intelligence] Payment accounts request, sending account details');
      return {
        found: true,
        response: `Here are our payment details po 💸\n\n${kbContext.paymentAccounts}\n\nOnce paid, kindly send proof of payment and valid IDs of all guests staying. Salamat! 🙏`,
        instruction: 'Payment request → KB payment accounts',
        queryType
      };
    }
    
    // If asking about downpayment policy
    if (/(?:downpayment|down\s*payment|deposit|how\s*much.*pay.*first)/i.test(msg) && kbContext.downpaymentPolicy) {
      console.log('[KB Intelligence] Downpayment policy request');
      return {
        found: true,
        response: kbContext.downpaymentPolicy,
        instruction: 'Downpayment inquiry → KB policy',
        queryType
      };
    }
    
    // General payment info
    if (kbContext.paymentInfo && /(?:gcash|bpi|bank|account|\d{10,})/i.test(kbContext.paymentInfo)) {
      console.log('[KB Intelligence] Payment info found in KB, using directly');
      return {
        found: true,
        response: kbContext.paymentInfo,
        instruction: 'Payment request → KB payment info',
        queryType
      };
    }
  }
  
  // 3. GREETING - Use configured opening message first, then KB greeting fallback
  if (queryType === 'greeting' && options?.configuredOpeningMessage) {
    console.log('[KB Intelligence] Using configured opening message');
    return {
      found: true,
      response: options.configuredOpeningMessage,
      instruction: 'Greeting → configured opening message',
      queryType
    };
  }

  if (queryType === 'greeting' && kbContext.greetings) {
    console.log('[KB Intelligence] Using KB greeting');
    return {
      found: true,
      response: kbContext.greetings,
      instruction: 'Greeting → KB welcome message',
      queryType
    };
  }
  
  // 4. Extract and check explicit KB instructions (highest priority patterns)
  const instructions = extractKBInstructions(knowledgeBase);
  
  for (const instr of instructions) {
    if (instr.trigger && msg.includes(instr.trigger)) {
      console.log(`[KB Intelligence] Matched instruction trigger: "${instr.trigger}" (priority: ${instr.priority})`);
      return {
        found: true,
        response: instr.response,
        instruction: `Trigger: ${instr.trigger} (priority: ${instr.priority})`,
        queryType
      };
    }
  }
  
  // 5. For pricing queries, check if we have specific unit pricing
  if (queryType === 'pricing' && kbContext.pricing.size > 0) {
    // Check if user mentioned a specific unit
    for (const [unitName, priceInfo] of kbContext.pricing.entries()) {
      if (msg.includes(unitName) || unitName.split(/\s+/).some(t => t.length > 3 && msg.includes(t))) {
        console.log(`[KB Intelligence] Found pricing for unit: ${unitName}`);
        return {
          found: true,
          response: priceInfo,
          instruction: `Pricing request for "${unitName}"`,
          queryType
        };
      }
    }
  }
  
  return { found: false, queryType };
}

// Log KB compliance events for monitoring
async function logKBComplianceEvent(
  organizationId: string,
  leadId: string,
  userMessage: string,
  matchedInstruction: string,
  responseUsed: string
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      action: 'kb_compliance_match',
      resource_type: 'ai_response',
      resource_id: leadId,
      details: {
        organization_id: organizationId,
        user_message: userMessage.slice(0, 200),
        matched_instruction: matchedInstruction,
        response_used: responseUsed.slice(0, 500)
      }
    });
  } catch (err) {
    console.warn('[KB Compliance] Failed to log compliance event:', err);
  }
}

interface RoomAvailability {
  roomId: string;
  roomName: string;
  isAvailable: boolean;
  reason?: string;
}

// Query live availability from bookings and maintenance_blocks tables for a date range
async function queryLiveAvailability(
  organizationId: string,
  dateRange: DateRange
): Promise<RoomAvailability[]> {
  console.log(`[Availability] Querying live availability for org ${organizationId} from ${dateRange.start} to ${dateRange.end}`);
  
  // Get all active room units for this org
  const { data: rooms, error: roomsError } = await supabase
    .from('room_units')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  
  if (roomsError || !rooms || rooms.length === 0) {
    console.error('[Availability] Error fetching rooms:', roomsError);
    return [];
  }
  
  console.log(`[Availability] Found ${rooms.length} active rooms`);
  
  const results: RoomAvailability[] = [];
  
  for (const room of rooms) {
    // Check bookings that overlap with the date range
    // A booking overlaps if: booking.check_in < range.end AND booking.check_out > range.start
    // Only CONFIRMED and CHECKED_IN bookings block availability
    // Pending bookings are non-blocking until manually confirmed by staff
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status, check_in, check_out')
      .eq('room_unit_id', room.id)
      .in('status', ['confirmed', 'upcoming', 'checked_in'])
      .lt('check_in', dateRange.end)  // Booking starts before range ends
      .gt('check_out', dateRange.start); // Booking ends after range starts
    
    if (bookings && bookings.length > 0) {
      console.log(`[Availability] Room ${room.name} is BOOKED during ${dateRange.start} to ${dateRange.end}`);
      results.push({
        roomId: room.id,
        roomName: room.name,
        isAvailable: false,
        reason: `booked (${bookings[0].status})`
      });
      continue;
    }
    
    // Check maintenance blocks that overlap with the date range
    const { data: maintenance } = await supabase
      .from('maintenance_blocks')
      .select('id, title, start_date, end_date')
      .eq('room_unit_id', room.id)
      .lt('start_date', dateRange.end)
      .gt('end_date', dateRange.start);
    
    if (maintenance && maintenance.length > 0) {
      console.log(`[Availability] Room ${room.name} is under MAINTENANCE during ${dateRange.start} to ${dateRange.end}`);
      results.push({
        roomId: room.id,
        roomName: room.name,
        isAvailable: false,
        reason: `maintenance: ${maintenance[0].title}`
      });
      continue;
    }
    
    // Check calendar_sync_events (external bookings from Airbnb, etc.)
    const { data: externalEvents } = await supabase
      .from('calendar_sync_events')
      .select('id, title, source_platform')
      .eq('room_unit_id', room.id)
      .lt('start_time', `${dateRange.end}T23:59:59Z`)
      .gt('end_time', `${dateRange.start}T00:00:00Z`);
    
    if (externalEvents && externalEvents.length > 0) {
      console.log(`[Availability] Room ${room.name} has EXTERNAL BOOKING during ${dateRange.start} to ${dateRange.end}`);
      results.push({
        roomId: room.id,
        roomName: room.name,
        isAvailable: false,
        reason: `external booking (${externalEvents[0].source_platform || 'synced'})`
      });
      continue;
    }
    
    // Room is available
    results.push({
      roomId: room.id,
      roomName: room.name,
      isAvailable: true
    });
  }
  
  return results;
}

// Build an authoritative availability reply that overrides AI hallucinations
function buildAvailabilityReply(
  dateRange: DateRange,
  availability: RoomAvailability[]
): string {
  const availableRooms = availability.filter(r => r.isAvailable);
  const _unavailableRooms = availability.filter(r => !r.isAvailable);
  
  const dateStr = dateRange.start === dateRange.end 
    ? formatDateForDisplay(dateRange.start)
    : `${formatDateForDisplay(dateRange.start)} to ${formatDateForDisplay(dateRange.end)}`;
  
  if (availableRooms.length === 0) {
    return `I've checked our availability for ${dateStr}, and unfortunately all our rooms are currently booked or unavailable on that date. Would you like me to suggest alternative dates?`;
  }
  
  if (availableRooms.length === availability.length) {
    const roomNames = availableRooms.map(r => r.roomName).join(', ');
    return `Great news! For ${dateStr}, all our rooms are available: ${roomNames}. Which one would you like to know more about?`;
  }
  
  const availableNames = availableRooms.map(r => r.roomName).join(', ');
  return `For ${dateStr}, the following room${availableRooms.length > 1 ? 's are' : ' is'} available: ${availableNames}. Would you like more details or to make a reservation?`;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Log availability contradictions for monitoring
async function logAvailabilityContradiction(
  organizationId: string,
  leadId: string,
  aiResponse: string,
  liveAvailability: RoomAvailability[],
  _mentionedRooms: string[]
): Promise<void> {
  const unavailableRooms = liveAvailability.filter(r => !r.isAvailable);
  const contradictions: string[] = [];
  
  const lowerResponse = aiResponse.toLowerCase();
  
  for (const room of unavailableRooms) {
    const roomNameLower = room.roomName.toLowerCase();
    // Check if AI mentioned this unavailable room as available
    if (lowerResponse.includes(roomNameLower) && 
        (lowerResponse.includes('available') || lowerResponse.includes('free') || lowerResponse.includes('open'))) {
      contradictions.push(`Incorrectly said "${room.roomName}" is available when it's ${room.reason}`);
    }
  }
  
  if (contradictions.length > 0) {
    console.error(`[CONTRADICTION ALERT] AI made false availability claims:`, contradictions);
    
    // Log to audit_logs for monitoring
    await supabase.from('audit_logs').insert({
      action: 'ai_availability_contradiction',
      resource_type: 'ai_response',
      resource_id: leadId,
      details: {
        organization_id: organizationId,
        contradictions,
        ai_response: aiResponse.slice(0, 500),
        live_availability: liveAvailability
      }
    });
  }
}

// Extract room names mentioned in AI response
function _extractMentionedRooms(text: string, knownRooms: string[]): string[] {
  const lowerText = text.toLowerCase();
  return knownRooms.filter(room => lowerText.includes(room.toLowerCase()));
}

// Build self-correction message if AI made false claims
function buildCorrectionMessage(
  originalResponse: string,
  liveAvailability: RoomAvailability[]
): string | null {
  const unavailableRooms = liveAvailability.filter(r => !r.isAvailable);
  const lowerResponse = originalResponse.toLowerCase();
  const falselyClaimedAvailable: string[] = [];
  
  for (const room of unavailableRooms) {
    const roomNameLower = room.roomName.toLowerCase();
    // Check for patterns like "X is available" or "X is free"
    if (lowerResponse.includes(roomNameLower) && 
        (lowerResponse.includes('available') || lowerResponse.includes('free') || 
         lowerResponse.includes('open') || lowerResponse.includes('can book'))) {
      falselyClaimedAvailable.push(room.roomName);
    }
  }
  
  if (falselyClaimedAvailable.length === 0) {
    return null;
  }
  
  const availableRooms = liveAvailability.filter(r => r.isAvailable);
  
  if (availableRooms.length === 0) {
    return `I need to correct myself - I apologize for the confusion! After double-checking our system, ${falselyClaimedAvailable.join(' and ')} ${falselyClaimedAvailable.length > 1 ? 'are' : 'is'} actually not available on that date. Unfortunately, we don't have any rooms available. Would you like me to check alternative dates?`;
  }
  
  const availableNames = availableRooms.map(r => r.roomName).join(' and ');
  return `I need to correct myself - I apologize for the confusion! After double-checking our system, ${falselyClaimedAvailable.join(' and ')} ${falselyClaimedAvailable.length > 1 ? 'are' : 'is'} actually not available. However, ${availableNames} ${availableRooms.length > 1 ? 'are' : 'is'} available. Would you like to proceed with ${availableRooms.length > 1 ? 'one of those' : 'that one'}?`;
}

// Retry helper with exponential backoff and dynamic timeout management
// Meta webhooks have 20 second timeout, but we want fast responses for UX
async function _fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 1000,
  maxAvailableTimeMs = 12000  // Increased from 4500ms - AI gateway can take up to 8s during peak
): Promise<Response> {
  let lastError: Error | null = null;
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Calculate remaining time for this request
      const elapsedMs = Date.now() - startTime;
      const remainingMs = maxAvailableTimeMs - elapsedMs;
      
      // If we're running out of time, give up
      if (remainingMs < 1000) {
        console.warn(`[Timeout] Insufficient time remaining for retry (${remainingMs}ms < 1000ms)`);
        throw new Error('Webhook timeout constraint exceeded - insufficient time for retries');
      }
      
      // Distribute timeout across remaining attempts
      const perAttemptMs = Math.min(
        Math.floor(remainingMs / (maxRetries - attempt + 1)),
        5000  // Cap at 5 seconds per attempt
      );
      
      console.log(`[Timeout] Attempt ${attempt}/${maxRetries}, ${perAttemptMs}ms timeout, ${remainingMs}ms remaining overall`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[Timeout] Request timed out after ${perAttemptMs}ms`);
        controller.abort();
      }, perAttemptMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Retry on 5xx server errors or rate limits
      if (response.status >= 500 || response.status === 429) {
        const errorText = await response.text();
        console.warn(`AI API returned ${response.status} on attempt ${attempt}/${maxRetries}: ${errorText}`);
        lastError = new Error(`API returned ${response.status}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          console.log(`Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a timeout/abort error
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      const isNetworkError = error instanceof TypeError;
      const isOverallTimeout = (error as Error).message.includes('Webhook timeout constraint');
      
      console.error(`AI fetch attempt ${attempt}/${maxRetries} failed:`, isTimeout ? 'Timeout' : isOverallTimeout ? 'Overall timeout' : error);
      
      if (isOverallTimeout) {
        // Don't retry if we're out of overall time
        throw lastError;
      }
      
      if (attempt < maxRetries && (isTimeout || isNetworkError)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('All retry attempts exhausted');
}

// Generate AI response using Lovable AI - now supports image analysis and language lock
async function generateAIResponse(
  agentType: string,
  messageText: string,
  conversationHistory: Array<{ role: string; content: string | Record<string, unknown> }>,
  knowledgeBase: string,
  imageUrls?: string[],
  orgSettings?: {
    name: string;
    allowed_languages: string[];
    language_lock_enabled: boolean;
    sales_process_config?: { opening?: { enabled?: boolean; message?: string } } | null;
  }
) {
  console.log(`Generating AI response for agent type: ${agentType}, images: ${imageUrls?.length || 0}`);

  if (!GOOGLE_API_KEY) {
    console.error("CRITICAL: GOOGLE_API_KEY is not set in environment variables.");
    return "I'm sorry, the AI service is not configured correctly. Please contact support.";
  }

  const imageAnalysisInstructions = imageUrls && imageUrls.length > 0 
    ? `\n\nIMAGE ANALYSIS: The user has sent ${imageUrls.length} image(s). Analyze what you see and respond appropriately.`
    : '';

  // Instructions for SENDING images to users
  const imageSendingInstructions = `

IMAGE SENDING CAPABILITY:
You CAN send images to users! When a user asks for pictures/photos of rooms, units, amenities, or anything else:
1. Check the KNOWLEDGE BASE for image URLs associated with the item they're asking about.
2. If image URLs are found in the knowledge base, include them in your response using this EXACT format: [IMAGE: url]
3. Example: "Here's a photo of our studio unit! [IMAGE: https://example.com/room-photo.jpg]"
4. You can send multiple images: "Here are photos of the unit! [IMAGE: url1] [IMAGE: url2]"
5. ONLY use image URLs that exist in the KNOWLEDGE BASE - never invent or guess URLs.
6. If no images are available in the knowledge base for what they're asking about, say: "I don't have photos available for that right now, but I can describe it for you or connect you with our team to send you pictures."
`;

  // Build language instructions based on org settings
  const allowedLanguages = orgSettings?.allowed_languages || ['en'];
  const languageLockEnabled = orgSettings?.language_lock_enabled ?? true;
  const isExempt = orgSettings?.name ? isExemptOrganization(orgSettings.name) : false;
  const languageInstructions = buildLanguageInstructions(allowedLanguages, languageLockEnabled, isExempt);

  // Universal clarification instructions for all agents
  const clarificationInstructions = `

⚠️ ABSOLUTE RULE - NEVER ASSUME ANYTHING ⚠️
This is your MOST IMPORTANT rule. You must NEVER assume, guess, or make up ANY information.

WHEN YOU DON'T KNOW OR ARE UNSURE:
- STOP and ASK. Do not proceed with incomplete information.
- Say "Let me confirm..." or "Just to make sure I understand correctly..."
- Be honest: "I don't have that information, could you please tell me...?"

BEFORE ANY ACTION (booking, order, quote, etc.):
- REPEAT back ALL details to the customer for confirmation.
- Wait for their "yes" or confirmation before proceeding.
- If ANY detail is missing, ASK for it. Don't fill in the blanks yourself.

EXAMPLES OF WHAT TO ASK (not assume):
- Dates, times, quantities, sizes, preferences
- Names, contact details, special requests
- Which specific product/room/item they want
- Any unclear or ambiguous statements

IF A MESSAGE IS UNCLEAR:
- Don't interpret it your way - ASK what they mean.
- "Could you clarify what you mean by...?"
- "Just to make sure, are you asking about...?"

REMEMBER: It's ALWAYS better to ask one more question than to make a wrong assumption.

## LEAD STATUS TRACKING - ACTION BLOCKS
When a lead's status should change based on the conversation, include an [ACTION] block at the END of your response:

STATUS DEFINITIONS:
- "new": Initial contact, no meaningful engagement yet
- "contacted": You've engaged in conversation, gathering information
- "qualified": Lead has shown clear interest, provided requirements (dates, preferences, etc.)
- "booked": Lead has confirmed a booking/order/reservation
- "converted": Transaction completed (payment received, service delivered)
- "lost": Lead explicitly declined or is no longer interested

WHEN TO UPDATE STATUS:
1. After first meaningful exchange → set_lead_status: "contacted"
2. When lead provides specific requirements (dates, preferences, budget) → set_lead_status: "qualified"
3. When a booking/order is confirmed → set_lead_status: "booked"
4. When lead explicitly declines → set_lead_status: "lost"

FORMAT (include at the very end of your response, after your message):
[ACTION]
{"set_lead_status": "qualified"}

EXAMPLE - After a lead provides booking dates:
"Perfect! I've noted your stay from Jan 15-17 for 4 guests. The Nest Suite is available at ₱5,500/night. Would you like me to reserve it for you?"
[ACTION]
{"set_lead_status": "qualified"}

IMPORTANT: Only include [ACTION] when status genuinely changes. Don't repeat the same status.
`;

  const agentPrompts: Record<string, string> = {
    jay: `You are Jay, a professional AI sales assistant. You help qualify leads, answer questions about products/services, and guide potential customers. Be friendly, helpful, and professional.
${clarificationInstructions}${imageAnalysisInstructions}${imageSendingInstructions}`,
    may: `You are May, a friendly AI assistant for a food business. You help customers with menu questions, take food orders, provide recommendations, and schedule order pickups. Be warm and helpful.
${clarificationInstructions}${imageAnalysisInstructions}${imageSendingInstructions}`,
    cece: `You are Cece, a helpful AI concierge for a hotel or accommodation. You help guests with room inquiries, bookings, amenities information, and general questions about the property. Be welcoming and knowledgeable.

CRITICAL - DETERMINISTIC AVAILABILITY CHECK:
⚠️ IMPORTANT: Availability is NOT decided by you. The system pre-calculates it.
- When checking availability, look for ✅ AVAILABLE or ⛔ NOT AVAILABLE indicators in the room data
- REPORT these results to the guest - do NOT speculate or override
- If a guest questions the availability, escalate (don't try to second-guess the system)

CRITICAL - DATE HANDLING FOR BOOKINGS:
Guests may provide dates in various formats. Here's how to handle them:

1. RELATIVE DATES ARE VALID: Accept casual date expressions like:
   - "today", "tonight", "this afternoon"
   - "tomorrow", "tomorrow morning"
   - "this Sunday", "Sunday morning"
   - "this weekend", "next Friday"
   These are valid answers! Convert them to explicit dates using today's date from CURRENT DATE AWARENESS.

2. SINGLE DATE = ASK FOR CHECK-OUT:
   - If guest provides only ONE date (e.g., "January 12" or "tomorrow"), ask for check-out.
   - Example: "Got it! Check-in on January 12. What date will you be checking out?"

3. DATE RANGES = READ AVAILABILITY FROM ROOM DATA:
   - When guest provides check-in and check-out dates, look at each room's availability status
   - Status is pre-calculated and shown as ✅ AVAILABLE or ⛔ NOT AVAILABLE
   - Report this directly to the guest
   - If a room is marked ⛔ NOT AVAILABLE, explain which dates are blocked

4. ALWAYS CONFIRM WITH EXPLICIT DATES:
   - Before providing a quote, state the explicit dates clearly.
   - Example: "Let me confirm: Check-in on January 16, Check-out on January 18 (2 nights)..."
   - This allows the guest to correct any misunderstanding.

5. NEVER ASSUME OR INVENT DATES:
   - If unclear, ask for clarification.
   - "Just to confirm, you'd like to check in on January 11 and check out on January 12?"

CHECKOUT DAY = AVAILABLE FOR NEXT GUEST:
⚠️ CRITICAL RULE: If a guest checks out on January 15, then January 15 IS AVAILABLE for a new guest to check in.
- Example: Guest A checks out Jan 15, Guest B wants to check in Jan 15
  → This is ALLOWED (same-day turnover)
  → If Jan 15 doesn't appear in the "BLOCKED DATES" list, it's free
  → The checkout date is NOT blocked
${clarificationInstructions}${imageAnalysisInstructions}${imageSendingInstructions}`
  };
  
  // CRITICAL: Knowledge Base is the SINGLE SOURCE OF TRUTH
  const kbComplianceRules = `
## CRITICAL: KNOWLEDGE BASE IS YOUR SINGLE SOURCE OF TRUTH

**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:**

### RULE #1: KB INSTRUCTIONS OVERRIDE YOUR TRAINING
The KNOWLEDGE BASE contains specific instructions from the business on how to respond to certain situations. These instructions ALWAYS take priority over your general training. If the KB says "when asked about X, respond with Y" - YOU MUST DO EXACTLY THAT.

### RULE #2: SCAN THE KB FIRST FOR EVERY QUESTION
Before generating ANY response:
1. Search the KNOWLEDGE BASE for relevant sections
2. Look for direct instructions like "when asked about..." or "if customer wants..."
3. If the KB contains specific response guidance, USE IT VERBATIM
4. Only use your own words if the KB has no specific instruction

### RULE #3: NEVER CONTRADICT THE KB
If the KB says to offer a landing page link for photos, OFFER THE LANDING PAGE LINK.
If the KB says to refer to a team member, REFER TO THAT TEAM MEMBER.
If the KB says to use specific wording, USE THAT EXACT WORDING.
You are an extension of the business - the KB represents their voice and processes.

### RULE #4: NEVER SAY "I CAN'T" IF THE KB HAS A SOLUTION
If a customer asks for something and the KB provides a workaround or alternative:
- DO NOT say "I can't do that"
- DO provide the alternative from the KB
- Example: Customer asks for photos → KB says "share this landing page" → YOU share the landing page, don't say "I can't send photos"

### RULE #5: INFORMATION ACCURACY
- PAYMENT: Only use exact payment details from KB. If not in KB, say "I'll connect you with our team for payment instructions."
- PRICING: Only quote prices from KB. If not in KB, say "Let me get our team to confirm the rates for you."
- POLICIES: Only state policies from KB. If not in KB, say "I'll check with our team on that."
- AMENITIES: Only mention amenities from KB. Never assume or invent features.
- AVAILABILITY: Trust the availability guardrail system - never guess availability.
- CONTACT INFO: Only share contact details from KB. Never invent phone numbers or addresses.

### RULE #6: WHEN IN DOUBT
If information is not in the KNOWLEDGE BASE and you cannot find specific guidance:
1. Acknowledge you need to check
2. Offer to connect them with a human agent
3. NEVER guess or make up details
`;

  // Detect query type and parse KB context for intelligent response generation
  const queryType = detectQueryType(messageText);
  const kbContext = parseKBContext(knowledgeBase);
  const enhancedKBPrompt = buildEnhancedKBPrompt(queryType, kbContext, knowledgeBase);
  
  console.log(`[KB Intelligence] Query type: ${queryType}, Personality: ${kbContext.personality ? 'yes' : 'no'}, Pricing entries: ${kbContext.pricing.size}, Landing pages: ${kbContext.landingPages.size}`);

  // Add current date context for accurate date interpretation
  const currentDate = new Date();
  const timezone = 'Asia/Manila';
  const dateOptions: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: timezone
  };
  const shortDateOptions: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  };
  
  const formattedDate = currentDate.toLocaleDateString('en-US', dateOptions);
  const formattedShort = currentDate.toLocaleDateString('en-US', shortDateOptions);
  
  // Calculate key dates
  const tomorrow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = tomorrow.toLocaleDateString('en-US', dateOptions);
  const tomorrowShort = tomorrow.toLocaleDateString('en-US', shortDateOptions);
  
  const dayAfter = new Date(currentDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const dayAfterShort = dayAfter.toLocaleDateString('en-US', shortDateOptions);
  
  // Calculate this weekend
  const daysUntilSaturday = (6 - currentDate.getDay() + 7) % 7 || 7;
  const thisSaturday = new Date(currentDate.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
  const thisSunday = new Date(thisSaturday.getTime() + 24 * 60 * 60 * 1000);
  const saturdayShort = thisSaturday.toLocaleDateString('en-US', shortDateOptions);
  const sundayShort = thisSunday.toLocaleDateString('en-US', shortDateOptions);
  
  const dateContext = `## CRITICAL - CURRENT DATE AWARENESS
- Today's date is: ${formattedDate}
- Tomorrow is: ${tomorrowDate}
- This Saturday is: ${saturdayShort}
- This Sunday is: ${sundayShort}

RELATIVE DATE INTERPRETATION:
When guests use relative/casual date expressions, convert them to EXPLICIT DATES:
- "today" / "tonight" / "this afternoon" → ${formattedShort}
- "tomorrow" / "tomorrow morning" → ${tomorrowShort}
- "day after tomorrow" → ${dayAfterShort}
- "this Sunday" / "Sunday" / "on Sunday" → ${sundayShort}
- "this weekend" → ${saturdayShort} to ${sundayShort}

IMPORTANT: These relative dates are VALID check-in/check-out answers. Accept them and convert to explicit dates.
When confirming or providing a quote, ALWAYS state the explicit dates (e.g., "January 12 to January 13") so the guest can verify.
`;

  // Build the system prompt with query-specific KB context injected at higher priority
  const systemPrompt = `${agentPrompts[agentType] || agentPrompts.jay}\n\n${dateContext}\n\n${languageInstructions}\n\n${sharedInstructions}\n\n${kbComplianceRules}\n\n${enhancedKBPrompt ? `## QUERY-SPECIFIC CONTEXT (HIGHEST PRIORITY FOR THIS MESSAGE)\n${enhancedKBPrompt}\n\n` : ''}${knowledgeBase ? `KNOWLEDGE BASE (ONLY use information from here):\n${knowledgeBase}` : 'NOTE: No knowledge base configured. Be very careful not to make up any specific details about the property.'}\n\nKeep responses concise and conversational - suitable for messaging apps. Don't use markdown formatting.`;

  // Build message content - support multimodal if images present
  let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = messageText;
  if (imageUrls && imageUrls.length > 0) {
    userContent = [
      { type: 'text', text: messageText || 'What do you see in this image?' }
    ];
    for (const imageUrl of imageUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }
    console.log(`Adding ${imageUrls.length} images to AI request`);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent }
  ];

  console.log(`Calling Google Gemini AI with ${messages.length} messages (${conversationHistory.length} history)`);

  try {
    const temp = getAgentTemperature(agentType);

    const geminiRequest = convertToGeminiFormat(messages as { role: string; content: string | { [key: string]: unknown; type: string; }[]; }[]);
    const callOptions: GeminiCallOptions = {
      maxRetries: 3,
      retryDelayMs: 1000,
      timeout: 15000,
      trackMetrics: true,
      fallbackResponse: "I'm sorry, I couldn't process that request.",
    };

    const response = await callGeminiAPI(GOOGLE_API_KEY, {
      ...geminiRequest,
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: temp,
      },
    }, 'gemini-2.5-flash', callOptions);

    const aiResponse = typeof response === 'string' ? response : "I'm sorry, I couldn't process that request.";
    console.log('AI response generated:', aiResponse.slice(0, 100) + '...');
    return aiResponse;
  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Log AI generation failure for monitoring
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AI Generation Failed] Error: ${errorMessage}`);
    
    // Return a more informative fallback that prompts user action
    return "I apologize, but I'm experiencing a brief technical issue. Your message has been received - if I don't respond within a minute, our team will be notified and follow up with you shortly. 🙏";
  }
}

// Extract URLs from a string
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function looksLikeImageUrl(url: string): boolean {
  // Common image extensions OR known storage patterns (often don’t have extensions)
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return true;
  if (url.includes('lovable-uploads')) return true;
  if (url.includes('/storage/v1/object/')) return true;
  if (url.includes('supabase.co/storage')) return true;
  return false;
}

function parseOutboundContent(rawMessage: string): { text: string; imageUrls: string[] } {
  if (!rawMessage) return { text: '', imageUrls: [] };

  const imageUrls: string[] = [];

  // 1) [IMAGE: url] markers
  const markerRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = markerRegex.exec(rawMessage)) !== null) {
    imageUrls.push(markerMatch[1]);
  }

  // 2) Raw URLs (if they look like images)
  for (const url of extractUrls(rawMessage)) {
    if (looksLikeImageUrl(url)) imageUrls.push(url);
  }

  const uniqueImages = Array.from(new Set(imageUrls));

  // Remove markers + image URLs from the outgoing text so we don't send links as plain text
  let text = rawMessage.replace(markerRegex, '').trim();
  for (const url of uniqueImages) {
    // Replace all occurrences
    text = text.split(url).join('');
  }
  
  // Clean up formatting for messaging platforms
  text = formatForMessaging(text);
  
  // Normalize spacing (but preserve intentional line breaks)
  text = text.replace(/[ \t]{2,}/g, ' ').trim();

  return { text, imageUrls: uniqueImages };
}

// Send response back to platform - returns message ID on success, null on failure
async function sendPlatformResponse(
  platform: string,
  recipientId: string,
  message: string,
  accessToken: string,
  pageId: string
): Promise<string | null> {
  const { text, imageUrls } = parseOutboundContent(message);

  // Helper to call the Graph API and extract a message id
  const sendRaw = async (body: Record<string, unknown>): Promise<string | null> => {
    const apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;

    console.log(`Sending ${platform} response to ${recipientId} via page ${pageId}`);
    console.log('Request body:', JSON.stringify(body));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`${platform} API error:`, response.status, responseText);
      return null;
    }

    console.log(`${platform} response sent successfully:`, responseText);

    try {
      const responseData = JSON.parse(responseText);
      const messageId = responseData.message_id || responseData.messages?.[0]?.id;
      if (messageId) {
        console.log(`Platform returned message ID: ${messageId}`);
        return messageId;
      }
    } catch (e) {
      console.warn('Could not parse message ID from response:', e);
    }

    return 'sent';
  };

  // WhatsApp uses a different payload format
  if (platform === 'whatsapp') {
    let lastId: string | null = null;

    if (text) {
      lastId = await sendRaw({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: text },
      });
      if (!lastId) return null;
    }

    for (const url of imageUrls) {
      lastId = await sendRaw({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'image',
        image: { link: url },
      });
      if (!lastId) return null;
    }

    return lastId;
  }

  // Messenger / Instagram
  let lastId: string | null = null;

  if (text) {
    const base = platform === 'messenger'
      ? {
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text },
        }
      : {
          recipient: { id: recipientId },
          message: { text },
        };

    lastId = await sendRaw(base);
    if (!lastId) return null;
  }

  for (const url of imageUrls) {
    const attachmentBody = platform === 'messenger'
      ? {
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: {
            attachment: {
              type: 'image',
              payload: { url, is_reusable: true },
            },
          },
        }
      : {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'image',
              payload: { url, is_reusable: true },
            },
          },
        };

    lastId = await sendRaw(attachmentBody);
    if (!lastId) return null;
  }

  return lastId;
}

serve(async (req: Request) => {
  const logger = createLogger(req, 'social-webhook');
  const startTime = Date.now();
  const corsHeaders = createCorsHeaders(req, 'x-hub-signature-256');
  
  // --- Step 1: Handle preflight and verification requests immediately ---

  const corsResponse = handleCorsPreflightRequest(req, 'x-hub-signature-256');
  if (corsResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return corsResponse;
  }

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log('Webhook verification successful');
        await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
        return new Response(challenge, { status: 200 });
      } else {
        console.warn('Webhook verification failed: Invalid mode or token');
        await logger.logRequest({ responseStatus: 403, errorMessage: 'Invalid verification token', responseTimeMs: Date.now() - startTime });
        return new Response('Forbidden', { status: 403 });
      }
    } catch (e) {
      console.error('Error in webhook verification:', e);
      await logger.logRequest({ responseStatus: 500, errorMessage: 'Verification error', responseTimeMs: Date.now() - startTime });
      return new Response('Error', { status: 500 });
    }
  }

  if (req.method !== 'POST') {
    await logger.logRequest({ responseStatus: 405, responseTimeMs: Date.now() - startTime });
    return new Response('Method Not Allowed', { status: 405 });
  }

  // --- Step 2: Initialize vault for credential decryption ---
  try {
    // deno-lint-ignore no-explicit-any
    vaultEnabled = await initVault(supabase as any);
    if (vaultEnabled) {
      console.log('[Vault] Initialized for credential decryption');
    }
  } catch (err) {
    console.warn('[Vault] Init failed, using plaintext credentials:', err);
  }

  // --- Step 3: Read and validate the request body ---
  let rawBody: string;
  let body: Record<string, unknown>;
  
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error('Invalid JSON in request body:', e);
    await logger.logRequest({ responseStatus: 400, errorMessage: 'Invalid JSON', responseTimeMs: Date.now() - startTime });
    return new Response('Bad Request', { status: 400 });
  }

  // --- Step 4: Verify HMAC signature (security) ---
  const signature = req.headers.get('x-hub-signature-256');
  const signatureValid = await verifyMetaSignature(rawBody, signature);
  if (!signatureValid) {
    console.error('HMAC signature verification failed');
    await logger.logRequest({ responseStatus: 401, errorMessage: 'Invalid signature', responseTimeMs: Date.now() - startTime });
    return new Response('Unauthorized', { status: 401 });
  }

  // --- Step 5: Check for status updates (delivery/read receipts) ---
  const statusUpdate = extractStatusUpdate(body);
  if (statusUpdate) {
    await handleStatusUpdate(statusUpdate);
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // --- Step 5b: Check for reaction updates ---
  const reactionUpdate = extractReactionUpdate(body);
  if (reactionUpdate) {
    await handleReactionUpdate(reactionUpdate);
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // --- Step 6: Detect platform and extract message data ---
  const platform = detectPlatform(body);
  if (!platform) {
    console.log('Unknown or unsupported platform/event type');
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  const messageData = extractMessageData(body, platform);
  if (!messageData) {
    console.log('Could not extract message data from payload');
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // --- Step 7: Check for duplicate messages (idempotency) ---
  if (isDuplicateMessage(messageData.messageId)) {
    console.log('Duplicate message, returning OK to Meta');
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // --- Step 8: Process the message asynchronously (return OK to Meta immediately) ---
  // Meta expects a 200 response within 5-10 seconds, so we process async
  const processPromise = processMessage(messageData, platform);
  
  // Don't await - let it run in background
  processPromise.catch(err => {
    console.error('Error in async message processing:', err);
  });

  await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
  return new Response('OK', { status: 200, headers: corsHeaders });
});

// Async message processing
async function processMessage(
  messageData: {
    senderId: string;
    messageText: string;
    pageId: string;
    messageId: string;
    direction: 'inbound' | 'outbound';
    imageUrls?: string[];
  },
  platform: string
) {
  const senderId = messageData.senderId as unknown as string;
  const pageId = messageData.pageId as unknown as string;
  
  console.log(`Processing ${platform} message from ${senderId}: ${messageData.messageText.slice(0, 50)}...`);

  // Get platform configuration
  const config = await getPlatformConfig(pageId, platform);
  if (!config || !config.accessToken) {
    console.error(`No enabled configuration with access token found for page ${messageData.pageId}`);
    return;
  }

  // Record webhook received for health tracking
  // deno-lint-ignore no-explicit-any
  if ((config.platform as any)?.id) {
    // deno-lint-ignore no-explicit-any
    const platform_ = config.platform as any;
    await recordWebhookHealth(platform_?.id, platform_?.organization_id, platform, true, false, null);
  }

  const { organization, accessToken } = config;
  // deno-lint-ignore no-explicit-any
  const org = organization as any;
  const lead = await getOrCreateLead(senderId, platform, org?.id || '', accessToken);
  if (!lead) return;

  // ============= CRITICAL: AI SAFETY CHECK AT TOP =============
  // Check is_ai_managed IMMEDIATELY after getting lead - before ANY processing
  // This is the first line of defense against race conditions
  if (!lead.is_ai_managed) {
    console.log(`[AI Safety] Lead ${lead.id} has AI disabled (is_ai_managed=false). Skipping ALL AI processing.`);
    // Still save the message but exit before any AI logic runs
    await supabase.from('communications').insert({
      organization_id: org?.id,
      lead_id: lead.id,
      channel: platform,
      direction: 'inbound',
      role: 'user',
      content: messageData.messageText,
      status: 'received',
      external_id: messageData.messageId,
      metadata: {
        sender_id: messageData.senderId,
        platform: platform,
        page_id: messageData.pageId,
        image_urls: messageData.imageUrls,
        ai_skipped: true,
        ai_skip_reason: 'is_ai_managed=false'
      }
    });
    return;
  }

  const conversation = await getOrCreateConversation(lead.id, org?.id, platform, senderId);
  if (!conversation) return;

  // Echo/outbound messages (sent from the Page/IG account) should be logged for history,
  // but MUST NOT trigger AI replies.
  if (messageData.direction === 'outbound') {
    try {
      // Avoid double-logging when the message was sent via our own "send-social-message" function
      const { data: existing } = await supabase
        .from('communications')
        .select('id')
        .eq('external_id', messageData.messageId)
        .eq('channel', platform)
        .eq('direction', 'outbound')
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error: commError } = await supabase.from('communications').insert({
          organization_id: org?.id,
          lead_id: lead.id,
          channel: platform,
          direction: 'outbound',
          role: 'assistant',
          content: messageData.messageText,
          status: 'sent',
          external_id: messageData.messageId,
          metadata: {
            platform,
            conversation_id: conversation.id,
            recipient_id: senderId,
            page_id: messageData.pageId,
            is_echo: true,
          },
        });

        if (commError) {
          console.error('Error saving outbound echo to communications:', commError);
        }
      }
    } catch (err) {
      console.error('Error processing outbound echo message:', err);
    }

    return;
  }

  // Save inbound message to communications (SINGLE SOURCE OF TRUTH)
  const { error: commError } = await supabase.from('communications').insert({
    organization_id: org?.id,
    lead_id: lead.id,
    channel: platform,
    direction: 'inbound',
    role: 'user',
    content: messageData.messageText,
    status: 'received',
    external_id: messageData.messageId,
    metadata: {
      sender_id: messageData.senderId,
      platform: platform,
      page_id: messageData.pageId,
      conversation_id: conversation.id,
      image_urls: messageData.imageUrls
    }
  });

  if (commError) {
    // Check for duplicate (already saved by another worker)
    if (commError.code === '23505') {
      console.log('Duplicate message already saved, skipping');
      return;
    }
    console.error('Error saving to communications:', commError);
  } else {
    console.log(`Saved inbound message to communications for lead ${lead.id}`);
    
    // Auto-extract phone number from message if lead doesn't have one
    if (!lead.phone) {
      const extractedPhone = extractPhoneNumber(messageData.messageText);
      if (extractedPhone) {
        await updateLeadPhoneIfEmpty(lead.id, extractedPhone, org?.default_country_code);
      }
    }
  }

  // Note: AI safety check already performed at top of processMessage()
  // The early check at line ~4090 saves the message and exits before reaching here if AI is disabled

  // ============= IN-MEMORY PROCESSING LOCK =============
  // Check if another worker is already processing this lead to prevent race conditions
  const lockKey = `${lead.id}_${platform}`;
  const lockNow = Date.now();
  
  // Clean up expired locks
  for (const [key, lockInfo] of processingLeads.entries()) {
    if (lockNow - lockInfo.startedAt > PROCESSING_EXPIRY_MS) {
      console.log(`[Lock] Cleaning up expired lock for ${key}`);
      processingLeads.delete(key);
    }
  }
  
  // Check if another worker has the lock
  const existingLock = processingLeads.get(lockKey);
  if (existingLock && lockNow - existingLock.startedAt < PROCESSING_EXPIRY_MS) {
    console.log(`[Lock] Another worker is processing lead ${lead.id}. Skipping AI generation.`);
    return;
  }
  
  // Acquire lock
  processingLeads.set(lockKey, { startedAt: lockNow, messageId: messageData.messageId });
  console.log(`[Lock] Acquired processing lock for lead ${lead.id}`);

  // Try to claim a DB-backed processing lock to coordinate across workers
  // deno-lint-ignore no-explicit-any
  const dbLockAcquired = await claimProcessingLock(supabase as any, String(lead.id), org?.id, platform);
  if (!dbLockAcquired) {
    console.log(`[Lock] DB lock already held for lead ${lead.id} on ${platform}. Releasing in-memory lock and skipping.`);
    processingLeads.delete(lockKey);
    return;
  }

  // Rate limit applies ONLY to generating/sending the AI reply (never to persistence).
  const rateLimitResult = await checkCombinedRateLimit(supabase, senderId);
  if (!rateLimitResult.allowed) {
    console.warn(
      `Rate limit exceeded for sender ${senderId}. Skipping AI reply. Remaining: ${rateLimitResult.remaining}`,
    );
    processingLeads.delete(lockKey);
    // Release DB lock as well
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    return;
  }

  // Wait for the debounce period to collect any follow-up messages
  console.log(`[Debounce] Waiting ${DEBOUNCE_WINDOW_MS}ms for follow-up messages...`);
  await new Promise(resolve => setTimeout(resolve, DEBOUNCE_WINDOW_MS));

  // Check if AI already responded very recently (within 2 seconds) to prevent duplicate responses
  const responseCheckCutoff = new Date(Date.now() - 2000).toISOString();
  const { data: veryRecentResponse } = await supabase
    .from('communications')
    .select('id, created_at')
    .eq('lead_id', lead.id)
    .eq('organization_id', org?.id)
    .eq('channel', platform)
    .eq('direction', 'outbound')
    .gte('created_at', responseCheckCutoff)
    .limit(1);

  if (veryRecentResponse && veryRecentResponse.length > 0) {
    // Check if there are user messages AFTER this very recent response
    const { data: msgsAfterResponse } = await supabase
      .from('communications')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('organization_id', org?.id)
      .eq('channel', platform)
      .eq('direction', 'inbound')
      .gt('created_at', veryRecentResponse[0].created_at)
      .limit(1);
    
    if (!msgsAfterResponse || msgsAfterResponse.length === 0) {
      console.log("AI responded very recently and no new user messages after. Skipping to prevent duplicate.");
      return;
    }
    console.log("Found user messages after recent AI response - will generate new response");
  }

  // Get last AI response time to find unanswered messages
  const { data: lastAIResponseData } = await supabase
    .from('communications')
    .select('created_at')
    .eq('lead_id', lead.id)
    .eq('organization_id', org?.id)
    .eq('channel', platform)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1);

  // Get all user messages that haven't been responded to yet
  let newMessagesQuery = supabase
    .from('communications')
    .select('content, created_at')
    .eq('lead_id', lead.id)
    .eq('organization_id', org?.id)
    .eq('channel', platform)
    .eq('direction', 'inbound');

  if (lastAIResponseData && lastAIResponseData.length > 0) {
    newMessagesQuery = newMessagesQuery.gt('created_at', lastAIResponseData[0].created_at);
  }
  
  const { data: newMessages, error: messagesError } = await newMessagesQuery.order('created_at', { ascending: true });

  if (messagesError) {
    console.error("Error fetching new messages:", messagesError);
    return;
  }
  
  if (!newMessages || newMessages.length === 0) {
    console.log("No new user messages to process since last AI response.");
    return;
  }
  
  console.log(`Found ${newMessages.length} new messages to process`);
  const combinedMessage = newMessages.map((m: { content?: string | null; [key: string]: unknown }) => m.content || '').filter(Boolean).join('\n');

  // Final check before generating response - only skip if another worker already responded
  const oldestNewMessage = newMessages[0].created_at;
  const { data: finalCheck } = await supabase
    .from('communications')
    .select('id, created_at')
    .eq('lead_id', lead.id)
    .eq('organization_id', org?.id)
    .eq('channel', platform)
    .eq('direction', 'outbound')
    .gt('created_at', oldestNewMessage)
    .limit(1);
  
  if (finalCheck && finalCheck.length > 0) {
    console.log("Another worker already responded to these messages. Halting to prevent duplicate.");
    return;
  }

  // ============= CRITICAL: FRESH AI SAFETY CHECK BEFORE GENERATION =============
  // Re-fetch lead's is_ai_managed status RIGHT BEFORE generating AI response
  // This prevents race conditions where agent clicks "Stop AI" after debounce started
  const { data: freshLead, error: freshLeadError } = await supabase
    .from('leads')
    .select('is_ai_managed')
    .eq('id', lead.id)
    .single();
  
  if (freshLeadError) {
    console.error(`[AI Safety] Failed to re-check lead status: ${freshLeadError.message}`);
    // Fail safe: don't generate response if we can't verify status
    processingLeads.delete(lockKey);
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    return;
  }
  
  if (!freshLead?.is_ai_managed) {
    console.log(`[AI Safety] Lead ${lead.id} AI was disabled during debounce window. Aborting AI response.`);
    processingLeads.delete(lockKey);
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    return;
  }

  // Generate AI response
  const history = await getConversationHistory(lead.id, org?.id, platform);
  const knowledgeBase = await getKnowledgeBase(org?.id);
  const agentType = org?.ai_agent_type || 'jay';

  const orgSettings = {
    name: org?.name,
    allowed_languages: org?.allowed_languages || ['en'],
    language_lock_enabled: org?.language_lock_enabled ?? true,
    sales_process_config: org?.sales_process_config,
  };
  
  // ============= IMAGE URL VALIDATION =============
  // Filter and validate image URLs before passing to AI
  const validatedImageUrls = validateImageUrls(messageData.imageUrls);
  if (messageData.imageUrls && messageData.imageUrls.length > validatedImageUrls.length) {
    console.warn(`[ImageValidation] Filtered ${messageData.imageUrls.length - validatedImageUrls.length} invalid image URLs`);
  }
  
  console.log(`Generating AI response for lead ${lead.id} with agent ${agentType}${validatedImageUrls.length > 0 ? ` (${validatedImageUrls.length} images)` : ''}`);
  
  // ============= AVAILABILITY & BOOKING CONFIRMATION GUARDRAILS =============
  // For Cece (accommodation agent), intercept availability questions and booking confirmations
  let aiResponse: string;
  let liveAvailability: RoomAvailability[] | null = null;
  let usedGuardrail = false;
  let parsedDateRange: DateRange | null = null;
  const configuredOpeningMessage = getConfiguredOpeningMessage(org);
  const hasPriorAssistantHistory = history.some((entry) => entry.role === 'assistant');

  if (!hasPriorAssistantHistory && detectQueryType(combinedMessage) === 'greeting' && configuredOpeningMessage) {
    console.log('[Guardrail] Using configured opening message for first-contact greeting');
    aiResponse = configuredOpeningMessage;
    usedGuardrail = true;
  }
  
  // Convert history to format needed for context-aware parsing
  // Ensure content is always a string (handle multimodal content arrays)
  const getTextContentFromHistory = (content: string | Array<{ type: string; text?: string }> | null | undefined): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text)
        .join(' ');
    }
    return '';
  };
  const historyForParsing = history.map(m => ({ role: m.role, content: getTextContentFromHistory(m.content) }));
  
  // ============= ENHANCED BOOKING INTENT DETECTION =============
  // Step 1: Check if we're in a booking flow context (quote sent, availability shown, etc.)
  const bookingFlowContext = agentType === 'cece' 
    ? isInBookingFlowContext(historyForParsing)
    : { inFlow: false };
  
  // Step 2: Determine if user wants to proceed with booking
  let confirmationContext: BookingConfirmationContext = { isConfirmation: false };
  
  if (!usedGuardrail && bookingFlowContext.inFlow) {
    console.log('[Booking Flow] Detected active booking context:', JSON.stringify(bookingFlowContext));
    
    // Fast path: obvious confirmation patterns OR booking intent (payment, providing name, etc.)
    if (looksLikeBookingConfirmation(combinedMessage) || looksLikeBookingIntent(combinedMessage)) {
      console.log('[Booking Flow] Fast path - booking intent detected');
      
      // Try to get date range from conversation history if not in current message
      let dateRange = tryParseDateRangeFromConversation(combinedMessage, historyForParsing);
      
      // If no date in current message, try to parse from the bookingFlowContext.dateRange string
      if (!dateRange && bookingFlowContext.dateRange) {
        dateRange = parseDateRangeFromString(bookingFlowContext.dateRange);
      }
      
      confirmationContext = {
        isConfirmation: true,
        roomName: bookingFlowContext.roomName,
        dateRange: dateRange || undefined,
        guestCount: bookingFlowContext.guestCount,
      };
    } else {
      // Slow path: Use AI to understand intent when message is truly ambiguous
      // Only use this for Cece (accommodation agent) and when OPENAI_API_KEY is available
      const openAIKey = Deno.env.get('OPENAI_API_KEY');
      if (openAIKey) {
        console.log('[Booking Flow] Using AI to analyze booking intent...');
        const intentResult = await detectBookingIntentWithAI(combinedMessage, historyForParsing, openAIKey);
        console.log('[Booking Flow] AI intent result:', JSON.stringify(intentResult));
        
        if (intentResult.wantsToBook && intentResult.confidence !== 'low') {
          let dateRange = tryParseDateRangeFromConversation(combinedMessage, historyForParsing);
          if (!dateRange && bookingFlowContext.dateRange) {
            dateRange = parseDateRangeFromString(bookingFlowContext.dateRange);
          }
          
          confirmationContext = {
            isConfirmation: true,
            roomName: bookingFlowContext.roomName,
            dateRange: dateRange || undefined,
            guestCount: bookingFlowContext.guestCount,
          };
        } else if (intentResult.needsClarification && intentResult.clarificationQuestion) {
          console.log('[Booking Flow] AI suggests clarification needed, letting main AI handle naturally');
        }
      } else {
        // Fallback without OpenAI: if we're in booking flow and user sends any positive signal, create booking
        console.log('[Booking Flow] No OpenAI key, using heuristic fallback');
        const positiveSignal = !/^(no|nope|nevermind|cancel|hindi|ayaw)/i.test(combinedMessage.trim());
        if (positiveSignal && bookingFlowContext.quoteSent) {
          console.log('[Booking Flow] Quote was sent and user is engaging - treating as booking intent');
          let dateRange = tryParseDateRangeFromConversation(combinedMessage, historyForParsing);
          if (!dateRange && bookingFlowContext.dateRange) {
            dateRange = parseDateRangeFromString(bookingFlowContext.dateRange);
          }
          
          confirmationContext = {
            isConfirmation: true,
            roomName: bookingFlowContext.roomName,
            dateRange: dateRange || undefined,
            guestCount: bookingFlowContext.guestCount,
          };
        }
      }
    }
  } else {
    // Legacy check: original pattern matching for when not obviously in flow
    const legacyConfirmation = detectBookingConfirmationFlow(combinedMessage, historyForParsing);
    if (legacyConfirmation.isConfirmation) {
      confirmationContext = legacyConfirmation;
    }
  }
  
  if (confirmationContext.isConfirmation) {
    console.log('[Guardrail] Detected booking confirmation, creating pending booking...');
    
    // Build a helpful booking progression response
    const _roomInfo = confirmationContext.roomName ? ` for ${confirmationContext.roomName}` : '';
    const _dateInfo = confirmationContext.dateRange 
      ? ` (${formatDateForDisplay(confirmationContext.dateRange.start)} to ${formatDateForDisplay(confirmationContext.dateRange.end)})`
      : '';
    const _guestInfo = confirmationContext.guestCount ? ` for ${confirmationContext.guestCount} guest${confirmationContext.guestCount > 1 ? 's' : ''}` : '';
    
    // Create pending booking if we have enough info (need at least dates)
    const dateRangeForBooking = confirmationContext.dateRange || tryParseDateRangeFromConversation(combinedMessage, historyForParsing);
    
    if (dateRangeForBooking) {
      try {
        // Find the room to book (use first available or mentioned room)
        let roomToBook: { id: string; name: string } | null = null;
        
        // Try to find the mentioned room
        if (confirmationContext.roomName) {
          // Clean up room name for search
          const cleanRoomName = confirmationContext.roomName
            .replace(/^THE\s+/i, '')
            .replace(/\s+-\s+/g, ' ')
            .trim();
          
          const { data: matchedRoom } = await supabase
            .from('room_units')
            .select('id, name')
            .eq('organization_id', org?.id)
            .or(`name.ilike.%${cleanRoomName}%,name.ilike.%${confirmationContext.roomName}%`)
            .eq('is_active', true)
            .limit(1)
            .single();
          if (matchedRoom) roomToBook = matchedRoom;
        }
        
        // If no room found by name, query availability and use first available
        if (!roomToBook) {
          const availableRooms = await queryLiveAvailability(org?.id, dateRangeForBooking);
          const firstAvailable = availableRooms.find(r => r.isAvailable);
          if (firstAvailable) {
            roomToBook = { id: firstAvailable.roomId, name: firstAvailable.roomName };
          }
        }
        
        if (roomToBook) {
          // CRITICAL: Check for conflicts with CONFIRMED/CHECKED_IN bookings before creating
          const { data: conflictingBookings } = await supabase
            .from('bookings')
            .select('id, status, check_in, check_out, lead:leads(name)')
            .eq('room_unit_id', roomToBook.id)
            .in('status', ['confirmed', 'upcoming', 'checked_in'])
            .lt('check_in', dateRangeForBooking.end)
            .gt('check_out', dateRangeForBooking.start);
          
          if (conflictingBookings && conflictingBookings.length > 0) {
            // Found a conflict! Don't create booking, suggest alternatives instead
            const conflict = conflictingBookings[0];
            console.log(`[Guardrail] CONFLICT DETECTED: ${roomToBook.name} is booked from ${conflict.check_in} to ${conflict.check_out} (${conflict.status})`);
            
            // Query for alternative available rooms
            const alternativeRooms = await queryLiveAvailability(org?.id, dateRangeForBooking);
            const availableAlternatives = alternativeRooms.filter(r => r.isAvailable);
            
            let conflictMessage = `⚠️ I apologize, but ${roomToBook.name} is not available for ${formatDateForDisplay(dateRangeForBooking.start)} to ${formatDateForDisplay(dateRangeForBooking.end)}. We have a confirmed booking from ${formatDateForDisplay(conflict.check_in)} to ${formatDateForDisplay(conflict.check_out)}.`;
            
            if (availableAlternatives.length > 0) {
              conflictMessage += `\n\nHowever, I have great news! These rooms ARE available for your dates:\n`;
              availableAlternatives.slice(0, 3).forEach(alt => {
                conflictMessage += `✅ ${alt.roomName}\n`;
              });
              conflictMessage += `\nWould you like me to book one of these instead?`;
            } else {
              // No alternatives for these dates, suggest different dates
              conflictMessage += `\n\nUnfortunately, all our rooms are booked for those dates. Would you like me to check availability for different dates? ${roomToBook.name} is available after ${formatDateForDisplay(conflict.check_out)}.`;
            }
            
            // Set the conflict message as AI response and skip to the end
            console.log(`[Guardrail] Returning conflict message to guest, NOT creating booking`);
            aiResponse = conflictMessage;
            usedGuardrail = true;
          } else {
            // No conflict - proceed with booking creation
            // Check if a pending booking already exists for this lead/room/dates
            const { data: existingBooking } = await supabase
              .from('bookings')
              .select('id')
              .eq('lead_id', lead.id)
              .eq('room_unit_id', roomToBook.id)
              .eq('check_in', dateRangeForBooking.start)
              .eq('check_out', dateRangeForBooking.end)
              .in('status', ['pending', 'confirmed', 'upcoming'])
              .limit(1);
            
            if (existingBooking && existingBooking.length > 0) {
              console.log(`[Guardrail] Booking already exists (${existingBooking[0].id}), skipping creation`);
            } else {
              // Create pending booking
              const { data: newBooking, error: bookingError } = await supabase
                .from('bookings')
                .insert({
                  organization_id: org?.id,
                  lead_id: lead.id,
                  room_unit_id: roomToBook.id,
                  check_in: dateRangeForBooking.start,
                  check_out: dateRangeForBooking.end,
                  guest_count: confirmationContext.guestCount || 1,
                  status: 'pending',
                  booking_source: platform,
                  notes: `Auto-created by Cece AI via ${platform}. Guest confirmed interest.`
                })
                .select('id')
                .single();
            
            if (bookingError) {
              console.error('[Guardrail] Failed to create pending booking:', bookingError);
            } else {
              console.log(`[Guardrail] Created pending booking ${newBooking.id} for lead ${lead.id}`);
              
              // Create notification for the team - MANDATORY for Cece orgs
              const { data: orgMembers } = await supabase
                .from('profiles')
                .select('id, email, full_name')
                .eq('organization_id', org?.id)
                .eq('is_active', true);
              
              if (orgMembers && orgMembers.length > 0) {
                const title = 'New Pending Booking';
                const message = `${lead.name} confirmed interest in ${roomToBook!.name} for ${formatDateForDisplay(dateRangeForBooking.start)} to ${formatDateForDisplay(dateRangeForBooking.end)}. Please review and confirm.`;
                
                // In-app notifications for all org members
                const notifications = orgMembers.map(member => ({
                  user_id: member.id,
                  organization_id: org?.id,
                  type: 'booking',
                  title,
                  message,
                  related_id: newBooking.id,
                  channel: 'in_app'
                }));
                
                await supabase.from('notification_history').insert(notifications);
                console.log(`[Guardrail] Sent in-app notifications to ${orgMembers.length} team members`);
                
                // Email notifications - MANDATORY for Cece orgs (non-negotiable)
                const emailRecipients = orgMembers
                  .filter((m: { email?: string }) => m.email)
                  .map((m: { email?: string }) => m.email);
                
                if (emailRecipients.length > 0) {
                  for (const email of emailRecipients) {
                    try {
                      await supabase.functions.invoke('send-email', {
                        body: {
                          to: email,
                          subject: `[Action Required] ${title}`,
                          html: `
                            <h2>New Pending Booking Requires Confirmation</h2>
                            <p><strong>Guest:</strong> ${lead.name}</p>
                            <p><strong>Room:</strong> ${roomToBook!.name}</p>
                            <p><strong>Check-in:</strong> ${formatDateForDisplay(dateRangeForBooking.start)}</p>
                            <p><strong>Check-out:</strong> ${formatDateForDisplay(dateRangeForBooking.end)}</p>
                            <p><strong>Source:</strong> ${platform}</p>
                            <p style="margin-top: 20px;"><strong>⚠️ This booking is pending and requires your confirmation.</strong></p>
                            <p>Please log in to review and confirm this booking to block the dates.</p>
                          `
                        }
                      });
                      console.log(`[Guardrail] Sent email notification to ${email}`);
                    } catch (emailError) {
                      console.error(`[Guardrail] Error sending email to ${email}:`, emailError);
                    }
                  }
                }
              }
            }
          }
        }
      }
      } catch (bookingErr) {
        console.error('[Guardrail] Error creating pending booking:', bookingErr);
      }
    } else {
      console.log('[Guardrail] Could not determine date range, skipping booking creation');
    }
    
    // Only generate AI response if we didn't already set a conflict message
    if (!usedGuardrail) {
      // DON'T hardcode response - let the AI generate naturally using KB
      // This allows the AI to adapt to the conversation context and KB instructions
      console.log('[Guardrail] Booking intent confirmed, letting AI generate contextual response with KB');
      aiResponse = await generateAIResponse(agentType, combinedMessage, history, knowledgeBase, validatedImageUrls, orgSettings);
    }
    
  } else if (!usedGuardrail && agentType === 'cece' && looksLikePhotoRequest(combinedMessage)) {
    console.log('[Guardrail] Detected photo request, checking KB compliance layer first...');
    
    // FIRST: Check if KB has specific photo-related instructions (e.g., "share landing page")
    const kbMatch = findMatchingKBInstruction(combinedMessage, knowledgeBase, {
      configuredOpeningMessage: getConfiguredOpeningMessage(org),
    });
    
    if (kbMatch.found && kbMatch.response) {
      console.log(`[KB Compliance] Using KB-defined response for photo request: ${kbMatch.instruction}`);
      aiResponse = kbMatch.response;
      usedGuardrail = true;
      
      // Log for monitoring
      await logKBComplianceEvent(org?.id, lead.id, combinedMessage, kbMatch.instruction || 'photo_kb_instruction', aiResponse);
    } else {
      // SECOND: Try to find matching room photos directly
      const matchedRooms = await getRoomUnitPhotoUrlsForMessage(org?.id, combinedMessage);
      
      if (matchedRooms.length > 0) {
        const room = matchedRooms[0];
        // Get all images from the room (from image_urls array if available)
        const allRoomImages = room.image_urls && room.image_urls.length > 0 
          ? room.image_urls 
          : [room.image_url];
        // Cap images to 3 to avoid flooding messaging platforms
        const imageUrls = allRoomImages.slice(0, 3);

        aiResponse = `Sure po! Here's ${imageUrls.length > 1 ? 'photos' : 'a photo'} for ${room.name}. ${imageUrls.map(u => `[IMAGE: ${u}]`).join(' ')}`;
        usedGuardrail = true;
        console.log(`[Guardrail] Sending ${imageUrls.length} photo(s) for: ${room.name}`);
      } else {
        console.log('[Guardrail] No matching room images found; falling back to AI (with KB compliance rules)');
        aiResponse = await generateAIResponse(agentType, combinedMessage, history, knowledgeBase, validatedImageUrls, orgSettings);
      }
    }

  } else if (!usedGuardrail && agentType === 'cece' && looksLikeAvailabilityInquiryWithContext(combinedMessage, historyForParsing)) {
    console.log('[Guardrail] Detected availability inquiry (with context), analyzing date information...');
    
    // Use enhanced parsing to get detailed info about what was parsed
    const parseResult = parseWithDetails(combinedMessage, historyForParsing);
    console.log(`[Guardrail] Date parse result: type=${parseResult.type}`);
    
    if (parseResult.type === 'complete' && parseResult.dateRange) {
      // ✅ BOTH dates provided - query live availability
      parsedDateRange = parseResult.dateRange;
      console.log(`[Guardrail] Complete date range: ${parsedDateRange.start} to ${parsedDateRange.end}`);
      liveAvailability = await queryLiveAvailability(org?.id, parsedDateRange);
      
      if (liveAvailability.length > 0) {
        aiResponse = buildAvailabilityReply(parsedDateRange, liveAvailability);
        usedGuardrail = true;
        console.log('[Guardrail] Using authoritative availability response');
      } else {
        aiResponse = await generateAIResponse(agentType, combinedMessage, history, knowledgeBase, validatedImageUrls, orgSettings);
      }
    } else if (parseResult.type === 'relative' || parseResult.type === 'single_date') {
      // If the user is answering a check-out question, treat a single date as a check-out date
      // and combine it with the last known check-in date from recent context.
      if (
        parseResult.type === 'single_date' &&
        parseResult.singleDate &&
        lastAssistantAskedForCheckout(historyForParsing)
      ) {
        const contextHistory = historyForParsing.slice(0, -1); // exclude current user message
        const contextParse = parseWithDetails('', contextHistory);

        const checkInDate =
          (contextParse.type === 'complete' && contextParse.dateRange?.start
            ? contextParse.dateRange.start
            : null) ||
          (contextParse.type === 'single_date' && contextParse.singleDate
            ? contextParse.singleDate
            : null);

        if (checkInDate) {
          const start = checkInDate;
          const end = parseResult.singleDate;

          if (end > start) {
            parsedDateRange = { start, end };
            console.log(
              `[Guardrail] Treating single date as check-out reply. Derived range: ${start} to ${end}`
            );

            liveAvailability = await queryLiveAvailability(org?.id, parsedDateRange);

            if (liveAvailability.length > 0) {
              aiResponse = buildAvailabilityReply(parsedDateRange, liveAvailability);
              usedGuardrail = true;
              console.log('[Guardrail] Using authoritative availability response (derived range)');
            } else {
              aiResponse = await generateAIResponse(
                agentType,
                combinedMessage,
                history,
                knowledgeBase,
                validatedImageUrls,
                orgSettings
              );
            }
          }
        }
      }

      if (!usedGuardrail) {
        // ⚠️ Incomplete date info - ask for clarification instead of guessing/hallucinating
        aiResponse = buildDateClarificationQuestion(parseResult);
        usedGuardrail = true;
        console.log(`[Guardrail] Asking for date clarification: ${parseResult.type}`);
      }
    } else {
      // No date info at all - let AI ask naturally
      aiResponse = await generateAIResponse(agentType, combinedMessage, history, knowledgeBase, validatedImageUrls, orgSettings);
    }
  } else {
    // Not an availability inquiry or booking confirmation or not Cece, use normal AI response
    aiResponse = await generateAIResponse(agentType, combinedMessage, history, knowledgeBase, validatedImageUrls, orgSettings);
  }
  
  const { actions, cleanText: cleanAiResponse } = prepareAIResponseForDelivery(aiResponse);

  // Calculate human-like delay based on response length
  const baseDelay = MIN_RESPONSE_DELAY_MS + Math.random() * (MAX_RESPONSE_DELAY_MS - MIN_RESPONSE_DELAY_MS);
  const typingDelay = Math.min((cleanAiResponse.length / CHARS_PER_SECOND) * 1000, 5000);
  const totalDelay = Math.round(baseDelay + typingDelay * 0.5);
  
  console.log(`Adding human-like delay of ${totalDelay}ms before sending response (${cleanAiResponse.length} chars)`);
  await new Promise(resolve => setTimeout(resolve, totalDelay));
  
  // Check one more time before sending - prevent race condition at send time
  const preSendCheck = await supabase
    .from('communications')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('organization_id', org?.id)
    .eq('channel', platform)
    .eq('direction', 'outbound')
    .gte('created_at', new Date(Date.now() - 5000).toISOString())
    .limit(1);
  
  if (preSendCheck.data && preSendCheck.data.length > 0) {
    console.log("Another worker sent a response while we were generating. Aborting send.");
    // Clean up locks
    processingLeads.delete(lockKey);
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    return;
  }
  
  const sentMessageId = await sendPlatformResponse(platform, senderId, cleanAiResponse, accessToken, pageId);
  // If send failed, persist failure and notify, then release locks
  if (!sentMessageId) {
    console.error('Failed to send AI response to platform');
    try {
      await supabase.from('communications').insert({
        organization_id: org?.id,
        lead_id: lead.id,
        channel: platform,
        direction: 'outbound',
        role: 'assistant',
        content: cleanAiResponse,
        status: 'failed',
        metadata: {
          is_ai_response: true,
          ai_send_status: 'failed',
          sender_id: messageData.senderId,
          platform,
          page_id: messageData.pageId,
        },
      });

      await supabase.from('notification_history').insert({
        user_id: null,
        organization_id: org?.id,
        type: 'ai_failure',
        title: 'AI message failed to send',
        message: `Failed to deliver AI reply for lead ${lead.id} via ${platform}`,
        related_id: lead.id,
        channel: 'in_app'
      });
    } catch (e) {
      console.error('Failed to persist failed AI message or notify team:', e);
    }

    // Release locks
    processingLeads.delete(lockKey);
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    return;
  }
  
  if (sentMessageId) {
    // Save AI response to communications with external_id for delivery/read tracking
    const { error: saveError } = await supabase.from('communications').insert({
      organization_id: org?.id,
      lead_id: lead.id,
      channel: platform,
      direction: 'outbound',
      role: 'assistant',
      content: cleanAiResponse,
      status: 'sent',
      external_id: sentMessageId !== 'sent' ? sentMessageId : null,
      metadata: {
        sender_id: messageData.senderId,
        platform: platform,
        page_id: messageData.pageId,
        conversation_id: conversation.id,
        is_ai_response: true,
        used_availability_guardrail: usedGuardrail
      }
    });
    if (saveError) {
      console.error('Error saving AI response:', saveError);
    }
    await supabase.from('leads').update({ last_ai_response_at: new Date().toISOString() }).eq('id', lead.id);
    
    // ============= LEAD STATUS UPDATE - DETERMINISTIC AI ACTIONS =============
    // Parse and apply any [ACTION] blocks from the AI response to update lead status
    // This ensures lead status is reliably updated based on AI intent detection
    try {
      if (actions) {
        console.log(`[AI Actions] Detected actions in AI response:`, JSON.stringify(actions));
        // deno-lint-ignore no-explicit-any
        const actionResult = await applyPreparedAIResponseActions(supabase as any, String(lead.id), actions, 'social-webhook');
        if (actionResult.applied) {
          console.log(`[AI Actions] Successfully applied lead status update for lead ${lead.id}`);
        } else {
          console.log(`[AI Actions] Action not applied: ${actionResult.details}`);
        }
      }
    } catch (actionError) {
      console.warn('[AI Actions] Failed to parse or apply AI actions:', actionError);
      // Non-fatal - continue with normal flow
    }
    
    console.log("Successfully processed message(s) and sent AI reply.");
    // Release locks
    processingLeads.delete(lockKey);
    // deno-lint-ignore no-explicit-any
    await releaseProcessingLock(supabase as any, String(lead.id), platform);
    
    // ============= SELF-CORRECTION MECHANISM =============
    // If AI was used (not guardrail) and this looks like availability, verify and correct if needed
    if (!usedGuardrail && agentType === 'cece' && looksLikeAvailabilityInquiryWithContext(combinedMessage, historyForParsing)) {
      const dateRangeForCorrection = parsedDateRange || tryParseDateRangeFromConversation(combinedMessage, historyForParsing);
      if (dateRangeForCorrection) {
        // Query live data to verify AI's claims
        const verifyAvailability = liveAvailability || await queryLiveAvailability(org?.id, dateRangeForCorrection);
        
        if (verifyAvailability.length > 0) {
          // Log any contradictions for monitoring
          const roomNames = verifyAvailability.map(r => r.roomName);
          await logAvailabilityContradiction(org?.id, lead.id, aiResponse, verifyAvailability, roomNames);
          
          // Check if self-correction is needed
          const correctionMessage = buildCorrectionMessage(aiResponse, verifyAvailability);
          
          if (correctionMessage) {
            console.log('[Self-Correction] AI made false availability claim, sending correction...');
            
            // Small delay before correction (1-2 seconds to seem natural)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const correctionMessageId = await sendPlatformResponse(
              platform, senderId, correctionMessage, accessToken, pageId
            );
            
            if (correctionMessageId) {
              await supabase.from('communications').insert({
                organization_id: org?.id,
                lead_id: lead.id,
                channel: platform,
                direction: 'outbound',
                role: 'assistant',
                content: correctionMessage,
                status: 'sent',
                external_id: correctionMessageId !== 'sent' ? correctionMessageId : null,
                metadata: {
                  sender_id: senderId,
                  platform: platform,
                  page_id: messageData.pageId,
                  conversation_id: conversation.id,
                  is_ai_response: true,
                  is_self_correction: true,
                  original_response: aiResponse.slice(0, 200)
                }
              });
              console.log('[Self-Correction] Correction message sent successfully');
            }
          }
        }
      }
    }
  } else {
    console.error("Failed to send AI response to platform");
  }
}
