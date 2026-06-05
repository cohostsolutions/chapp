import { useNavigate, Link } from 'react-router-dom';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { BackToTop } from '@/components/shared/BackToTop';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { WebPageSchema, BreadcrumbSchema, SEOMeta } from '@/components/seo/StructuredData';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { legalHeaderLinks, PUBLIC_LEGAL_LAST_UPDATED } from '@/constants/publicSite';

export default function Privacy() {
  useScrollRestoration();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent targetId="main-content" />
      <ScrollProgress />
      {/* SEO Meta Tags */}
      <SEOMeta
        title="Privacy Policy"
        description="Learn how AlCor Nexus collects, uses, and protects your data. Our commitment to transparency and GDPR compliance."
        url="https://alcornexus.com/privacy"
      />
      <WebPageSchema
        title="Privacy Policy - AlCor Nexus"
        description="AlCor Nexus privacy policy explaining data collection, usage, and protection practices."
        url="https://alcornexus.com/privacy"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://alcornexus.com' },
          { name: 'Privacy Policy', url: 'https://alcornexus.com/privacy' },
        ]}
      />
      <StickyHeader
        links={legalHeaderLinks}
        ctaLabel="Sign In"
        onCtaClick={() => navigate('/auth')}
      />

      <BackToTop />

      {/* Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-4xl mx-auto px-6 py-12"
        role="main"
        aria-label="Privacy Policy main content"
      >
        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {PUBLIC_LEGAL_LAST_UPDATED}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              AlCor Nexus ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use AlCor Nexus 
              ("the Service"). Please read this policy carefully to understand our practices regarding your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Account Information:</strong> Name, email address, phone number, and organization details</li>
              <li><strong>Lead Data:</strong> Customer contact information, conversation history, and notes you input into the system</li>
              <li><strong>Knowledge Base Content:</strong> Documents and entries you upload to train AI agents</li>
              <li><strong>Communication Data:</strong> Messages sent through integrated social media platforms</li>
              <li><strong>Booking/Order Information:</strong> Reservation details, order items, and scheduling data</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Usage Data:</strong> Pages visited, features used, and actions taken within the Service</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">2.3 Third-Party Integration Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Social Media:</strong> Messages and user information from Facebook, Instagram, and WhatsApp</li>
              <li><strong>Google Calendar:</strong> Calendar events and scheduling information</li>
              <li><strong>Twilio:</strong> Call logs and SMS records</li>
            </ul>
          </section>

          <section id="google-api-data">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Google API Services Usage</h2>
            
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-foreground font-medium mb-2">Google API Services User Data Policy Compliance</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                AlCor Nexus's use and transfer to any other app of information received from Google APIs 
                will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, 
                including the Limited Use requirements.
              </p>
            </div>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.1 Data We Access from Google</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              When you connect your Google account to AlCor Nexus, we request access to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Google Calendar events:</strong> To view, create, and modify calendar events for scheduling purposes</li>
              <li><strong>Basic profile information:</strong> Email address and name for account identification</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.2 How We Use Google Data (Limited Use Disclosure)</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              <strong>We use Google user data exclusively to provide and improve AlCor Nexus's core functionality:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Scheduling callbacks:</strong> When our AI qualifies a lead as "hot," it schedules a callback on your calendar</li>
              <li><strong>Managing bookings:</strong> Room reservations and appointments are synced to your calendar</li>
              <li><strong>Availability checking:</strong> We read calendar events to prevent double-bookings</li>
              <li><strong>Demo scheduling:</strong> Prospective customers can book calls that appear on your calendar</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.3 What We Do NOT Do with Google Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              <strong>AlCor Nexus does NOT:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use Google user data for advertising purposes</li>
              <li>Sell or rent Google user data to third parties</li>
              <li>Use Google user data for market research or user profiling unrelated to the Service</li>
              <li>Transfer Google user data to third parties except as necessary to provide the Service</li>
              <li>Use Google user data for any purpose other than providing or improving the scheduling features you explicitly authorized</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.4 Data Storage and Security</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Google OAuth tokens are stored using AES-256 encryption</li>
              <li>We access calendar data only when needed to perform authorized functions</li>
              <li>Calendar event data is not stored permanently—we read events in real-time for availability checks</li>
              <li>Only authorized personnel with a legitimate need can access Google integration systems</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">3.5 Revoking Google Access</h3>
            <p className="text-muted-foreground leading-relaxed">
              You can revoke AlCor Nexus's access to your Google account at any time by:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Disconnecting from the Settings page within AlCor Nexus</li>
              <li>Removing access from your Google Account at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/permissions</a></li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Upon disconnection, all stored Google tokens are immediately deleted from our systems.
            </p>
          </section>

          <section id="meta-platforms-data">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Meta Platforms (Facebook, Instagram, WhatsApp) Data Usage</h2>
            
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-foreground font-medium mb-2">Meta Platform Terms Compliance</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                AlCor Nexus's use of data received from Meta Platforms (Facebook, Instagram, WhatsApp) 
                complies with <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Platform Terms</a> and 
                <a href="https://developers.facebook.com/docs/messenger-platform/policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">Messenger Platform Policy</a>.
              </p>
            </div>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.1 Data We Access from Meta Platforms</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              When you connect Meta platforms to AlCor Nexus, we access:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Page/Account information:</strong> Page ID, page name for identification</li>
              <li><strong>Messaging data:</strong> Messages sent to your connected Facebook Page, Instagram Business Account, or WhatsApp Business Account</li>
              <li><strong>User profile data:</strong> Name and profile information of users who message your business (as permitted by Meta)</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.2 How We Use Meta Platform Data (Purpose Limitation)</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              <strong>We use Meta platform data exclusively to:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Process and respond to messages:</strong> Our AI agents read incoming messages and generate contextual responses to customer inquiries</li>
              <li><strong>Manage leads:</strong> Customer information from conversations is stored as leads in your CRM</li>
              <li><strong>Facilitate bookings:</strong> Process reservation requests and order inquiries received via messaging</li>
              <li><strong>Enable human takeover:</strong> Allow your agents to take over AI conversations when needed</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.3 What We Do NOT Do with Meta Platform Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              <strong>AlCor Nexus does NOT:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use Meta platform data for advertising or ad targeting</li>
              <li>Sell, license, or rent Meta user data to any third party</li>
              <li>Use messaging data for purposes unrelated to customer service automation</li>
              <li>Build user profiles for marketing purposes outside of your organization</li>
              <li>Share message content with third parties except as required to provide the Service</li>
              <li>Retain message data longer than necessary to provide the Service</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.4 Data Storage and Retention</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Meta access tokens are encrypted using AES-256 encryption</li>
              <li>Conversation history is stored to maintain context for ongoing customer interactions</li>
              <li>Data is retained only as long as necessary to provide the Service or as required by law</li>
              <li>You can request deletion of Meta-sourced data by contacting us</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.5 Revoking Meta Access</h3>
            <p className="text-muted-foreground leading-relaxed">
              You can disconnect Meta platforms at any time by:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Removing the platform from the Social Platforms page within AlCor Nexus</li>
              <li>Removing AlCor Nexus from your Facebook Business Settings at <a href="https://business.facebook.com/settings/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">business.facebook.com/settings/apps</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">We use the collected information to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and manage leads, bookings, and orders</li>
              <li>Power AI agent conversations and responses</li>
              <li>Sync data with integrated third-party platforms (Google Calendar, Meta platforms) for scheduling and messaging</li>
              <li>Send system notifications and important updates</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Important:</strong> We do not use data from Google APIs or Meta platforms for advertising, 
              marketing, or any purpose other than providing the core functionality of AlCor Nexus as described above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. AI Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our AI agents (Jay, May, Cece) process customer conversations to provide automated responses. 
              This processing includes:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Analyzing message content to generate appropriate responses</li>
              <li>Accessing knowledge base content to provide accurate information</li>
              <li>Qualifying leads based on conversation analysis</li>
              <li>Scheduling callbacks and appointments via Google Calendar integration</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              AI processing is performed using secure cloud services, and conversation data is used only 
              for the purposes of providing the Service. We do not use AI to profile users for advertising 
              or share AI-processed data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed">We may share your information with:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Service Providers:</strong> Third-party vendors who assist in operating the Service 
                (e.g., hosting, AI processing, communication services)—bound by confidentiality agreements</li>
              <li><strong>Integrated Platforms:</strong> Meta and Google only as required for the integrations you explicitly enable</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>We do not sell, rent, or trade your personal information or data from integrated platforms to third parties.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Encryption of data in transit (TLS) and at rest (AES-256 for OAuth tokens)</li>
              <li>Role-based access control (Super Admin, Client Admin, Agent)</li>
              <li>Row-level security for multi-tenant data isolation</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure authentication mechanisms including two-factor authentication</li>
              <li>Limited access to systems containing third-party platform data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide the Service. 
              Upon account termination, we will retain data as necessary to comply with legal obligations, 
              resolve disputes, and enforce agreements. You may request deletion of your data by contacting us.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Google OAuth tokens are deleted immediately when you disconnect the integration</li>
              <li>Meta platform tokens are deleted when you remove the platform connection</li>
              <li>Conversation data can be deleted upon request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Access your personal data</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent where applicable</li>
              <li>Revoke third-party integrations (Google, Meta) at any time</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your data in accordance with 
              applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to enable core functionality of the Service, such as authentication 
              and session management. We do not use third-party advertising cookies. You can manage cookie 
              preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">13. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for children under 16 years of age. We do not knowingly collect 
              personal information from children. If you believe we have collected data from a child, 
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">14. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes 
              through the Service or via email. Your continued use of the Service after changes take effect 
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">15. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-foreground mt-3">
              <strong>Email:</strong> privacy@alcornexus.com<br />
              <strong>Company:</strong> AlCor Nexus<br />
              <strong>Data Protection Officer:</strong> dpo@alcornexus.com
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
