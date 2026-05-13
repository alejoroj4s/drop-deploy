import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dropdeploy.co'

export const metadata: Metadata = {
  title: 'Drop Deploy - Instant HTML Hosting and AI Deploy Tool',
  description: 'Deploy HTML files and ZIP projects in seconds. Get a live URL instantly, no signup required. Built for AI assistants via MCP.',
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: `${SITE_URL}/en`,
      es: `${SITE_URL}/es`,
    },
  },
}

export default function RootPage() {
  redirect('/en')
}
