'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { dict, type Lang } from '@/lib/i18n'

interface Deployment { id: string; name: string; url: string; expiresAt?: string | null }
type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'
type Tab = 'drop' | 'ai'

const USER_KEY = 'dd_user'

interface StoredUser { user_id: number; email: string; plan: string }

function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') } catch { return null }
}
function saveUser(u: StoredUser) {
  if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(u))
}

// ─── SVG Brand ───────────────────────────────────────────────────────────────
const Logo = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" width="140" height="28" className={className}>
    <g transform="translate(4,4)">
      <line x1="16" y1="4" x2="10" y2="20" stroke="#09090b" strokeWidth="3" strokeLinecap="square" />
      <line x1="10" y1="4" x2="4" y2="20" stroke="#09090b" strokeWidth="3" strokeLinecap="square" />
      <rect x="18" y="16" width="4" height="4" fill="#09090b" />
    </g>
    <text x="36" y="22" fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" fontSize="18" fontWeight="700" letterSpacing="-0.04em" fill="#09090b">
      dropdeploy
    </text>
  </svg>
)

const Isotype = ({ size = 20, color = '#09090b' }: { size?: number; color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size}>
    <g transform="translate(4,4)">
      <line x1="16" y1="4" x2="10" y2="20" stroke={color} strokeWidth="3" strokeLinecap="square" />
      <line x1="10" y1="4" x2="4" y2="20" stroke={color} strokeWidth="3" strokeLinecap="square" />
      <rect x="18" y="16" width="4" height="4" fill={color} />
    </g>
  </svg>
)

// ─── Register Modal ───────────────────────────────────────────────────────────
function RegisterModal({
  t,
  onDone,
}: {
  t: typeof dict['en']
  onDone: (user: StoredUser) => void
}) {
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    if (whatsapp.trim().length < 7) { setError('Enter your WhatsApp number with country code'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), whatsapp: whatsapp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      const stored: StoredUser = { user_id: data.user_id, email: data.email, plan: data.plan }
      saveUser(stored)
      onDone(stored)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      setSubmitting(false)
    }
  }

  const r = t.register

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(9,9,11,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="glass w-full max-w-sm rounded-3xl p-8 slide-up"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Isotype size={18} color="#6366f1" />
          <span className="font-bold text-zinc-800 text-lg" style={{ letterSpacing: '-0.03em' }}>{r.title}</span>
        </div>
        <p className="text-zinc-400 text-xs mb-6" style={{ letterSpacing: '-0.01em' }}>{r.subtitle}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5" style={{ letterSpacing: '-0.01em' }}>
              {r.email_label}
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={r.email_placeholder}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 outline-none transition-all"
              style={{
                background: 'rgba(9,9,11,0.04)',
                border: '1.5px solid rgba(9,9,11,0.10)',
                letterSpacing: '-0.01em',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(9,9,11,0.10)')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5" style={{ letterSpacing: '-0.01em' }}>
              {r.whatsapp_label}
            </label>
            <input
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder={r.whatsapp_placeholder}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 outline-none transition-all"
              style={{
                background: 'rgba(9,9,11,0.04)',
                border: '1.5px solid rgba(9,9,11,0.10)',
                letterSpacing: '-0.01em',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(9,9,11,0.10)')}
            />
            <p className="mt-1.5 text-zinc-400 text-xs">{r.whatsapp_hint}</p>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
            style={{ opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? r.submitting : r.submit}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-100 space-y-1">
          <p className="text-center text-zinc-400 text-xs">{r.free_limits}</p>
          <p className="text-center text-zinc-300 text-xs">{r.disclaimer}</p>
        </div>
      </div>
    </div>
  )
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────
function AiTab({ t }: { t: typeof dict['en'] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://dropdeploy.co'
  const mcpUrl = `${baseUrl}/api/mcp`

  const mcpConfig = JSON.stringify(
    { mcpServers: { 'drop-deploy': { url: mcpUrl } } },
    null, 2
  )
  const aiPrompt = `You have access to Drop Deploy via MCP.

Whenever I ask you to create, build, or publish a web page:
1. Write the complete HTML
2. Deploy it automatically using the drop-deploy MCP tool (deploy_html)
3. Return the live URL — nothing else needed

MCP endpoint: ${mcpUrl}`

  const steps = [
    {
      key: 'claude',
      label: t.ai.claude_web_label,
      icon: '✦',
      desc: t.ai.claude_web_desc,
      value: mcpUrl,
    },
    {
      key: 'desktop',
      label: t.ai.desktop_label,
      icon: '⌘',
      desc: t.ai.desktop_desc,
      value: mcpConfig,
    },
    {
      key: 'prompt',
      label: t.ai.prompt_label,
      icon: '◆',
      desc: t.ai.prompt_desc,
      value: aiPrompt,
    },
  ]

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-center text-zinc-500 text-sm mb-6" style={{ letterSpacing: '-0.01em' }}>
        {t.ai.sub}
      </p>
      <div className="space-y-3">
        {steps.map((s) => (
          <div key={s.key} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-indigo-500 font-bold text-sm">{s.icon}</span>
                  <span className="font-semibold text-zinc-800 text-sm" style={{ letterSpacing: '-0.02em' }}>{s.label}</span>
                </div>
                <p className="text-zinc-400 text-xs" style={{ letterSpacing: '-0.01em' }}>{s.desc}</p>
              </div>
              <button
                className="btn-outline shrink-0"
                style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={() => copy(s.value, s.key)}
              >
                {copied === s.key ? t.ai.copied : t.ai.copy}
              </button>
            </div>
            <div
              className="rounded-xl px-3 py-2 font-mono text-xs text-zinc-500 truncate"
              style={{ background: 'rgba(9,9,11,0.04)', border: '1px solid rgba(9,9,11,0.07)' }}
            >
              {s.value.split('\n')[0]}{s.value.includes('\n') ? ' …' : ''}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-zinc-400 text-xs mt-5" style={{ letterSpacing: '-0.01em' }}>
        <em>{t.ai.hint}</em>
      </p>
    </div>
  )
}

// ─── Drop Tab ─────────────────────────────────────────────────────────────────
function DropTab({ t, user, onNeedRegister }: {
  t: typeof dict['en']
  user: StoredUser | null
  onNeedRegister: (file: File) => void
}) {
  const [state, setState] = useState<UploadState>('idle')
  const [deploy, setDeploy] = useState<Deployment | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const uploadFile = useCallback(async (file: File, currentUser: StoredUser | null) => {
    if (!currentUser) {
      onNeedRegister(file)
      return
    }
    setState('uploading')
    setErrorMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('user_id', String(currentUser.user_id))
    try {
      const res = await fetch('/api/deploy', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setDeploy(data)
      setState('done')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }, [onNeedRegister])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file, user)
  }, [uploadFile, user])

  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setState('dragging') }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setState('idle') }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) uploadFile(f, user)
    e.target.value = ''
  }

  const copyUrl = async () => {
    if (!deploy) return
    await navigator.clipboard.writeText(deploy.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => { setState('idle'); setDeploy(null); setErrorMsg(''); setCopied(false) }

  if (state === 'done' && deploy) {
    return (
      <div className="glass w-full max-w-md rounded-3xl p-8 slide-up">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t.success.status}
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-[180px]">{deploy.name}</span>
        </div>
        <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="url-display block mb-5 hover:opacity-80 transition-opacity">
          {deploy.url}
        </a>
        {deploy.expiresAt && (
          <p className="text-xs text-zinc-400 mb-4" style={{ letterSpacing: '-0.01em' }}>
            ⏱ Expires {new Date(deploy.expiresAt).toLocaleString()}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button className="btn-primary flex-1" onClick={copyUrl}>{copied ? t.success.copied : t.success.copy}</button>
          <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="btn-outline">{t.success.open}</a>
          <button className="btn-ghost" onClick={reset}>{t.success.newDeploy}</button>
        </div>
        <div className="mt-6 pt-5 flex items-center gap-2 border-t border-zinc-100">
          <Isotype size={14} color="#a1a1aa" />
          <span className="text-xs text-zinc-400" style={{ letterSpacing: '-0.01em' }}>{t.success.footer}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div
        className={`drop-zone cursor-pointer select-none${state === 'dragging' ? ' dragging' : ''}${state === 'uploading' ? ' pointer-events-none opacity-70' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={() => state === 'idle' && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".html,.htm,.zip" className="hidden" onChange={onFileChange} />
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-8">
          {state === 'uploading' ? (
            <>
              <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%' }} />
              <p className="text-sm font-medium text-zinc-500">{t.drop.deploying}</p>
            </>
          ) : state === 'dragging' ? (
            <>
              <div className="text-4xl mb-1">↓</div>
              <p className="font-semibold text-indigo-600 text-base" style={{ letterSpacing: '-0.02em' }}>{t.drop.release}</p>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(192,132,252,0.10))', border: '1px solid rgba(99,102,241,0.15)' }} />
                <Isotype size={28} color="#6366f1" />
              </div>
              <div className="text-center mt-1">
                <p className="font-semibold text-zinc-800 text-base mb-1" style={{ letterSpacing: '-0.02em' }}>{t.drop.title}</p>
                <p className="text-zinc-400 text-xs" style={{ letterSpacing: '-0.01em' }}>{t.drop.hint}</p>
              </div>
              <button className="btn-outline mt-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                {t.drop.browse}
              </button>
            </>
          )}
        </div>
      </div>

      {state === 'error' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-500">
          <span>{errorMsg}</span>
          <button onClick={reset} className="underline text-zinc-400 hover:text-zinc-600 transition-colors">{t.drop.error_retry}</button>
        </div>
      )}
      <p className="mt-6 text-center text-zinc-400 text-xs" style={{ letterSpacing: '-0.01em' }}>{t.drop.footer}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<Tab>('drop')
  const [user, setUser] = useState<StoredUser | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const t = dict[lang]

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const handleNeedRegister = (file: File) => {
    setPendingFile(file)
    setShowRegister(true)
  }

  const handleRegistered = (newUser: StoredUser) => {
    setUser(newUser)
    setShowRegister(false)
    // pendingFile will be picked up by DropTab via user state change
    // We trigger the upload by resetting pendingFile after user is set
  }

  // After registration, auto-upload the pending file
  const dropTabKey = useRef(0)
  const [triggerUpload, setTriggerUpload] = useState<{ file: File; user: StoredUser } | null>(null)

  const handleRegisteredAndUpload = (newUser: StoredUser) => {
    setUser(newUser)
    setShowRegister(false)
    if (pendingFile) {
      setTriggerUpload({ file: pendingFile, user: newUser })
      setPendingFile(null)
    }
  }

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">

      {showRegister && (
        <RegisterModal t={t} onDone={handleRegisteredAndUpload} />
      )}

      {/* Liquid blobs */}
      <div aria-hidden className="pointer-events-none select-none">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <div aria-hidden className="dot-grid" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(9,9,11,0.06)' }}>
        <a href="/" aria-label="Drop Deploy home"><Logo /></a>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-zinc-400 hidden sm:block" style={{ letterSpacing: '-0.01em' }}>
              {user.email}
            </span>
          )}
          <a href={lang === 'en' ? '/es' : '/en'}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
            style={{ letterSpacing: '-0.01em' }}>
            {lang === 'en' ? 'ES' : 'EN'}
          </a>
          <a href="/api/mcp" target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
            style={{ letterSpacing: '-0.01em' }} title="MCP API endpoint">
            {t.nav.mcp}
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-16 px-4">

        {/* Hero */}
        <div className="text-center mb-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-semibold tracking-wide text-indigo-600"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" style={{ animation: 'pulse 2s infinite' }} />
            {t.badge}
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 leading-[1.05] mb-4" style={{ letterSpacing: '-0.04em' }}>
            {t.hero.line1}{' '}<span className="grad-text">{t.hero.line2}</span><br />{t.hero.line3}
          </h1>
          <p className="text-zinc-500 text-base leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
            {t.hero.tagline}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-full mb-8"
          style={{ background: 'rgba(9,9,11,0.05)', border: '1px solid rgba(9,9,11,0.07)' }}>
          {(['drop', 'ai'] as const).map((id) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
              style={{
                letterSpacing: '-0.02em',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#09090b' : '#71717a',
                boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}>
              {id === 'drop' ? t.tabs.drop : t.tabs.ai}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'drop'
          ? <DropTabWithTrigger
              key={dropTabKey.current}
              t={t}
              user={user}
              onNeedRegister={handleNeedRegister}
              triggerUpload={triggerUpload}
              onTriggerConsumed={() => setTriggerUpload(null)}
            />
          : <AiTab t={t} />
        }

      </main>
    </div>
  )
}

// Wrapper that handles auto-upload after registration
function DropTabWithTrigger({
  t, user, onNeedRegister, triggerUpload, onTriggerConsumed,
}: {
  t: typeof dict['en']
  user: StoredUser | null
  onNeedRegister: (file: File) => void
  triggerUpload: { file: File; user: StoredUser } | null
  onTriggerConsumed: () => void
}) {
  const [state, setState] = useState<UploadState>('idle')
  const [deploy, setDeploy] = useState<Deployment | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const doUpload = useCallback(async (file: File, currentUser: StoredUser) => {
    setState('uploading')
    setErrorMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('user_id', String(currentUser.user_id))
    try {
      const res = await fetch('/api/deploy', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setDeploy(data)
      setState('done')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }, [])

  // Auto-upload when triggerUpload is set (after registration)
  useEffect(() => {
    if (triggerUpload) {
      onTriggerConsumed()
      doUpload(triggerUpload.file, triggerUpload.user)
    }
  }, [triggerUpload, doUpload, onTriggerConsumed])

  const uploadFile = useCallback((file: File) => {
    if (!user) { onNeedRegister(file); return }
    doUpload(file, user)
  }, [user, onNeedRegister, doUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setState('idle')
    const file = e.dataTransfer.files[0]; if (file) uploadFile(file)
  }, [uploadFile])
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setState('dragging') }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setState('idle') }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }
  const copyUrl = async () => { if (!deploy) return; await navigator.clipboard.writeText(deploy.url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const reset = () => { setState('idle'); setDeploy(null); setErrorMsg(''); setCopied(false) }

  if (state === 'done' && deploy) {
    return (
      <div className="glass w-full max-w-md rounded-3xl p-8 slide-up">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t.success.status}
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-[180px]">{deploy.name}</span>
        </div>
        <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="url-display block mb-5 hover:opacity-80 transition-opacity">
          {deploy.url}
        </a>
        {deploy.expiresAt && (
          <p className="text-xs text-zinc-400 mb-4" style={{ letterSpacing: '-0.01em' }}>
            ⏱ Expires {new Date(deploy.expiresAt).toLocaleString()}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button className="btn-primary flex-1" onClick={copyUrl}>{copied ? t.success.copied : t.success.copy}</button>
          <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="btn-outline">{t.success.open}</a>
          <button className="btn-ghost" onClick={reset}>{t.success.newDeploy}</button>
        </div>
        <div className="mt-6 pt-5 flex items-center gap-2 border-t border-zinc-100">
          <Isotype size={14} color="#a1a1aa" />
          <span className="text-xs text-zinc-400" style={{ letterSpacing: '-0.01em' }}>{t.success.footer}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div
        className={`drop-zone cursor-pointer select-none${state === 'dragging' ? ' dragging' : ''}${state === 'uploading' ? ' pointer-events-none opacity-70' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={() => state === 'idle' && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".html,.htm,.zip" className="hidden" onChange={onFileChange} />
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-8">
          {state === 'uploading' ? (
            <>
              <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%' }} />
              <p className="text-sm font-medium text-zinc-500">{t.drop.deploying}</p>
            </>
          ) : state === 'dragging' ? (
            <>
              <div className="text-4xl mb-1">↓</div>
              <p className="font-semibold text-indigo-600 text-base" style={{ letterSpacing: '-0.02em' }}>{t.drop.release}</p>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(192,132,252,0.10))', border: '1px solid rgba(99,102,241,0.15)' }} />
                <Isotype size={28} color="#6366f1" />
              </div>
              <div className="text-center mt-1">
                <p className="font-semibold text-zinc-800 text-base mb-1" style={{ letterSpacing: '-0.02em' }}>{t.drop.title}</p>
                <p className="text-zinc-400 text-xs" style={{ letterSpacing: '-0.01em' }}>{t.drop.hint}</p>
              </div>
              <button className="btn-outline mt-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                {t.drop.browse}
              </button>
            </>
          )}
        </div>
      </div>

      {state === 'error' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-500">
          <span>{errorMsg}</span>
          <button onClick={reset} className="underline text-zinc-400 hover:text-zinc-600 transition-colors">{t.drop.error_retry}</button>
        </div>
      )}
      <p className="mt-6 text-center text-zinc-400 text-xs" style={{ letterSpacing: '-0.01em' }}>{t.drop.footer}</p>
    </div>
  )
}
