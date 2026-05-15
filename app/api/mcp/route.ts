/**
 * Drop Deploy — Remote MCP Server (Streamable HTTP / JSON-RPC 2.0)
 *
 * Connect any MCP-compatible AI to this endpoint:
 *   Claude.ai  → Settings → Integrations → Add: https://yourdomain.com/api/mcp
 *   Claude Desktop → "url": "https://yourdomain.com/api/mcp"
 *   Cursor / Windsurf → MCP server URL setting
 */
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { customAlphabet } from 'nanoid'
import AdmZip from 'adm-zip'
import { injectWatermark } from '@/utils/watermark'
import { injectFreeBanner } from '@/utils/banner'
import {
  createDeployment,
  getUserByEmail,
  createUser,
  getDeploysRemaining,
  incrementDeployCount,
  resetMonthlyCountIfNeeded,
  PLANS,
  type PlanId,
} from '@/lib/db'
import { createCheckoutSession } from '@/lib/stripe'
import { sendWelcomeEmail } from '@/lib/email'
import { sendWelcomeWhatsApp } from '@/lib/whatsapp'

const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)
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
        user_id: {
          type: 'number',
          description: 'Optional user ID (obtained from register_user). Used to track plan limits.',
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
        user_id: {
          type: 'number',
          description: 'Optional user ID (obtained from register_user). Used to track plan limits.',
        },
      },
      required: ['zip_base64'],
    },
  },
  {
    name: 'register_user',
    description:
      'Register or retrieve a Drop Deploy user account. Call this before deploying if you want to track usage and plan limits. Returns user_id, current plan, and deploys remaining.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'User email address',
        },
        whatsapp: {
          type: 'string',
          description: 'Optional WhatsApp phone number (with country code, e.g. +15551234567)',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'get_plans',
    description:
      'Get all available Drop Deploy pricing plans with limits, prices, and features. Call this to show the user upgrade options.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_checkout',
    description:
      'Create a Stripe checkout session for upgrading a user plan. Returns a checkout_url to redirect the user to. Requires a user_id from register_user.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'User ID from register_user',
        },
        plan_id: {
          type: 'string',
          enum: ['starter', 'pro', 'single'],
          description: 'Plan to upgrade to: starter ($7/month), pro ($19/month), single ($3 one-time)',
        },
      },
      required: ['user_id', 'plan_id'],
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  args: { html: string; name?: string; user_id?: number },
  req: NextRequest
): Promise<string> {
  const id = genId()
  const siteDir = join(SITES_DIR, id)
  await mkdir(siteDir, { recursive: true })
  const homeUrl = getHomeUrl(req)

  let plan: PlanId = 'free'
  let userId: number | null = null

  if (args.user_id) {
    const { getUserById } = await import('@/lib/db')
    let user = getUserById(args.user_id)
    if (user) {
      user = resetMonthlyCountIfNeeded(user)
      const remaining = getDeploysRemaining(user)
      if (remaining <= 0) throw new Error(`Deploy limit reached for your ${user.plan} plan. Upgrade to continue.`)
      userId = user.id
      plan = user.plan as PlanId
    }
  }

  const planConfig = PLANS[plan]
  const html = planConfig.branding ? injectFreeBanner(args.html, homeUrl) : injectWatermark(args.html, homeUrl)
  await writeFile(join(siteDir, 'index.html'), html, 'utf-8')

  const url = buildSiteUrl(id, req)
  createDeployment({ site_id: id, user_id: userId, url, name: args.name ?? 'untitled.html', plan })
  if (userId) incrementDeployCount(userId)
  return url
}

async function toolDeployZip(
  args: { zip_base64: string; name?: string; user_id?: number },
  req: NextRequest
): Promise<string> {
  const id = genId()
  const siteDir = join(SITES_DIR, id)
  await mkdir(siteDir, { recursive: true })
  const homeUrl = getHomeUrl(req)

  let plan: PlanId = 'free'
  let userId: number | null = null

  if (args.user_id) {
    const { getUserById } = await import('@/lib/db')
    let user = getUserById(args.user_id)
    if (user) {
      user = resetMonthlyCountIfNeeded(user)
      const remaining = getDeploysRemaining(user)
      if (remaining <= 0) throw new Error(`Deploy limit reached for your ${user.plan} plan. Upgrade to continue.`)
      userId = user.id
      plan = user.plan as PlanId
    }
  }

  const planConfig = PLANS[plan]
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
      const html = entry.getData().toString('utf-8')
      await writeFile(target, planConfig.branding ? injectFreeBanner(html, homeUrl) : injectWatermark(html, homeUrl))
    } else {
      await writeFile(target, entry.getData())
    }
  }

  if (!hasIndex) throw new Error('No index.html found in the ZIP')
  const url = buildSiteUrl(id, req)
  createDeployment({ site_id: id, user_id: userId, url, name: args.name ?? 'project.zip', plan })
  if (userId) incrementDeployCount(userId)
  return url
}

async function toolRegisterUser(args: { email: string; whatsapp?: string }): Promise<object> {
  if (!args.email || !args.email.includes('@')) throw new Error('Valid email required')

  let user = getUserByEmail(args.email)
  const isNew = !user

  if (isNew) {
    user = createUser(args.email, args.whatsapp)
    // Fire-and-forget notifications (don't block response)
    sendWelcomeEmail(args.email).catch(console.error)
    if (args.whatsapp) sendWelcomeWhatsApp(args.whatsapp, args.email).catch(console.error)
  } else if (args.whatsapp && user && !user.whatsapp) {
    // Update whatsapp if not set
    const { getDb } = await import('@/lib/db')
    getDb().prepare('UPDATE users SET whatsapp = ? WHERE id = ?').run(args.whatsapp, user.id)
    user = getUserByEmail(args.email)!
  }

  const refreshed = resetMonthlyCountIfNeeded(user!)
  const remaining = getDeploysRemaining(refreshed)

  return {
    user_id: refreshed.id,
    email: refreshed.email,
    plan: refreshed.plan,
    deploys_remaining: remaining === Infinity ? 'unlimited' : remaining,
    message: isNew
      ? `Welcome! Free account created with 3 deploys/month. Each deploy expires in 48h.`
      : `Welcome back! You have ${remaining === Infinity ? 'unlimited' : remaining} deploys remaining this month.`,
  }
}

function toolGetPlans(): object[] {
  return Object.entries(PLANS).map(([id, p]) => ({
    id,
    name: p.name,
    price_usd: p.price,
    price_label: p.price === 0 ? 'Free' : id === 'single' ? `$${p.price} one-time` : `$${p.price}/month`,
    deploys_per_month: p.deploysPerMonth === Infinity ? 'unlimited' : p.deploysPerMonth,
    expiration: p.expiresAfterHours
      ? `${p.expiresAfterHours}h`
      : p.permanent
      ? 'permanent'
      : 'none',
    branding: p.branding,
    description: p.description,
  }))
}

async function toolCreateCheckout(
  args: { user_id: number; plan_id: string },
  req: NextRequest
): Promise<object> {
  const base = getHomeUrl(req)
  const validPlans = ['starter', 'pro', 'single'] as const
  if (!validPlans.includes(args.plan_id as (typeof validPlans)[number])) {
    throw new Error(`Invalid plan_id. Must be one of: ${validPlans.join(', ')}`)
  }

  const { getUserById } = await import('@/lib/db')
  const user = getUserById(args.user_id)
  if (!user) throw new Error(`User not found. Call register_user first.`)

  const plan = args.plan_id as 'starter' | 'pro' | 'single'
  const session = await createCheckoutSession({
    user_id: args.user_id,
    plan,
    customer_id: user.stripe_customer_id ?? undefined,
    success_url: `${base}/success?plan=${plan}`,
    cancel_url: `${base}/en`,
  })

  const planConfig = PLANS[plan]
  return {
    checkout_url: session.url,
    amount: planConfig.price,
    plan_name: planConfig.name,
    plan_id: plan,
  }
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
        let resultText: string

        if (name === 'deploy_html') {
          const url = await toolDeployHtml(args as { html: string; name?: string; user_id?: number }, req)
          resultText = `Deployed!\n\nURL: ${url}\n\nThe site is live and publicly accessible.`
        } else if (name === 'deploy_zip') {
          const url = await toolDeployZip(args as { zip_base64: string; name?: string; user_id?: number }, req)
          resultText = `Deployed!\n\nURL: ${url}\n\nThe site is live and publicly accessible.`
        } else if (name === 'register_user') {
          const result = await toolRegisterUser(args as { email: string; whatsapp?: string })
          resultText = JSON.stringify(result, null, 2)
        } else if (name === 'get_plans') {
          const plans = toolGetPlans()
          resultText = JSON.stringify(plans, null, 2)
        } else if (name === 'create_checkout') {
          const result = await toolCreateCheckout(args as { user_id: number; plan_id: string }, req)
          resultText = JSON.stringify(result, null, 2)
        } else {
          return err(id, -32601, `Unknown tool: ${name}`)
        }

        return ok(id, {
          content: [{ type: 'text', text: resultText }],
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
      required: (t.inputSchema as { required?: string[] }).required ?? [],
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
