type ConversationStatus = 'active' | 'ended' | 'archived' | undefined;
type MessageDirection = 'inbound' | 'outbound' | undefined;

interface PreviewSource {
  content?: string | null;
  direction?: MessageDirection | null;
  metadata?: Record<string, unknown> | null;
}

interface ConversationVisibilityState {
  conversationStatus?: ConversationStatus;
  unread: number;
  lastMessageDirection?: MessageDirection | null;
}

const fileMarkerRegex = /\[FILE:(https?:\/\/[^\]|]+)\|([^\]]+)\]/gi;
const imageMarkerRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;

function countAttachmentArtifacts(content: string, metadata?: Record<string, unknown> | null): { files: number; images: number } {
  let files = 0;
  let images = 0;

  for (const _match of content.matchAll(fileMarkerRegex)) {
    files += 1;
  }

  for (const _match of content.matchAll(imageMarkerRegex)) {
    images += 1;
  }

  if (Array.isArray(metadata?.image_urls)) {
    images += metadata.image_urls.length;
  }

  return { files, images };
}

function stripAttachmentArtifacts(content: string): string {
  return content
    .replace(fileMarkerRegex, ' ')
    .replace(imageMarkerRegex, ' ')
    .replace(/\[?\s*image\s*sent\s*\]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSystemPreview(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;

  const eventType = typeof metadata.event_type === 'string' ? metadata.event_type : null;
  const messageType = typeof metadata.message_type === 'string' ? metadata.message_type : null;

  if (eventType === 'agent_takeover') return 'Agent took over the conversation';
  if (eventType === 'agent_handback') return 'Conversation handed back to AI';
  if (eventType === 'booking_linked') return 'Conversation linked to a booking';
  if (eventType === 'booking_unlinked') return 'Conversation unlinked from a booking';

  if (messageType === 'system') return 'System update';
  if (messageType === 'image') return 'Image';
  if (messageType === 'file') return 'Attachment';

  return null;
}

export function getConversationPreview(source: PreviewSource): string {
  const content = source.content?.trim() || '';
  const metadata = source.metadata || null;
  const cleanedContent = stripAttachmentArtifacts(content);
  if (cleanedContent) {
    return cleanedContent;
  }

  const systemPreview = getSystemPreview(metadata);
  if (systemPreview) {
    return systemPreview;
  }

  const { files, images } = countAttachmentArtifacts(content, metadata);
  const totalAttachments = files + images;
  if (totalAttachments > 0) {
    const prefix = source.direction === 'outbound' ? 'Sent' : 'Received';
    if (images > 0 && files === 0) {
      return `${prefix} ${images === 1 ? 'an image' : `${images} images`}`;
    }
    if (files > 0 && images === 0) {
      return `${prefix} ${files === 1 ? 'an attachment' : `${files} attachments`}`;
    }
    return `${prefix} ${totalAttachments} attachments`;
  }

  return 'No message content';
}

export function isArchivedConversationResurfaced(state: ConversationVisibilityState): boolean {
  return state.conversationStatus === 'archived' && state.unread > 0 && state.lastMessageDirection === 'inbound';
}

export function shouldDisplayConversationInActiveInbox(state: ConversationVisibilityState): boolean {
  return state.conversationStatus !== 'archived' || isArchivedConversationResurfaced(state);
}