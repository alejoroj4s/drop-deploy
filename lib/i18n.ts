export const SUPPORTED_LANGS = ['en', 'es'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

export function isValidLang(lang: string): lang is Lang {
  return SUPPORTED_LANGS.includes(lang as Lang)
}

type DictShape = {
  meta: { title: string; titleShort: string; description: string; keywords: string }
  badge: string
  hero: { line1: string; line2: string; line3: string; tagline: string }
  tabs: { drop: string; ai: string }
  drop: { title: string; hint: string; browse: string; deploying: string; release: string; footer: string; error_retry: string }
  success: { status: string; copy: string; copied: string; open: string; newDeploy: string; footer: string }
  ai: { heading: string; sub: string; claude_web_label: string; claude_web_desc: string; claude_web_action: string; desktop_label: string; desktop_desc: string; desktop_action: string; prompt_label: string; prompt_desc: string; prompt_action: string; copy: string; copied: string; hint: string }
  nav: { mcp: string }
}

export const dict: Record<Lang, DictShape> = {
  en: {
    meta: {
      title: 'Drop Deploy — Instant HTML Hosting & AI Deploy Tool',
      titleShort: 'Drop Deploy',
      description:
        'Deploy HTML files and ZIP projects in seconds with drag & drop. Get a live URL instantly — no signup, no config. Built for AI assistants via MCP.',
      keywords:
        'html hosting, instant deploy, drag drop html, free html host, ai deploy, mcp deploy, chatgpt deploy website, claude deploy html, html to url, zip deploy, no signup hosting',
    },
    badge: 'instant deploy',
    hero: {
      line1: 'Drop.',
      line2: 'Deploy.',
      line3: 'Done.',
      tagline:
        'Upload an HTML file or ZIP project and get a live URL in seconds — no login required.',
    },
    tabs: {
      drop: '↓ Drop a file',
      ai: '✦ Use with AI',
    },
    drop: {
      title: 'Drop your file here',
      hint: '.html · .htm · .zip — up to 20 MB',
      browse: 'Browse files',
      deploying: 'Deploying…',
      release: 'Release to deploy',
      footer: 'Files are served on a unique subdomain — share with anyone',
      error_retry: 'retry',
    },
    success: {
      status: 'deployed',
      copy: 'copy url',
      copied: 'copied ✓',
      open: 'open ↗',
      newDeploy: 'new',
      footer: 'dropdeploy — instant HTML hosting',
    },
    ai: {
      heading: 'Connect your AI assistant',
      sub: 'Copy the right config for your tool and start deploying with a single prompt.',
      claude_web_label: 'Claude.ai',
      claude_web_desc: 'Settings → Integrations → Add integration',
      claude_web_action: 'Paste this URL',
      desktop_label: 'Claude Desktop · Cursor · Windsurf · Zed',
      desktop_desc: 'Add to your MCP config file',
      desktop_action: 'Copy JSON config',
      prompt_label: 'ChatGPT · Gemini · any AI chat',
      prompt_desc: 'Paste as system prompt or first message',
      prompt_action: 'Copy prompt',
      copy: 'copy',
      copied: '✓ copied',
      hint: 'Once connected, say "build me a landing page and deploy it"',
    },
    nav: {
      mcp: 'MCP',
    },
  },
  es: {
    meta: {
      title: 'Drop Deploy — Hosting HTML Instantáneo y Deploy con IA',
      titleShort: 'Drop Deploy',
      description:
        'Despliega archivos HTML y proyectos ZIP en segundos con drag & drop. Obtén una URL en vivo al instante — sin registro, sin configuración. Compatible con asistentes IA vía MCP.',
      keywords:
        'hosting html gratis, desplegar html, drag drop html, subir html url, deploy ia, mcp deploy, chatgpt desplegar web, claude html, hosting instantáneo, zip deploy gratis',
    },
    badge: 'deploy instantáneo',
    hero: {
      line1: 'Sube.',
      line2: 'Despliega.',
      line3: 'Listo.',
      tagline:
        'Sube un archivo HTML o proyecto ZIP y obtén una URL en vivo en segundos — sin registro.',
    },
    tabs: {
      drop: '↓ Sube un archivo',
      ai: '✦ Usar con IA',
    },
    drop: {
      title: 'Suelta tu archivo aquí',
      hint: '.html · .htm · .zip — hasta 20 MB',
      browse: 'Explorar archivos',
      deploying: 'Desplegando…',
      release: 'Suelta para desplegar',
      footer: 'Los archivos se sirven en un subdominio único — comparte con cualquiera',
      error_retry: 'reintentar',
    },
    success: {
      status: 'desplegado',
      copy: 'copiar url',
      copied: 'copiado ✓',
      open: 'abrir ↗',
      newDeploy: 'nuevo',
      footer: 'dropdeploy — hosting HTML instantáneo',
    },
    ai: {
      heading: 'Conecta tu asistente IA',
      sub: 'Copia la configuración para tu herramienta y empieza a desplegar con un solo mensaje.',
      claude_web_label: 'Claude.ai',
      claude_web_desc: 'Ajustes → Integraciones → Agregar integración',
      claude_web_action: 'Pega esta URL',
      desktop_label: 'Claude Desktop · Cursor · Windsurf · Zed',
      desktop_desc: 'Agrega a tu archivo de configuración MCP',
      desktop_action: 'Copiar config JSON',
      prompt_label: 'ChatGPT · Gemini · cualquier chat IA',
      prompt_desc: 'Pega como system prompt o primer mensaje',
      prompt_action: 'Copiar prompt',
      copy: 'copiar',
      copied: '✓ copiado',
      hint: 'Una vez conectado, di "crea una página web y despliégala"',
    },
    nav: {
      mcp: 'MCP',
    },
  },
} 
