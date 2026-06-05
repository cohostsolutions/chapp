
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, MessageSquare, Phone, Shield, Database, Lock, Trash2, Settings, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { BackToTop } from '@/components/shared/BackToTop';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { WebPageSchema, BreadcrumbSchema, SEOMeta } from '@/components/seo/StructuredData';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { legalHeaderLinks, PUBLIC_LEGAL_LAST_UPDATED } from '@/constants/publicSite';

const integrations = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: Calendar,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'AlCor Nexus integrates with Google Calendar to manage scheduling and bookings for your business.',
    dataAccessed: [
      { label: 'View calendar events', purpose: 'To check availability and prevent scheduling conflicts' },
      { label: 'Create calendar events', purpose: 'To schedule callbacks for qualified leads and create bookings' },
      { label: 'Modify calendar events', purpose: 'To update or cancel existing bookings when changes occur' },
    ],
    purposes: [
      'Schedule automatic callbacks when AI qualifies a lead as "hot"',
      'Sync hotel room bookings for real-time availability (Cece AI)',
      'Schedule food order pickups (May AI)',
      'Allow prospects to book demo calls with your team',
    ],
    security: [
      'OAuth tokens are encrypted using AES-256 encryption',
      'Calendar data is accessed only when performing authorized operations',
      'We do not share calendar data with third parties',
      'You can disconnect at any time from Settings',
    ],
    revokeInstructions: 'You can revoke access from Settings in AlCor Nexus or from your Google Account at myaccount.google.com/permissions',
  },
  {
    id: 'google-mail',
    name: 'Google Mail (Gmail)',
    icon: Mail,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    description: 'AlCor Nexus integrates with Gmail to send professional email communications on your behalf.',
    dataAccessed: [
      { label: 'Send emails', purpose: 'To send automated follow-ups, confirmations, and customer communications' },
      { label: 'Read email metadata', purpose: 'To track delivery status and customer engagement (optional)' },
      { label: 'Access sent items', purpose: 'To log email history in your CRM and maintain communication records' },
    ],
    purposes: [
      'Send automated email confirmations for bookings and orders',
      'Deliver follow-up emails to qualified leads',
      'Send password reset and account verification emails',
      'Provide professional email communications branded with your business',
      'Log all email communications in your CRM for complete customer history',
    ],
    security: [
      'OAuth tokens are encrypted using AES-256 encryption',
      'Email credentials are never stored in plain text',
      'We only access Gmail when sending emails on your behalf',
      'All email activity is logged for audit purposes',
      'You can disconnect at any time from Settings',
    ],
    revokeInstructions: 'You can revoke access from Settings in AlCor Nexus or from your Google Account at myaccount.google.com/permissions',
  },
  {
    id: 'meta-platforms',
    name: 'Meta Platforms (Facebook, Instagram, WhatsApp)',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
    description: 'Connect your social media channels to receive and respond to customer messages through AlCor Nexus.',
    dataAccessed: [
      { label: 'Page access tokens', purpose: 'To send and receive messages on your behalf' },
      { label: 'Message content', purpose: 'To display conversations and enable AI responses' },
      { label: 'User profile information', purpose: 'To identify customers in your CRM' },
    ],
    purposes: [
      'Receive incoming messages from Facebook Messenger, Instagram DMs, and WhatsApp',
      'Enable AI agents to respond automatically to customer inquiries',
      'Sync conversations to your unified inbox for agent review',
      'Track message delivery and read status',
    ],
    security: [
      'Page access tokens are encrypted at rest',
      'Webhook payloads are verified using HMAC signatures',
      'Tokens are automatically refreshed before expiration',
      'Each organization\'s data is isolated',
    ],
    revokeInstructions: 'Disconnect from Social Platforms page in AlCor Nexus or remove the app from your Facebook Business Settings',
  },
  {
    id: 'twilio',
    name: 'Twilio (SMS & Voice)',
    icon: Phone,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    description: 'Twilio integration enables browser-to-phone calling and SMS messaging for direct customer contact.',
    dataAccessed: [
      { label: 'Call logs', purpose: 'To record call duration and outcomes for CRM tracking' },
      { label: 'SMS content', purpose: 'To display message history and enable two-way communication' },
      { label: 'Phone numbers', purpose: 'To route calls and messages to the correct recipients' },
    ],
    purposes: [
      'Enable agents to call leads directly from the browser',
      'Send and receive SMS messages with customers',
      'Log all communications for compliance and follow-up',
      'Support Philippine phone numbers (+63)',
    ],
    security: [
      'Twilio credentials are stored as encrypted secrets',
      'Call recordings (if enabled) are securely stored',
      'All communication logs are access-controlled by role',
      'Rate limiting prevents abuse',
    ],
    revokeInstructions: 'Contact your administrator to disconnect Twilio integration',
  },
];

export default function Terms() {
  useScrollRestoration();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Accessibility: Skip to main content link */}
      <SkipToContent targetId="main-content" />
      <ScrollProgress />
      {/* SEO Meta Tags */}
      <SEOMeta
        title="Terms of Service & Data Usage"
        description="Terms and conditions for using AlCor Nexus and transparency about how we use your data with third-party integrations."
        url="https://alcornexus.com/terms"
      />
      <WebPageSchema
        title="Terms of Service & Data Usage - AlCor Nexus"
        description="Terms and conditions governing the use of AlCor Nexus services and data usage transparency."
        url="https://alcornexus.com/terms"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://alcornexus.com' },
          { name: 'Terms & Data Usage', url: 'https://alcornexus.com/terms' },
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
        className="max-w-5xl mx-auto px-6 py-12"
        role="main"
        aria-label="Terms of Service and Data Usage main content"
      >
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service & Data Usage</h1>
          <p className="text-lg text-muted-foreground">
            Terms and conditions, plus transparency about third-party integrations and data access
          </p>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {PUBLIC_LEGAL_LAST_UPDATED}</p>
        </div>

        {/* Quick Navigation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <a href="#terms" className="text-primary hover:underline">→ Terms of Service</a>
              <a href="#data-usage" className="text-primary hover:underline">→ Data Usage & Integrations</a>
              <a href="#google-calendar" className="text-primary hover:underline">→ Google Calendar</a>
              <a href="#google-mail" className="text-primary hover:underline">→ Google Mail (Gmail)</a>
              <a href="#meta-platforms" className="text-primary hover:underline">→ Meta Platforms</a>
              <a href="#twilio" className="text-primary hover:underline">→ Twilio</a>
            </div>
          </CardContent>
        </Card>

        {/* TERMS OF SERVICE SECTION */}
        <section id="terms" className="mb-12 scroll-mt-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h2>
            <div className="h-1 w-20 bg-primary rounded" />
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">1. Agreement to Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using AlCor Nexus ("the Service"), you agree to be bound by these Terms of Service. 
                If you disagree with any part of these terms, you may not access the Service. These terms apply to all 
                visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h3>
              <p className="text-muted-foreground leading-relaxed">
                AlCor Nexus is a multi-tenant customer relationship management platform that provides AI-powered 
                customer engagement tools, including:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
                <li>AI agents (Jay, May, Cece) for automated customer interactions</li>
                <li>Multi-channel messaging integration (Facebook Messenger, WhatsApp, Instagram)</li>
                <li>Email communication via Gmail integration</li>
                <li>Browser-to-phone calling capabilities</li>
                <li>Lead management and qualification tools</li>
                <li>Booking and order management systems</li>
                <li>Google Calendar integration</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h3>
              <p className="text-muted-foreground leading-relaxed">
                Access to AlCor Nexus is provided through administrator-managed accounts. You are responsible for:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
                <li>Ensuring that your use complies with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">4. Acceptable Use</h3>
              <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
                <li>Transmit spam, chain letters, or other unsolicited communications</li>
                <li>Attempt to gain unauthorized access to other user accounts or computer systems</li>
                <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
                <li>Use the Service to send misleading or deceptive messages</li>
                <li>Collect or store personal data about other users without their consent</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">5. AI Agent Usage</h3>
              <p className="text-muted-foreground leading-relaxed">
                When using our AI agents (Jay, May, Cece), you acknowledge that:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
                <li>AI responses are generated automatically and may not always be accurate</li>
                <li>You are responsible for reviewing and monitoring AI interactions with your customers</li>
                <li>You must ensure your knowledge base content is accurate and up-to-date</li>
                <li>Human agent oversight is recommended for critical customer interactions</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">6. Third-Party Integrations</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Service integrates with third-party platforms including Meta (Facebook, Instagram, WhatsApp), 
                Google (Gmail, Calendar), and Twilio. Your use of these integrations is subject to the respective 
                third-party terms of service. We are not responsible for the availability or functionality 
                of third-party services.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">7. Data Ownership</h3>
              <p className="text-muted-foreground leading-relaxed">
                You retain all rights to the data you input into the Service, including leads, customer 
                information, and knowledge base content. We do not claim ownership of your data and will 
                only use it to provide and improve the Service as outlined in the Data Usage section below.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">8. Service Availability</h3>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain high availability of the Service but do not guarantee uninterrupted 
                access. We may perform maintenance, updates, or experience outages that temporarily affect 
                Service availability. We will endeavor to provide advance notice of planned maintenance.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">9. Limitation of Liability</h3>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, AlCor Nexus shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, including loss of profits, data, 
                or business opportunities arising from your use of the Service.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">10. Termination</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice, 
                for conduct that we believe violates these Terms or is harmful to other users, us, or 
                third parties, or for any other reason at our sole discretion.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">11. Changes to Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will provide notice of significant 
                changes through the Service or via email. Your continued use of the Service after changes 
                become effective constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-foreground mb-4">12. Contact Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-foreground mt-3">
                <strong>Email:</strong> legal@alcornexus.com<br />
                <strong>Company:</strong> AlCor Nexus
              </p>
            </section>
          </div>
        </section>

        {/* DATA USAGE SECTION */}
        <section id="data-usage" className="mb-12 scroll-mt-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Data Usage & Third-Party Integrations</h2>
            <div className="h-1 w-20 bg-primary rounded" />
          </div>

          {/* Overview */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                AlCor Nexus connects to several third-party services to provide its full functionality. 
                This section explains what data we access from each integration, why we need it, and how we protect it. 
                All integrations are optional and can be connected or disconnected at any time.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-6 not-prose">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Lock className="w-5 h-5 text-primary mb-2" />
                  <p className="font-medium text-foreground">Encrypted Storage</p>
                  <p className="text-sm text-muted-foreground">All tokens and credentials use AES-256 encryption</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Shield className="w-5 h-5 text-primary mb-2" />
                  <p className="font-medium text-foreground">Role-Based Access</p>
                  <p className="text-sm text-muted-foreground">Data access is controlled by user roles</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Trash2 className="w-5 h-5 text-primary mb-2" />
                  <p className="font-medium text-foreground">Easy Revocation</p>
                  <p className="text-sm text-muted-foreground">Disconnect integrations anytime from Settings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integration Details */}
          <div className="space-y-6">
            {integrations.map((integration) => (
              <Card key={integration.id} id={integration.id} className="scroll-mt-8">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${integration.bgColor} flex items-center justify-center`}>
                      <integration.icon className={`w-5 h-5 ${integration.color}`} />
                    </div>
                    <div>
                      <CardTitle>{integration.name}</CardTitle>
                      <CardDescription>{integration.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Data Accessed */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">What We Access</h4>
                    <div className="space-y-2">
                      {integration.dataAccessed.map((item, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.purpose}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Purposes */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Why We Need It</h4>
                    <ul className="space-y-2">
                      {integration.purposes.map((purpose, index) => (
                        <li key={index} className="flex items-start gap-2 text-muted-foreground">
                          <span className="text-primary">•</span>
                          {purpose}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Security */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">How We Protect Your Data</h4>
                    <ul className="space-y-2">
                      {integration.security.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-muted-foreground">
                          <Shield className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Revoke */}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-start gap-3">
                      <Settings className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">How to Revoke Access</p>
                        <p className="text-sm text-muted-foreground">{integration.revokeInstructions}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Information */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Data Retention</h4>
                <p className="text-muted-foreground">
                  Integration tokens and credentials are retained while your connection is active. 
                  When you disconnect an integration, associated tokens are immediately deleted. 
                  Historical data (conversation logs, call records, email logs) is retained according to our{' '}
                  <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Third-Party Data Sharing</h4>
                <p className="text-muted-foreground">
                  We do not sell your data. Information is shared with third-party services only as 
                  necessary to provide the functionality you've enabled (e.g., sending a message 
                  through Meta requires sharing message content with Meta's servers, sending an email
                  through Gmail requires sharing email content with Google's servers).
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Google API Services Compliance</h4>
                <p className="text-muted-foreground">
                  AlCor Nexus's use of information received from Google APIs will adhere to the{' '}
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google API Services User Data Policy
                  </a>, including the Limited Use requirements. We only use your Google data to provide and improve the services you've explicitly authorized.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Questions?</h4>
                <p className="text-muted-foreground">
                  If you have questions about our data practices, please contact us at{' '}
                  <a href="mailto:privacy@alcornexus.com" className="text-primary hover:underline">
                    privacy@alcornexus.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
