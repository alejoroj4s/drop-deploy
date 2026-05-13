import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, writeFile as writeJson } from 'fs/promises'
import { join, dirname } from 'path'
import { customAlphabet } from 'nanoid'
import AdmZip from 'adm-zip'
import { injectWatermark } from '@/utils/watermark'

const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)

const DEPLOYMENTS_FILE = join(process.cwd(), 'data', 'deployments.json')
const SITES_DIR = join(process.cwd(), 'public', 'sites')
const MAX_SIZE = 20 * 1024 * 1024

async function getDeployments() {
  try {
    return JSON.parse(await readFile(DEPLOYMENTS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

async function addDeployment(deployment: object) {
  const list = await getDeployments()
  list.unshift(deployment)
  await writeJson(DEPLOYMENTS_FILE, JSON.stringify(list.slice(0, 100), null, 2))
}

function extractZipFlattened(buffer: Buffer) {
  const zip = new AdmZip(buffer)
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && !e.entryName.includes('__MACOSX') && !e.entryName.startsWith('.'))

  const firstParts = entries.map((e) => e.entryName.split('/')[0])
  const uniqueRoots = new Set(firstParts)
  const hasSubdir = entries.some((e) => e.entryName.includes('/'))
  const stripPrefix = uniqueRoots.size === 1 && hasSubdir ? [...uniqueRoots][0] + '/' : ''

  return { entries, stripPrefix }
}

function getHomeUrl(req: NextRequest): string {
  const rootDomain = process.env.ROOT_DOMAIN
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host = req.headers.get('host') ?? 'localhost:3000'
  if (rootDomain) return `${proto}://${rootDomain}`
  // Strip subdomain for local dev
  const parts = host.split('.')
  if (parts.length > 2) return `${proto}://${parts.slice(1).join('.')}`
  return `${proto}://${host}`
}

function buildSiteUrl(id: string, req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const rootDomain = process.env.ROOT_DOMAIN ?? host
  return `${proto}://${id}.${rootDomain}`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const name = file.name.toLowerCase()
    if (!name.endsWith('.html') && !name.endsWith('.htm') && !name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .html and .zip files are supported' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 })
    }

    const id = genId()
    const siteDir = join(SITES_DIR, id)
    await mkdir(siteDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const homeUrl = getHomeUrl(request)

    if (name.endsWith('.zip')) {
      const { entries, stripPrefix } = extractZipFlattened(buffer)

      let hasIndex = false
      for (const entry of entries) {
        const relPath = entry.entryName.startsWith(stripPrefix)
          ? entry.entryName.slice(stripPrefix.length)
          : entry.entryName
        if (!relPath) continue

        const isIndex = relPath === 'index.html' || relPath === 'index.htm'
        if (isIndex) hasIndex = true

        const target = join(siteDir, relPath)
        await mkdir(dirname(target), { recursive: true })

        if (relPath.endsWith('.html') || relPath.endsWith('.htm')) {
          const html = entry.getData().toString('utf-8')
          await writeFile(target, injectWatermark(html, homeUrl))
        } else {
          await writeFile(target, entry.getData())
        }
      }

      if (!hasIndex) {
        return NextResponse.json({ error: 'No index.html found in the ZIP' }, { status: 400 })
      }
    } else {
      const html = buffer.toString('utf-8')
      await writeFile(join(siteDir, 'index.html'), injectWatermark(html, homeUrl))
    }

    const url = buildSiteUrl(id, request)
    const deployment = { id, name: file.name, url, createdAt: new Date().toISOString(), size: file.size }

    await addDeployment(deployment)
    return NextResponse.json(deployment)
  } catch (err) {
    console.error('[deploy]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
