# Email Integration - Quick Reference Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Navigate to Settings
Settings → Integrations tab

### Step 2: Connect Email
Click **"Connect Email"** button in the orange Email Integration card

### Step 3: Fill in Your Email Settings

#### For Gmail Users:
```
Email Address:     your-email@gmail.com
SMTP Host:         smtp.gmail.com
SMTP Port:         587
SMTP Username:     your-email@gmail.com
SMTP Password:     [your app-specific password]
IMAP Host:         imap.gmail.com (optional)
IMAP Port:         993 (optional)
```

**Important**: Use an [app-specific password](https://support.google.com/accounts/answer/185833), not your regular Gmail password!

#### For Outlook/Office 365 Users:
```
Email Address:     your-email@outlook.com
SMTP Host:         smtp-mail.outlook.com
SMTP Port:         587
SMTP Username:     your-email@outlook.com
SMTP Password:     [your password]
IMAP Host:         outlook.office365.com (optional)
IMAP Port:         993 (optional)
```

### Step 4: Save and Enable
Click **"Add Platform"** → Your email integration will appear in the list

---

## 📧 Sending Emails to Leads

1. **Open a Lead**: Click on any lead from your leads list
2. **Go to Communications**: Find the communications panel
3. **Select Email Tab**: Click the Email channel
4. **Compose**:
   - Enter recipient email
   - Add subject line
   - Write your message
5. **Send**: Click "Send Email" button

**That's it!** The email will be sent from your configured email account.

---

## 🔧 Common Settings

### Gmail App-Specific Password Setup
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not already enabled)
3. Click **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Enter "AlCor Nexus" as the name
6. Click **Generate**
7. Copy the 16-character password
8. Use this password in the integration settings

### Outlook/Office 365
- Use your regular email password
- If 2FA is enabled, you may need an app password
- Some organizations may require additional permissions

---

## ✅ Testing Your Integration

1. **After adding integration**, click **"Test Connection"** button
2. Send a test email to yourself
3. Check if you receive the email
4. If not received, check spam/junk folder

---

## 🛠️ Troubleshooting

### Problem: "Authentication failed"
**Solution**: 
- Gmail: Use app-specific password, not regular password
- Verify email and password are correct
- Check SMTP host and port

### Problem: "No email integration configured"
**Solution**: 
- Add email integration in Settings → Integrations
- Make sure integration is **enabled** (toggle should be on)
- Refresh the page

### Problem: Emails not received
**Solution**:
- Check spam/junk folder
- Verify recipient email address
- Test with your own email first
- Check if your email provider allows SMTP

---

## 🎯 Best Practices

1. **Use Professional Email**: Use a business email address, not personal
2. **Test First**: Send test emails to yourself before sending to leads
3. **Keep Active**: Keep your integration enabled for uninterrupted service
4. **Monitor**: Check for any error notifications
5. **Secure Password**: Never share your SMTP password

---

## 📊 Features at a Glance

| Feature | Status |
|---------|--------|
| Send emails to leads | ✅ Available |
| Multiple email accounts | ✅ Available |
| Custom SMTP servers | ✅ Available |
| Email history tracking | ✅ Available |
| Receive emails (IMAP) | 🚧 Coming Soon |
| Email templates | 🚧 Coming Soon |
| Attachments | 🚧 Coming Soon |

---

## 🔐 Security Notes

- **Passwords are encrypted** at rest in the database
- **Only admins** can configure email integrations
- **Access control** ensures org-level data isolation
- **Authentication required** for all email operations

---

## 💡 Pro Tips

1. **Display Name**: Give your integration a meaningful name like "Support Email" or "Sales Email"
2. **Multiple Accounts**: You can add multiple email integrations for different purposes
3. **Toggle Off**: Temporarily disable an integration without deleting it
4. **Test Connection**: Use the test button regularly to ensure connectivity

---

## 📞 Need Help?

- **Documentation**: See EMAIL_INTEGRATION_DOCUMENTATION.md for detailed guide
- **Settings Issue**: Contact your system administrator
- **Technical Support**: Check Edge Function logs for detailed errors

---

**Last Updated**: January 19, 2026
