# Photo/Document Sending Implementation - Complete Summary

## ✅ Implementation Complete

All AI agents (Jay, May, Cece) and human agents now send **actual photos and documents** as attachments, not just text URLs, when communicating with leads via Facebook Messenger, Instagram DMs, and WhatsApp.

## 🎯 What Was Done

### 1. **Multiple Photo Upload Feature** (Previously Completed)
- Added `image_urls` array column to `offerings` table (May/Jay organizations)
- Added `image_urls` array column to `knowledge_base_entries` table (all organizations)
- Updated UI components to use `MultiImageUpload` for up to 10 photos per item
- Room units (Cece) already had this feature

### 2. **AI Instructions Update** ✅
Updated [_shared/ai-utils.ts](_shared/ai-utils.ts#L145-L157) to clarify:
- Use `[IMAGE: url]` format (not `IMAGE_URL`)
- System automatically sends these as actual photo attachments
- Support for multiple images: `[IMAGE: url1] [IMAGE: url2] [IMAGE: url3]`
- Added explicit note: "The system will automatically send these as actual image attachments, not just text links"

### 3. **Knowledge Base Integration** ✅
Updated [social-webhook/index.ts](social-webhook/index.ts#L1478-L1545):
- Query now includes both `image_url` and `image_urls` columns
- For menu items, offerings, and knowledge base entries
- For room units (accommodations)
- All images formatted as `[IMAGE: url]` or `[IMAGE 1: url] [IMAGE 2: url]`

### 4. **AI Chat Function Updates** ✅
Updated [ai-chat/index.ts](ai-chat/index.ts#L429-L590):
- `getOfferings()` function now shows all images from `image_urls` array
- `getMenuItems()` function now shows all images from `image_urls` array
- Format: `[IMAGE 1: url] [IMAGE 2: url]` for items with multiple photos

### 5. **Photo Guardrail Enhancement** ✅
Updated photo request handling in [social-webhook/index.ts](social-webhook/index.ts#L2519-L2540):
- `getRoomUnitPhotoUrlsForMessage()` now queries `image_urls` array
- Returns all available photos (up to 3 per room to avoid platform limits)
- Sends multiple photos when available: "Here's photos for [Room Name]"

## 🔄 How It Works

### For AI Responses:
1. **AI receives knowledge base** with images marked as:
   ```
   Deluxe Suite - ₱5,000/night
   📷 Images: [IMAGE 1: https://...jpg] [IMAGE 2: https://...jpg] [IMAGE 3: https://...jpg]
   ```

2. **AI includes images in response** using the format:
   ```
   "Here are photos of our Deluxe Suite! [IMAGE: url1] [IMAGE: url2]"
   ```

3. **System extracts and sends** actual attachments:
   - Text: "Here are photos of our Deluxe Suite!"
   - Attachment 1: (actual image file)
   - Attachment 2: (actual image file)

### For Agent Messages:
- Agents can include `[IMAGE: url]` or `[FILE: url|filename]` in messages
- System automatically sends them as actual attachments via Facebook/Instagram/WhatsApp APIs
- See [send-social-message/index.ts](send-social-message/index.ts#L106-L320)

## 📱 Platform Support

### ✅ Facebook Messenger
- Images: Sent as `type: 'image', payload: { url, is_reusable: true }`
- Documents: Sent as `type: 'file', payload: { url, is_reusable: true }`

### ✅ Instagram DMs
- Images: Same format as Messenger
- Documents: Same format as Messenger

### ✅ WhatsApp
- Images: Sent as `type: 'image', image: { link: url }`
- Documents: Sent as `type: 'document', document: { link: url, filename }`

## 🧪 Testing Scenarios

### Test Case 1: Menu Item with Multiple Photos
1. Client uploads 3 photos to a menu item "Adobo Special"
2. Customer messages: "Show me the adobo"
3. **Expected:** AI sends all 3 photos as actual image attachments

### Test Case 2: Room with Photo Gallery
1. Accommodation has room with 5 photos
2. Guest asks: "Can I see photos of the deluxe room?"
3. **Expected:** AI sends 3 photos (platform limit) as actual image attachments

### Test Case 3: Offering with Single Photo
1. Jay organization has service offering with 1 photo
2. Lead asks: "What does the premium package include?"
3. **Expected:** AI describes package and sends 1 photo as actual attachment

### Test Case 4: Agent Sending Document
1. Agent types message with: "Here's the contract [FILE: https://...pdf|Contract.pdf]"
2. **Expected:** Lead receives text + actual PDF file attachment

## 🔍 Code Verification

**Image Format Parser** (social-webhook/index.ts#L3795-L3820):
```typescript
const markerRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
while ((markerMatch = markerRegex.exec(rawMessage)) !== null) {
  imageUrls.push(markerMatch[1]); // Extract URL
}
// Remove markers from text so only actual attachments are sent
text = rawMessage.replace(markerRegex, '').trim();
```

**Attachment Sending** (social-webhook/index.ts#L3883-L3930):
```typescript
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
    : { /* Instagram/WhatsApp formats */ };
  
  await sendRaw(attachmentBody);
}
```

## 📋 Migration Required

Deploy these migrations:
```bash
supabase db push
```

Migrations include:
- `20260117200000_add_image_urls_to_offerings.sql`
- `20260117200001_add_image_urls_to_knowledge_base.sql`

## ✨ Key Features

1. **Backward Compatible**: Old single `image_url` fields still work
2. **Multi-Photo Support**: Up to 10 photos per item in UI, up to 3 sent per message
3. **Platform Limits**: Automatically caps at 3 photos to avoid messaging platform rate limits
4. **All Organizations**: Works for Jay (offerings), May (menu items), and Cece (room units)
5. **Knowledge Base**: Also works for custom knowledge base entries with photos

## 🎨 User Experience

**Before:** 
- AI would say "Here's the link: https://storage.supabase.co/..." 
- Lead had to click link

**After:**
- AI says "Here are photos of our Deluxe Suite!"
- Lead immediately sees 2-3 actual photo attachments in chat
- Much better engagement and user experience

## ❓ Questions Addressed

### Q: "Will it work for all organizations?"
✅ **Yes** - Jay, May, and Cece all use the same image sending infrastructure

### Q: "What about agents sending photos?"
✅ **Yes** - Human agents can also send photos using `[IMAGE: url]` format in ChatLogs

### Q: "Does it work for documents too?"
✅ **Yes** - Use `[FILE: url|filename.pdf]` format for PDFs, Word docs, etc.

### Q: "What if there are too many photos?"
✅ **Handled** - System caps at 3 photos per message to avoid platform issues

## 🚀 No Further Action Needed

The system is now fully configured to send actual photos and documents as attachments regardless of:
- Organization type (Jay, May, Cece)
- Sender type (AI agent or human agent)
- Platform (Messenger, Instagram, WhatsApp)

All changes are backward compatible and automatically migrate existing single images to arrays.
