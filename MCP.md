# Drop  MCP Connection GuideDeploy 

El servidor MCP est integrado directamente en la app en `/api/mcp`.

**URL del MCP:**
- Local: `http://localhost:3000/api/mcp`
- Produccinnn: `https://TU_DOMINIO/api/mcp`

---

## Claude.ai (web)

1. Abre [claude.ai](https://claude.ai)
 Integrations**
3. Clic en **Add integration**
4. Pega la URL: `https://TU_DOMINIO/api/mcp`
5. Nombre: `Drop Deploy`
6  en el chat verListos el  . ono de herramientas

---

## Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "drop-deploy": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

Reinicia Claude Desktop.

---

## Cursor / Windsurf / Zed

Busca "MCP Servers" en la configuracinnn y agrega:

```json
{
  "name": "drop-deploy",
  "url": "http://localhost:3000/api/mcp"
}
```

---

## ChatGPT (Custom GPT)

ChatGPT no soporta MCP nativamente. Usa este **System Prompt** para que el modelo llame la API directamente:

```
Tienes acceso a Drop Deploy para publicar sitios web.

Para desplegar HTML, haz un POST a https://TU_DOMINIO/api/mcp con:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "deploy_html",
    "arguments": {
      "html": "<contenido HTML completo>",
      "name": "nombre-archivo.html"
    }
  }
}

La respuesta incluir la URL del sitio publicado. Comprtela con el usuario.
```

---

## Herramientas disponibles

### `deploy_html`
Publica un string HTML como sitio web.

```json
{
  "name": "deploy_html",
  "arguments": {
    "html": "<!DOCTYPE html>...",
    "name": "mi-sitio.html"
  }
}
```

### `deploy_zip`
Publica un proyecto ZIP (base64-encoded) con `index.html` en la ra.

```json
{
  "name": "deploy_zip",
  "arguments": {
    "zip_base64": "UEsDB...",
    "name": "mi-proyecto"
  }
}
```

---

## Prompt para usar con cualquier IA

Pega esto en cualquier chat para que la IA sepa que puede desplegar:

```
Tienes la herramienta drop-deploy disponible.
Cuando el usuario pida crear o publicar una pgina web, 
crea el HTML y despligalo automticamente usando el MCP 
endpoint en https://TU_DOMINIO/api/mcp.
Siempre devuelve la URL del sitio publicado.
```
