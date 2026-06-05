# Email Integration Feature - Complete Documentation

## Overview
The Email Integration feature allows users to connect their own email accounts to communicate with leads directly through the platform. This enables seamless email communication without leaving the CRM.

## Features Added

### 1. **Email Integration Configuration** (Settings → Integrations Tab)
- **Location**: Settings page → Integrations tab
- **Access**: Client Admins and Super Admins only
- **Platform Type**: Email (stored in `social_platforms` table)

### 2. **Configuration Fields**
When adding an email integration, users need to provide:
- **Email Address**: The email address to send from
- **SMTP Host**: SMTP server hostname (e.g., smtp.gmail.com)
- **SMTP Port**: SMTP server port (e.g., 587 for TLS)
- **SMTP Username**: Usually the email address
- **SMTP Password**: App-specific password or regular password
- **IMAP Host** (Optional): For receiving emails in the future
- **IMAP Port** (Optional): IMAP server port (e.g., 993)

### 3. **Common Email Provider Settings**

#### Gmail
- **SMTP Host**: smtp.gmail.com
- **SMTP Port**: 587
- **IMAP Host**: imap.gmail.com
- **IMAP Port**: 993
- **Note**: Requires an app-specific password (not your regular Gmail password)
  - Go to: Google Account → Security → 2-Step Verification → App passwords
  - Generate a new app password for "Mail"

#### Outlook/Office 365
- **SMTP Host**: smtp-mail.outlook.com (or smtp.office365.com)
- **SMTP Port**: 587
- **IMAP Host**: outlook.office365.com
- **IMAP Port**: 993

#### Yahoo Mail
- **SMTP Host**: smtp.mail.yahoo.com
- **SMTP Port**: 587
- **IMAP Host**: imap.mail.yahoo.com
- **IMAP Port**: 993

### 4. **UI Components Updated**

#### A. SocialPlatformsTab Component
**File**: `src/components/settings/SocialPlatformsTab.tsx`

**Changes**:
1. Added `Mail` icon import from lucide-react
2. Added `email` configuration to `platformConfigs`:
   ```typescript
   email: {
     name: 'Email',
     icon: Mail,
     color: 'bg-orange-500',
     description: 'Connect your email account to send and receive messages from leads',
     fields: [
       { key: 'email_address', label: 'Email Address', type: 'email', ... },
       { key: 'smtp_host', label: 'SMTP Host', type: 'text', ... },
       { key: 'smtp_port', label: 'SMTP Port', type: 'number', ... },
       { key: 'smtp_username', label: 'SMTP Username', type: 'text', ... },
       { key: 'smtp_password', label: 'SMTP Password', type: 'password', ... },
       { key: 'imap_host', label: 'IMAP Host (Optional)', type: 'text', ... },
       { key: 'imap_port', label: 'IMAP Port (Optional)', type: 'number', ... },
     ]
   }
   ```

3. Added "Email Connect" card in the UI:
   - Orange card with Mail icon
   - "Connect Email" button
   - Opens the add platform dialog pre-configured for email

4. Added email configuration guide alert:
   - Shows common provider settings (Gmail, Outlook)
   - Security reminder about app-specific passwords

### 5. **Backend Edge Function**

#### New Function: `send-email-smtp`
**File**: `supabase/functions/send-email-smtp/index.ts`

**Purpose**: Send emails using custom SMTP credentials stored in the database

**Features**:
- Authenticates the user making the request
- Fetches email integration credentials from `social_platforms` table
- Validates SMTP configuration
- Sends email via SMTP using Deno's SMTP client
- Logs the communication in the `communications` table
- Proper error handling and logging

**Request Body**:
```typescript
{
  to: string;              // Recipient email address
  subject: string;         // Email subject
  message: string;         // Email body (plain text)
  organizationId: string;  // Organization ID
  leadId?: string;         // Optional lead ID
  emailIntegrationId?: string; // Optional specific integration to use
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 6. **Frontend Hooks**

#### New Hook: `useSendEmailSMTP`
**File**: `src/hooks/useCommunications.ts`

**Purpose**: React hook for sending emails via custom SMTP integration

**Usage**:
```typescript
const sendEmailSMTP = useSendEmailSMTP();

await sendEmailSMTP.mutateAsync({
  organizationId: 'org-id',
  leadId: 'lead-id',
  to: 'recipient@example.com',
  subject: 'Email Subject',
  message: 'Email body content',
  emailIntegrationId: 'optional-integration-id'
});
```

**Features**:
- Automatic request cancellation if a new request is made
- Query cache invalidation after successful send
- Toast notifications for success/failure
- Error handling with user-friendly messages

## Database Schema

### Table: `social_platforms`
The email integration uses the existing `social_platforms` table:

```sql
{
  id: uuid,
  organization_id: uuid,
  platform: 'email',
  display_name: string,
  is_enabled: boolean,
  credentials: {
    email_address: string,
    smtp_host: string,
    smtp_port: string,
    smtp_username: string,
    smtp_password: string, // Encrypted at rest
    imap_host?: string,
    imap_port?: string
  },
  webhook_url: null,
  created_at: timestamp,
  updated_at: timestamp
}
```

### Security Considerations
1. **Credentials Storage**: Email passwords are stored in the `credentials` JSONB field
2. **Access Control**: Only client admins and super admins can configure integrations
3. **Row-Level Security**: RLS policies on `social_platforms` table ensure org-level isolation
4. **Authentication**: Edge function validates user authentication before sending emails

## User Flow

### Adding Email Integration
1. User navigates to **Settings → Integrations**
2. Clicks **"Connect Email"** button in the Email Integration card
3. Dialog opens with email configuration form
4. User fills in:
   - Display name (e.g., "Support Email")
   - Email address
   - SMTP settings (host, port, username, password)
   - Optional IMAP settings
5. Clicks **"Add Platform"**
6. Integration is saved and appears in the platforms list

### Sending Email to a Lead
1. User opens a lead's communication panel
2. Selects the "Email" channel tab
3. Enters recipient email, subject, and message
4. Clicks **"Send Email"**
5. System:
   - Fetches enabled email integration for the organization
   - Connects to SMTP server using stored credentials
   - Sends the email
   - Logs the communication in the database
   - Shows success notification

### Managing Email Integrations
1. View all configured email integrations in the platforms list
2. Toggle integration on/off using the switch
3. Test connection using **"Test Connection"** button
4. Delete integration using the delete button
5. Edit settings by reconfiguring (delete and re-add if needed)

## Testing Guide

### Prerequisites
1. Have access to an email account with SMTP access
2. Generate app-specific password if using Gmail
3. Be logged in as client admin or super admin

### Test Steps
1. **Configuration Test**:
   - Add email integration with valid credentials
   - Verify integration appears in list
   - Verify it's marked as "Active"

2. **Send Test**:
   - Go to any lead's communication panel
   - Select Email tab
   - Send a test email to your own email address
   - Verify email is received

3. **Error Handling Test**:
   - Try adding integration with invalid credentials
   - Verify error message is displayed
   - Try sending email when no integration is configured
   - Verify appropriate error message

## Troubleshooting

### Common Issues

#### "No email integration configured"
**Solution**: Add an email integration in Settings → Integrations → Connect Email

#### "Failed to send email via SMTP: Authentication failed"
**Solutions**:
- Verify SMTP username and password are correct
- For Gmail: Use app-specific password, not regular password
- Check if 2FA is enabled and generate app password
- Verify SMTP host and port are correct

#### "Email service not configured"
**Solution**: This error occurs if using the old `send-email` function instead of `send-email-smtp`. Update the code to use the SMTP function.

#### Emails not being received
**Solutions**:
- Check spam/junk folder
- Verify recipient email address is correct
- Test SMTP connection using "Test Connection" button
- Check Edge Function logs for errors

## Future Enhancements

### Planned Features
1. **IMAP Integration**: Receive and display incoming emails
2. **Email Templates**: Pre-defined templates for common emails
3. **Attachment Support**: Send files with emails
4. **Email Tracking**: Read receipts and open tracking
5. **Email Threads**: Group related emails by conversation
6. **Multiple Accounts**: Support multiple email accounts per organization
7. **Auto-response**: Automated replies based on triggers
8. **Email Scheduling**: Schedule emails to be sent later

## API Documentation

### Edge Function: send-email-smtp

**Endpoint**: `/functions/v1/send-email-smtp`

**Method**: POST

**Headers**:
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "message": "Email body content",
  "organizationId": "uuid",
  "leadId": "uuid (optional)",
  "emailIntegrationId": "uuid (optional)"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

**Error Responses**:
- **401 Unauthorized**: Invalid or missing authentication
- **400 Bad Request**: No email integration configured or incomplete settings
- **500 Internal Server Error**: SMTP connection failure or other server error

## Support

### For Users
- Check this documentation for configuration help
- Contact your administrator if you can't access Integrations
- Verify email provider allows SMTP access

### For Administrators
- Ensure `send-email-smtp` Edge Function is deployed
- Verify RLS policies allow access to `social_platforms` table
- Check Edge Function logs for detailed error messages
- Test with a known working email account first

## Changelog

### Version 1.0 (January 19, 2026)
- Initial release of Email Integration feature
- Added email configuration UI in Integrations tab
- Created `send-email-smtp` Edge Function
- Added `useSendEmailSMTP` React hook
- Comprehensive documentation and user guide
- Support for Gmail, Outlook, Yahoo, and custom SMTP servers

---

**Last Updated**: January 19, 2026
**Author**: AI Development Team
**Status**: ✅ Complete and Ready for Production
