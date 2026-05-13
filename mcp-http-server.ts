#!/usr/bin/env node
/**
 * Drop Deploy — MCP HTTP Server (SSE transport)
 *
 * GET  http://localhost:3001/sse     ← Claude Desktop connects here
 * POST http://localhost:3001/message ← messages (handled automatically)
 * GET  http://localhost:3001/health  ← health check
 *
 * Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
 *   { "mcpServers": { "drop-deploy": { "url": "http://localhost:3001/sse" } } }
 *
 * Env: DROP_DEPLOY_URL  (default: http://localhost:3000)
 *      MCP_PORT         (default: 3001)
 */

import http, { IncomingMessage, ServerResponse } from 'http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import FormData from 'form-data'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import https from 'https'
import { URL } from 'url'

const DEPLOY_URL = process.env.DROP_DEPLOY_URL ?? 'http://localhost:3000'
const PORT = Number(process.env.MCP_PORT ?? 3001)

// ─── deploy helper ───────────────────────────────────────────────────────────

function postForm(url: string, form: FormData): Promise<{ ok: boolean; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: form.getHeaders(),
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve({ ok: (res.statusCode ?? 500) < 300, data: JSON.parse(Buffer.concat(chunks).toString()) })
          } catch {
            reject(new Error('Invalid JSON from Deploy API'))
          }
        })
      },
    )
    req.on('error', reject)
    form.pipe(req)
  })
}

// ─── MCP server factory (one instance per SSE connection) ────────────────────

function createMcpServer() {
  const server = new Server(
    { name: 'drop-deploy', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'deploy_html',
        description:
          'Deploy HTML content to Drop Deploy and return a live public URL. ' +
          'Use this whenever you generate HTML that the user wants to share or preview.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            html: { type: 'string', description: 'Full HTML content to deploy' },
            filename: { type: 'string', description: 'Optional filename (default: index.html)' },
          },
          required: ['html'],
        },
      },
      {
        name: 'deploy_file',
        description: 'Deploy a local .html or .zip file and return a live public URL.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Absolute path to the .html or .zip file' },
          },
          required: ['path'],
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const a = args as Record<string, string>
    try {
      const form = new FormData()
      if (name === 'deploy_html') {
        if (!a.html) throw new Error('html is required')
        form.append('file', Buffer.from(a.html), {
          filename: a.filename ?? 'index.html',
          contentType: 'text/html',
        })
      } else if (name === 'deploy_file') {
        if (!a.path) throw new Error('path is required')
        form.append('file', await readFile(a.path), { filename: basename(a.path) })
      } else {
        throw new Error(`Unknown tool: ${name}`)
      }

      const { ok, data } = await postForm(`${DEPLOY_URL}/api/deploy`, form)
      if (!ok) {
        const err = (data as { error?: string }).error ?? 'Deploy failed'
        return { content: [{ type: 'text', text: `❌ ${err}` }], isError: true }
      }
      const d = data as { url: string; id: string }
      return { content: [{ type: 'text', text: `✅ Deployed!\n\nURL: ${d.url}` }] }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text', text: `❌ ${msg}` }], isError: true }
    }
  })

  return server
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const transports = new Map<string, SSEServerTransport>()

const httpServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // SSE endpoint — Claude Desktop connects here
  if (req.method === 'GET' && url.pathname === '/sse') {
    const transport = new SSEServerTransport('/message', res)
    const server = createMcpServer()
    transports.set(transport.sessionId, transport)
    req.on('close', () => transports.delete(transport.sessionId))
    await server.connect(transport)
    return
  }

  // Message endpoint — Claude posts JSON-RPC here
  if (req.method === 'POST' && url.pathname === '/message') {
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const transport = transports.get(sessionId)
    if (!transport) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }
    await transport.handlePostMessage(req, res)
    return
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, activeSessions: transports.size }))
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ server: 'drop-deploy-mcp', endpoints: ['GET /sse', 'GET /health'] }))
})

httpServer.listen(PORT, () => {
  console.log(`\n🔌 Drop Deploy MCP  →  http://localhost:${PORT}/sse\n`)
  console.log('Paste this into:')
  console.log('  ~/Library/Application Support/Claude/claude_desktop_config.json\n')
  console.log(JSON.stringify(
    { mcpServers: { 'drop-deploy': { url: `http://localhost:${PORT}/sse` } } },
    null, 2,
  ))
  console.log(`\nDeploy API: ${DEPLOY_URL}`)
})

process.on('SIGINT', () => { httpServer.close(); process.exit(0) })
process.on('SIGTERM', () => { httpServer.close(); process.exit(0) })
