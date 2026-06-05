import { Helmet } from 'react-helmet';

interface SEOMetaProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
}

export function SEOMeta({ 
  title, 
  description, 
  url, 
  image = 'https://alcornexus.com/og-image.png',
  type = 'website' 
}: SEOMetaProps) {
  const fullTitle = title.includes('AlCor') ? title : `${title} | AlCor Nexus`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="AlCor Nexus" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

interface StructuredDataProps {
  type: 'Organization' | 'WebPage' | 'Product' | 'FAQPage' | 'Service' | 'WebApplication';
  data: Record<string, unknown>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
}

// Predefined schema helpers

// Predefined schema helpers
export const organizationSchema = {
  '@type': 'Organization',
  name: 'AlCor Nexus',
  url: 'https://alcornexus.com',
  logo: 'https://alcornexus.com/alcor-logo.svg',
  sameAs: [
    'https://www.linkedin.com/company/alcor-digital-nexus',
    'https://www.facebook.com/alcordigitalnexus',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'contact@alcornexus.com',
    contactType: 'customer service',
  },
};

export function WebPageSchema({ 
  title, 
  description, 
  url 
}: { 
  title: string; 
  description: string; 
  url: string;
}) {
  return (
    <StructuredData
      type="WebPage"
      data={{
        name: title,
        description,
        url,
        publisher: organizationSchema,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AlCor Nexus',
          url: 'https://alcornexus.com',
        },
      }}
    />
  );
}

export function ProductSchema({
  name,
  description,
  price,
  currency = 'USD',
  image,
}: {
  name: string;
  description: string;
  price: number;
  currency?: string;
  image?: string;
}) {
  return (
    <StructuredData
      type="Product"
      data={{
        name,
        description,
        image: image || 'https://alcornexus.com/og-image.png',
        brand: {
          '@type': 'Brand',
          name: 'AlCor Nexus',
        },
        offers: {
          '@type': 'Offer',
          price,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          seller: organizationSchema,
        },
      }}
    />
  );
}

export function FAQSchema({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  return (
    <StructuredData
      type="FAQPage"
      data={{
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }}
    />
  );
}

export function ServiceSchema({
  name,
  description,
  provider = organizationSchema,
}: {
  name: string;
  description: string;
  provider?: Record<string, unknown>;
}) {
  return (
    <StructuredData
      type="Service"
      data={{
        name,
        description,
        provider,
        areaServed: {
          '@type': 'Country',
          name: 'Worldwide',
        },
      }}
    />
  );
}

export function SoftwareApplicationSchema({
  name,
  description,
  applicationCategory,
  operatingSystem = 'Web',
  offers,
}: {
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem?: string;
  offers?: Array<{ name: string; price: number; currency?: string }>;
}) {
  return (
    <StructuredData
      type="WebApplication"
      data={{
        name,
        description,
        applicationCategory,
        operatingSystem,
        offers: offers?.map((offer) => ({
          '@type': 'Offer',
          name: offer.name,
          price: offer.price,
          priceCurrency: offer.currency || 'USD',
        })),
        provider: organizationSchema,
      }}
    />
  );
}

export function BreadcrumbSchema({ 
  items 
}: { 
  items: Array<{ name: string; url: string }> 
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
}
