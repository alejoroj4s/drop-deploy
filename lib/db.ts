/**
 * lib/db.ts
 * SQLite database for dev / small self-hosted deployments.
 * Swap to postgres by replacing the driver but keeping the same query helpers.
 */
import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'

const DATA_DIR = join(process.cwd(), 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = process.env.DATABASE_URL ?? join(DATA_DIR, 'drop-deploy.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

// ─── Schema ────────────────────────────────────────────────────────────────

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      email             TEXT UNIQUE NOT NULL,
      whatsapp          TEXT,
      plan              TEXT NOT NULL DEFAULT 'free',
      deploys_this_month INTEGER NOT NULL DEFAULT 0,
      month_reset_date  TEXT NOT NULL DEFAULT (date('now')),
      stripe_customer_id TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id      TEXT NOT NULL UNIQUE,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      url          TEXT NOT NULL,
      name         TEXT,
      expires_at   TEXT,
      is_permanent INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_site_id ON deployments(site_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_expires ON deployments(expires_at);
  `)
}

// ─── Plan limits ────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    deploysPerMonth: 3,
    expiresAfterHours: 48,
    permanent: false,
    branding: true,       // shows "Powered by Drop Deploy" banner
    description: '3 deploys/month · expires in 48h · with branding',
  },
  starter: {
    name: 'Starter',
    price: 7,
    deploysPerMonth: 20,
    expiresAfterHours: 7 * 24, // 7 days
    permanent: false,
    branding: false,
    description: '20 deploys/month · expires in 7 days · no branding',
  },
  pro: {
    name: 'Pro',
    price: 19,
    deploysPerMonth: Infinity,
    expiresAfterHours: null,
    permanent: true,
    branding: false,
    description: 'Unlimited · permanent · no branding · custom domain',
  },
  single: {
    name: 'Single',
    price: 3,
    deploysPerMonth: 1,
    expiresAfterHours: null,
    permanent: true,
    branding: false,
    description: '1 permanent deploy · no branding · one-time payment',
  },
} as const

export type PlanId = keyof typeof PLANS

// ─── User queries ────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  whatsapp: string | null
  plan: PlanId
  deploys_this_month: number
  month_reset_date: string
  stripe_customer_id: string | null
  created_at: string
}

export function getUserByEmail(email: string): User | null {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User | null
}

export function getUserById(id: number): User | null {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null
}

export function createUser(email: string, whatsapp?: string): User {
  const db = getDb()
  const info = db
    .prepare('INSERT INTO users (email, whatsapp) VALUES (?, ?)')
    .run(email, whatsapp ?? null)
  return getUserById(info.lastInsertRowid as number)!
}

export function updateUserPlan(userId: number, plan: PlanId, stripeCustomerId?: string): void {
  getDb()
    .prepare(
      'UPDATE users SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?'
    )
    .run(plan, stripeCustomerId ?? null, userId)
}

export function resetMonthlyCountIfNeeded(user: User): User {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const resetDate = user.month_reset_date

  // Reset if we're in a new month compared to reset date
  const reset = new Date(resetDate)
  const now = new Date(today)
  if (now.getFullYear() > reset.getFullYear() || now.getMonth() > reset.getMonth()) {
    getDb()
      .prepare(
        "UPDATE users SET deploys_this_month = 0, month_reset_date = ? WHERE id = ?"
      )
      .run(today, user.id)
    return getUserById(user.id)!
  }
  return user
}

export function incrementDeployCount(userId: number): void {
  getDb()
    .prepare('UPDATE users SET deploys_this_month = deploys_this_month + 1 WHERE id = ?')
    .run(userId)
}

export function getDeploysRemaining(user: User): number {
  const plan = PLANS[user.plan]
  if (plan.deploysPerMonth === Infinity) return Infinity
  return Math.max(0, plan.deploysPerMonth - user.deploys_this_month)
}

// ─── Deployment queries ──────────────────────────────────────────────────────

export interface Deployment {
  id: number
  site_id: string
  user_id: number | null
  url: string
  name: string | null
  expires_at: string | null
  is_permanent: number
  created_at: string
}

export function createDeployment(opts: {
  site_id: string
  user_id: number | null
  url: string
  name: string
  plan: PlanId
}): Deployment {
  const db = getDb()
  const planConfig = PLANS[opts.plan]

  let expires_at: string | null = null
  let is_permanent = 0

  if (planConfig.permanent) {
    is_permanent = 1
  } else if (planConfig.expiresAfterHours) {
    const exp = new Date(Date.now() + planConfig.expiresAfterHours * 60 * 60 * 1000)
    expires_at = exp.toISOString()
  }

  const info = db
    .prepare(
      `INSERT INTO deployments (site_id, user_id, url, name, expires_at, is_permanent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(opts.site_id, opts.user_id, opts.url, opts.name, expires_at, is_permanent)

  return db.prepare('SELECT * FROM deployments WHERE id = ?').get(info.lastInsertRowid) as Deployment
}

export function getExpiredDeployments(): Deployment[] {
  return getDb()
    .prepare(
      `SELECT * FROM deployments
       WHERE is_permanent = 0
         AND expires_at IS NOT NULL
         AND expires_at < datetime('now')`
    )
    .all() as Deployment[]
}

export function deleteDeployment(site_id: string): void {
  getDb().prepare('DELETE FROM deployments WHERE site_id = ?').run(site_id)
}

export function getDeploymentBySiteId(site_id: string): Deployment | null {
  return getDb()
    .prepare('SELECT * FROM deployments WHERE site_id = ?')
    .get(site_id) as Deployment | null
}
