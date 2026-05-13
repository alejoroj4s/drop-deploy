import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dropdeploy.co'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {
        languages: {
          en: `${SITE_URL}/en`,
          es: `${SITE_URL}/es`,
        },
      },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/es`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ]
}
