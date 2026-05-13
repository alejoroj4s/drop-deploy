import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dict, isValidLang, SUPPORTED_LANGS } from '@/lib/i18n'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dropdeploy.co'
const OG_IMAGE = `${SITE_URL}/og.png`

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  if (!isValidLang(lang)) return {}
  const t = dict[lang].meta
  const altLang = lang === 'en' ? 'es' : 'en'
  const canonical = lang === 'en' ? SITE_URL : `${SITE_URL}/${lang}`

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    authors: [{ name: 'Drop Deploy' }],
    creator: 'Drop Deploy',
    publisher: 'Drop Deploy',
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical,
      languages: {
        'en': `${SITE_URL}/en`,
        'es': `${SITE_URL}/es`,
        'x-default': SITE_URL,
      },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'Drop Deploy',
      title: t.title,
      description: t.description,
      locale: lang === 'es' ? 'es_ES' : 'en_US',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Drop Deploy — Instant HTML Hosting' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.title,
      description: t.description,
      images: [OG_IMAGE],
      creator: '@dropdeploy',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    other: {
      // LLM / AI discoverability headers
      'ai-content-type': 'web-application',
      'mcp-endpoint': `${SITE_URL}/api/mcp`,
    },
  }
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!isValidLang(lang)) notFound()

  // JSON-LD Structured Data
  const t = dict[lang].meta
  const canonical = lang === 'en' ? SITE_URL : `${SITE_URL}/${lang}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapp`,
        name: 'Drop Deploy',
        url: SITE_URL,
        description: t.description,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web browser',
        inLanguage: lang === 'es' ? 'es' : 'en',
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Instant HTML deployment',
          'ZIP project support',
          'MCP integration for AI assistants (Claude, ChatGPT, Cursor)',
          'Unique subdomain per deployment',
          'No signup required',
          'Watermark badge on deployed sites',
        ],
        screenshot: OG_IMAGE,
        sameAs: ['https://github.com/dropdeploy'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Drop Deploy',
        description: t.description,
        inLanguage: lang === 'es' ? 'es' : 'en',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#mcp`,
        name: 'Drop Deploy MCP Server',
        url: `${SITE_URL}/api/mcp`,
        description:
          'Model Context Protocol (MCP) server for deploying HTML and ZIP projects programmatically via AI assistants like Claude, ChatGPT, Cursor, and Windsurf.',
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'AI Tool',
        operatingSystem: 'Any',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: lang === 'es' ? 'Español' : 'English', item: canonical },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang="${lang}";`,
        }}
      />
      {children}
    </>
  )
}
