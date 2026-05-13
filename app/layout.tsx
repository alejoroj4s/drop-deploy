import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dropdeploy.co'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Drop Deploy — Instant HTML Hosting & AI Deploy Tool',
    template: '%s | Drop Deploy',
  },
  description: 'Deploy HTML files and ZIP projects in seconds. Get a live URL instantly — no signup. Built for AI assistants via MCP (Claude, ChatGPT, Cursor).',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
  other: {
    'mcp-endpoint': `${SITE_URL}/api/mcp`,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* AI/LLM discoverability */}
        <link rel="alternate" type="application/json" href="/api/mcp" title="Drop Deploy MCP Server" />
      </head>
      <body className="bg-white antialiased">{children}</body>
    </html>
  )
}

