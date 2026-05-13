# 🚀 Drop Deploy

Deploy HTML files and simple web projects instantly — drag, drop, get a URL.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Drop an `.html` or `.zip` file → get a live URL like `http://abc123.localhost:3000`.

---

## Subdomain URLs

Every deployment gets its own subdomain:

| Environment | URL format |
|-------------|-----------|
| Local dev | `http://{id}.localhost:3000` |
| Production | `https://{id}.yourdomain.com` |

### Local dev — enable `*.localhost` routing

Modern Chrome and Firefox resolve `*.localhost` natively. Just run `npm run dev` and the subdomains work automatically.

If your browser doesn't support it, add entries to `/etc/hosts`:
```
127.0.0.1  abc123.localhost
```

### Production

1. Add a **wildcard DNS record**: `*.yourdomain.com → your server IP`
2. Set the env var: `ROOT_DOMAIN=yourdomain.com`
3. Deploy to Railway / Render / any VPS (**not Vercel** — needs persistent filesystem)

```bash
ROOT_DOMAIN=yourdomain.com npm start
```

---

## REST API

### Deploy a file

```http
POST /api/deploy
Content-Type: multipart/form-data

file: <.html or .zip>
```

**Response:**
```json
{
  "id": "ab3x7k",
  "name": "form.html",
  "url": "http://ab3x7k.localhost:3000",
  "createdAt": "2026-05-13T17:00:00.000Z",
  "size": 2048
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/deploy -F "file=@project.zip"
```

### List deployments

```http
GET /api/sites
```

### Delete a deployment

```http
DELETE /api/sites/:id
```

---

## MCP Server — connect AI models

The MCP server lets Claude Desktop, Cursor, or any MCP-compatible AI deploy sites directly.

### Step 1 — Start both servers

```bash
# Terminal 1: the web app
npm run dev

# Terminal 2: the MCP server (stays running)
npm run mcp:http
```

### Step 2 — Configure Claude Desktop

The config file is already updated. Just **restart Claude Desktop** and look for the 🔌 icon.

If you need to set it manually, edit:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drop-deploy": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

> **Note:** Claude Desktop connects via URL (`url` key), not via command. This is the SSE transport — no need to spawn any process from the config file.

### Step 3 — Ask Claude to deploy

> "Create a to-do list in HTML and deploy it for me"

> "Build a landing page for my SaaS and give me the live link"

Claude will call `deploy_html` and return something like:
```
✅ Deployed!

URL: http://ab3x7k.localhost:3000
```

### Tools available

| Tool | What it does |
|------|-------------|
| `deploy_html` | AI passes HTML as a string → deployed instantly |
| `deploy_file` | Pass an absolute path to a `.html` or `.zip` file |

### Cursor config

Edit `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "drop-deploy": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DROP_DEPLOY_URL` | `http://localhost:3000` | URL of Drop Deploy app |
| `MCP_PORT` | `3001` | Port for the MCP HTTP server |

---

## Limits

| Item | Value |
|------|-------|
| Max file size | 20 MB |
| Formats | `.html` `.htm` `.zip` |
| ID length | 6 chars (36⁶ ≈ 2.1 B unique IDs) |
| History stored | 100 most recent |
