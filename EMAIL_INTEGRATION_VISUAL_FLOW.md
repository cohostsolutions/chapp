# Email Integration - Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL INTEGRATION ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Settings → Integrations Tab
    ┌──────────────────────────────────────────────────────────┐
    │  📧 Email Integration                                     │
    │  Connect your email account to send and receive          │
    │  messages from leads via email                           │
    │                                    [Connect Email] ────┐  │
    └────────────────────────────────────────────────────────┼──┘
                                                             │
                                                             ▼
                          ┌─────────────────────────────────────────┐
                          │    Add Email Integration Dialog         │
                          ├─────────────────────────────────────────┤
                          │  Display Name: [Support Email]          │
                          │  Email Address: [user@company.com]      │
                          │  SMTP Host: [smtp.gmail.com]            │
                          │  SMTP Port: [587]                       │
                          │  SMTP Username: [user@company.com]      │
                          │  SMTP Password: [••••••••]              │
                          │  IMAP Host: [imap.gmail.com] (optional) │
                          │  IMAP Port: [993] (optional)            │
                          │                                         │
                          │  ℹ️ Configuration Guide:                │
                          │  Gmail: smtp.gmail.com:587              │
                          │  Outlook: smtp-mail.outlook.com:587     │
                          │                                         │
                          │        [Cancel]  [Add Platform]         │
                          └─────────────────────────────────────────┘
                                           │
                                           │ Save
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                          social_platforms table
                    ┌──────────────────────────────────┐
                    │ id: uuid                         │
                    │ organization_id: uuid            │
                    │ platform: "email"                │
                    │ display_name: "Support Email"    │
                    │ is_enabled: true                 │
                    │ credentials: {                   │
                    │   email_address: "user@..."      │
                    │   smtp_host: "smtp.gmail.com"    │
                    │   smtp_port: "587"               │
                    │   smtp_username: "user@..."      │
                    │   smtp_password: "[encrypted]"   │
                    │   imap_host: "imap.gmail.com"    │
                    │   imap_port: "993"               │
                    │ }                                │
                    │ created_at: timestamp            │
                    │ updated_at: timestamp            │
                    └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SENDING EMAIL FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

    Lead Communication Panel
    ┌──────────────────────────────────────────────────────────┐
    │  Tabs: [SMS] [Call] [Email] [WhatsApp] [Messenger]       │
    │  ───────────────────────────────────────────────────────  │
    │  Email Tab Selected:                                      │
    │                                                           │
    │  To: [lead@example.com]                                   │
    │  Subject: [Follow up on your inquiry]                     │
    │  Message:                                                 │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │ Hi John,                                            │  │
    │  │                                                     │  │
    │  │ Thank you for your interest in our services...     │  │
    │  │                                                     │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                        [Send Email] ────┐ │
    └────────────────────────────────────────────────────────┼─┘
                                                             │
                                                             │
                                                             ▼
                          ┌─────────────────────────────────────────┐
                          │   useSendEmailSMTP() Hook               │
                          │   (React Query Mutation)                │
                          └─────────────────────────────────────────┘
                                           │
                                           │ Invoke
                                           ▼
                          ┌─────────────────────────────────────────┐
                          │   Supabase Edge Function                │
                          │   send-email-smtp                       │
                          └─────────────────────────────────────────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                 │
                         ▼                 ▼                 ▼
              ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
              │ 1. Authenticate  │ │ 2. Fetch     │ │ 3. Connect       │
              │    User          │ │    Email     │ │    to SMTP       │
              │                  │ │    Integration│ │    Server        │
              └──────────────────┘ └──────────────┘ └──────────────────┘
                         │                 │                 │
                         └─────────────────┼─────────────────┘
                                           │
                                           ▼
                          ┌─────────────────────────────────────────┐
                          │   SMTP Client                           │
                          │   - Connect to smtp.gmail.com:587       │
                          │   - Authenticate with credentials       │
                          │   - Send email                          │
                          └─────────────────────────────────────────┘
                                           │
                         ┌─────────────────┴─────────────────┐
                         │                                   │
                         ▼                                   ▼
              ┌──────────────────┐              ┌──────────────────────┐
              │ 4. Email Sent    │              │ 5. Log in Database   │
              │    Successfully  │              │    communications    │
              │                  │              │    table             │
              └──────────────────┘              └──────────────────────┘
                         │
                         │ Response
                         ▼
                  ┌──────────────────┐
                  │ Success Toast    │
                  │ "Email sent!"    │
                  └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW SUMMARY                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User Action → Frontend Component → React Hook → Edge Function → SMTP Server
                                                      │
                                                      ├→ Database (Log)
                                                      │
                                                      └→ Response → Toast

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Authentication                                                   │
│  - User must be logged in                                                  │
│  - JWT token validated                                                     │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Authorization                                                    │
│  - Only Client Admins and Super Admins can configure                       │
│  - Row-Level Security on social_platforms table                            │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Data Encryption                                                  │
│  - Credentials stored encrypted at rest                                    │
│  - HTTPS/TLS for all connections                                           │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: Organization Isolation                                           │
│  - Each org can only access their own integrations                         │
│  - Lead data scoped to organization                                        │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Send Email Request
           │
           ▼
    ┌──────────────┐  No    ┌────────────────────┐
    │ User         │───────→│ Error: Unauthorized│
    │ Authenticated│        └────────────────────┘
    └──────────────┘
           │ Yes
           ▼
    ┌──────────────┐  No    ┌────────────────────────────┐
    │ Integration  │───────→│ Error: No email            │
    │ Configured?  │        │ integration configured     │
    └──────────────┘        └────────────────────────────┘
           │ Yes
           ▼
    ┌──────────────┐  No    ┌────────────────────────────┐
    │ Credentials  │───────→│ Error: Incomplete          │
    │ Complete?    │        │ SMTP settings              │
    └──────────────┘        └────────────────────────────┘
           │ Yes
           ▼
    ┌──────────────┐  No    ┌────────────────────────────┐
    │ SMTP         │───────→│ Error: SMTP connection     │
    │ Connection   │        │ failed (check credentials) │
    │ Successful?  │        └────────────────────────────┘
    └──────────────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Email Sent   │
    │ Successfully │
    └──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      PLATFORM CONFIGURATION OVERVIEW                        │
└─────────────────────────────────────────────────────────────────────────────┘

Integrations Tab Display:

┌──────────────────────────────────────────────────────────────────────────────┐
│  Social Platforms                                               [Refresh]     │
│                                                                               │
│  ┌─ Stats ─────────────────────────────────────────────────────────────────┐ │
│  │  Total: 4    Active: 3    Expiring: 0    Expired: 0                    │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─ Facebook, Instagram & WhatsApp ────────────────────┐                     │
│  │  🔵 Connect your Facebook pages...  [Connect Facebook]│                    │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                               │
│  ┌─ Email Integration ──────────────────────────────────┐                     │
│  │  🟠 Connect your email account...      [Connect Email]│                    │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │ 📘 Facebook    │  │ 📸 Instagram   │  │ 💬 WhatsApp    │                 │
│  │ My Page        │  │ @myaccount     │  │ +1234567890    │                 │
│  │ [Active] ●     │  │ [Active] ●     │  │ [Inactive] ○   │                 │
│  │                │  │                │  │                │                 │
│  │ [Test] [Edit]  │  │ [Test] [Edit]  │  │ [Test] [Edit]  │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                               │
│  ┌────────────────┐                                                          │
│  │ 📧 Email       │                                                          │
│  │ support@...    │                                                          │
│  │ [Active] ●     │                                                          │
│  │                │                                                          │
│  │ [Test] [Edit]  │                                                          │
│  └────────────────┘                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Components Legend

- 🔵 Blue = Facebook/Meta Integration
- 🟠 Orange = Email Integration
- 📧 = Email Icon
- ● = Active Status
- ○ = Inactive Status
- ✅ = Success State
- ❌ = Error State
- 🔐 = Secure/Encrypted
- ⚡ = Real-time Action

---

**Diagram Version**: 1.0
**Last Updated**: January 19, 2026
