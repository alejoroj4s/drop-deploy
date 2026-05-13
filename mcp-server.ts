#!/usr/bin/env node
/**
 * Drop Deploy — MCP Server
 *
 * Exposes two tools to AI models (Claude Desktop, Cursor, etc.):
 *   • deploy_html  → deploy HTML content passed as a string
 *   • deploy_file  → deploy a local .html or .zip file by path
 *
 * Usage: node mcp-server.js  (or: npm run mcp)
 * Env:   DROP_DEPLOY_URL  (default: http://localhost:3000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import FormData from 'form-data'
import { readFile } from 'fs/promises'
import { createReadStream } from 'fs'
import { basename } from 'path'
import http from 'http'
import https from 'https'
import { URL } from 'url'

const DEPLOY_URL = process.env.DROP_DEPLOY_URL ?? 'http://localhost:3000'

// ------- minimal fetch using http/https (no extra deps) -------
function httpRequest(
  url: string,
  form: FormData,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http
    const headers = form.getHeaders()

    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString())
            resolve({ ok: (res.statusCode ?? 500) < 300, status: res.statusCode ?? 0, data })
          } catch {
            reject(new Error('Invalid JSON response'))
          }
        })
      },
    )
    req.on('error', reject)
    form.pipe(req)
  })
}

// ------- MCP Server -------
const server = new Server(
  { name: 'drop-deploy', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'deploy_html',
      description:
        'Deploy an HTML string directly to Drop Deploy and return a live public URL. ' +
        'Use this when you have generated HTML content and want to share it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          html: {
            type: 'string',
            description: 'The full HTML content to deploy',
          },
          filename: {
            type: 'string',
            description: 'Optional filename shown in logs (default: index.html)',
          },
        },
        required: ['html'],
      },
    },
    {
      name: 'deploy_file',
      description:
        'Deploy a local .html or .zip file to Drop Deploy and return a live public URL.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the .html or .zip file on this machine',
          },
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
      const filename = a.filename ?? 'index.html'
      form.append('file', Buffer.from(a.html), { filename, contentType: 'text/html' })
    } else if (name === 'deploy_file') {
      if (!a.path) throw new Error('path is required')
      const filename = basename(a.path)
      // Read file into buffer (handles large ZIPs too)
      const buf = await readFile(a.path)
      form.append('file', buf, { filename })
    } else {
      throw new Error(`Unknown tool: ${name}`)
    }

    const { ok, data } = await httpRequest(`${DEPLOY_URL}/api/deploy`, form)

    if (!ok) {
      const err = (data as { error?: string }).error ?? 'Deploy failed'
      return {
        content: [{ type: 'text', text: `❌ Error: ${err}` }],
        isError: true,
      }
    }

    const d = data as { url: string; id: string; name: string }
    return {
      content: [
        {
          type: 'text',
          text: `✅ Deployed successfully!\n\nURL: ${d.url}\nID:  ${d.id}\nFile: ${d.name}`,
        },
      ],
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `❌ Error: ${msg}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()

async function main() {
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server failed:', err)
  process.exit(1)
})
