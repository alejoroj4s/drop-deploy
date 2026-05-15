import { NextRequest, NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { join } from 'path'
import { getExpiredDeployments, deleteDeployment } from '@/lib/db'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization') ?? request.nextUrl.searchParams.get('secret')
    if (auth !== `Bearer ${secret}` && auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const expired = getExpiredDeployments()
  const results: { site_id: string; status: string }[] = []

  for (const dep of expired) {
    try {
      const siteDir = join(process.cwd(), 'public', 'sites', dep.site_id)
      await rm(siteDir, { recursive: true, force: true })
      deleteDeployment(dep.site_id)
      results.push({ site_id: dep.site_id, status: 'deleted' })
    } catch (err) {
      console.error('[cron/cleanup] Failed to delete', dep.site_id, err)
      results.push({ site_id: dep.site_id, status: 'error' })
    }
  }

  return NextResponse.json({ cleaned: results.length, results })
}
