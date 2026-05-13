/**
 * Drop Deploy — Remote MCP Server (Streamable HTTP / JSON-RPC 2.0)
 *
 * Connect any MCP-compatible AI to this endpoint:
 *   Claude.ai  → Settings → Integrations → Add: https://yourdomain.com/api/mcp
 *   Claude Desktop → "url": "https://yourdomain.com/api/mcp"
 *   Cursor / Windsurf → MCP server URL setting
 */
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, writeFile as writeJson } from 'fs/promises'
import { join, dirname } from 'path'
import { customAlphabet } from 'nanoid'
import AdmZip from 'adm-zip'
import { injectWatermark } from '@/utils/watermark'

const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)
const DEPLOYMENTS_FILE = join(process.cwd(), 'data', 'deployments.json')
const SITES_DIR = join(process.cwd(), 'public', 'sites')

// ─── MCP Tool definitions ────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'deploy_html',
    description:
      'Deploy an HTML string as a live public website. Returns a unique URL instantly. Use this whenever the user wants to publish or share an HTML page.',
    inputSchema: {
      type: 'object',
      properties: {
        html: {
          type: 'string',
          description: 'Complete HTML content (the full file, including <!DOCTYPE html>)',
        },
        name: {
          type: 'string',
          description: 'Optional filename label, e.g. "landing-page.html"',
        },
      },
      required: ['html'],
    },
  },
  {
    name: 'deploy_zip',
    description:
      'Deploy a multi-file project from a base64-encoded ZIP. The ZIP must contain an index.html at its root (or inside a single top-level folder). Returns the live URL.',
    inputSchema: {
      type: 'object',
      properties: {
        zip_base64: {
          type: 'string',
          description: 'Base64-encoded ZIP file contents',
        },
        name: {
          type: 'string',
          description: 'Optional project name label',
        },
      },
      required: ['zip_base64'],
    },
  },
]

// ─── Helpers (shared with /api/deploy) ───────────────────────────────────────

async function addDeployment(deployment: object) {
  try {
    const list = JSON.parse(await readFile(DEPLOYMENTS_FILE, 'utf-8'))
    list.unshift(deployment)
    await writeJson(DEPLOYMENTS_FILE, JSON.stringify(list.slice(0, 100), null, 2))
  } catch {
    await writeJson(DEPLOYMENTS_FILE, JSON.stringify([deployment], null, 2))
  }
}

function getHomeUrl(req: NextRequest): string {
  const rootDomain = process.env.ROOT_DOMAIN
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host = req.headers.get('host') ?? 'localhost:3000'
  if (rootDomain) return `${proto}://${rootDomain}`
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

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function toolDeployHtml(
  args: { html: string; name?: string },
  req: NextRequest
): Promise<string> {
  const id = genId()
  const siteDir = join(SITES_DIR, id)
  await mkdir(siteDir, { recursive: true })
  const homeUrl = getHomeUrl(req)
  await writeFile(join(siteDir, 'index.html'), injectWatermark(args.html, homeUrl), 'utf-8')
  const url = buildSiteUrl(id, req)
  await addDeployment({ id, name: args.name ?? 'untitled.html', url, createdAt: new Date().toISOString() })
  return url
}

async function toolDeployZip(
  args: { zip_base64: string; name?: string },
  req: NextRequest
): Promise<string> {
  const id = genId()
  const siteDir = join(SITES_DIR, id)
  await mkdir(siteDir, { recursive: true })
  const homeUrl = getHomeUrl(req)
  const buffer = Buffer.from(args.zip_base64, 'base64')
  const { entries, stripPrefix } = extractZipFlattened(buffer)

  let hasIndex = false
  for (const entry of entries) {
    const relPath = entry.entryName.startsWith(stripPrefix)
      ? entry.entryName.slice(stripPrefix.length)
      : entry.entryName
    if (!relPath) continue
    if (relPath === 'index.html' || relPath === 'index.htm') hasIndex = true
    const target = join(siteDir, relPath)
    await mkdir(dirname(target), { recursive: true })
    if (relPath.endsWith('.html') || relPath.endsWith('.htm')) {
      await writeFile(target, injectWatermark(entry.getData().toString('utf-8'), homeUrl))
    } else {
      await writeFile(target, entry.getData())
    }
  }

  if (!hasIndex) throw new Error('No index.html found in the ZIP')
  const url = buildSiteUrl(id, req)
  await addDeployment({ id, name: args.name ?? 'project.zip', url, createdAt: new Date().toISOString() })
  return url
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function ok(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

function err(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

// ─── Handle a single JSON-RPC message ────────────────────────────────────────

async function handleMessage(msg: { id?: unknown; method: string; params?: unknown }, req: NextRequest) {
  const { id = null, method, params } = msg

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'drop-deploy', version: '1.0.0' },
        capabilities: { tools: {} },
      })

    case 'ping':
      return ok(id, {})

    case 'notifications/initialized':
      return null // notification — no response

    case 'tools/list':
      return ok(id, { tools: TOOLS })

    case 'tools/call': {
      const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> }
      try {
        let url: string
        if (name === 'deploy_html') {
          url = await toolDeployHtml(args as { html: string; name?: string }, req)
        } else if (name === 'deploy_zip') {
          url = await toolDeployZip(args as { zip_base64: string; name?: string }, req)
        } else {
          return err(id, -32601, `Unknown tool: ${name}`)
        }
        return ok(id, {
          content: [{ type: 'text', text: `✅ Deployed!\n\nURL: ${url}\n\nThe site is live and publicly accessible.` }],
        })
      } catch (e) {
        return ok(id, {
          content: [{ type: 'text', text: `❌ Deploy failed: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        })
      }
    }

    default:
      return err(id, -32601, `Method not found: ${method}`)
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err(null, -32700, 'Parse error'), { status: 400 })
  }

  // Batch request
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((msg) => handleMessage(msg, req))
    )
    const filtered = results.filter(Boolean)
    return NextResponse.json(filtered)
  }

  // Single request
  const result = await handleMessage(body as { method: string; id?: unknown; params?: unknown }, req)
  if (result === null) return new NextResponse(null, { status: 204 })
  return NextResponse.json(result)
}

// GET — rich metadata for LLM/AI discovery and human browsers
export async function GET(req: NextRequest) {
  const base = req.headers.get('host')
    ? `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`
    : 'https://dropdeploy.co'

  const response = NextResponse.json({
    service: 'drop-deploy',
    name: 'Drop Deploy MCP Server',
    version: '1.0.0',
    description:
      'Instant HTML & ZIP hosting MCP server. Deploy web pages created by AI assistants and get a live URL immediately. No authentication required.',
    protocol: 'Model Context Protocol (MCP) — JSON-RPC 2.0 Streamable HTTP',
    endpoint: `${base}/api/mcp`,
    homepage: base,
    docs: `${base}/llms.txt`,
    manifest: `${base}/.well-known/mcp.json`,
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      required: t.inputSchema.required,
    })),
    usage: {
      claude_ai: `Settings → Integrations → Add → ${base}/api/mcp`,
      claude_desktop: { mcpServers: { 'drop-deploy': { url: `${base}/api/mcp` } } },
      cursor_windsurf: `Add MCP server URL: ${base}/api/mcp`,
    },
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'deploy_html',
          arguments: {
            html: '<!DOCTYPE html><html><body><h1>Hello from AI!</h1></body></html>',
            name: 'hello.html',
          },
        },
      },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: `✅ Deployed!\n\nURL: ${base.replace('://', '://abc123.')}\n\nThe site is live and publicly accessible.` }],
        },
      },
    },
  })

  // CORS headers so any AI/browser can call this
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
