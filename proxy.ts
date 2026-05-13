import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // Skip Next.js internals, API routes, language routes, and static files
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/sites/') ||
    pathname.startsWith('/brand/') ||
    pathname === '/en' ||
    pathname === '/es' ||
    pathname.startsWith('/en/') ||
    pathname.startsWith('/es/')
  ) {
    return NextResponse.next()
  }

  const rootDomain = process.env.ROOT_DOMAIN ?? ''

  // Detect subdomain
  let subdomain: string | null = null

  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    subdomain = host.slice(0, -(rootDomain.length + 1))
  } else if (!rootDomain) {
    // Local dev: match *.localhost or *.localhost:PORT
    const localhostMatch = host.match(/^([a-z0-9-]+)\.localhost(:\d+)?$/)
    if (localhostMatch) subdomain = localhostMatch[1]
  }

  if (subdomain && subdomain !== 'www') {
    const filePath = pathname === '/' ? '/index.html' : pathname
    const rewriteUrl = new URL(`/sites/${subdomain}${filePath}`, request.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
