import { NextRequest, NextResponse } from 'next/server'
import {
  getUserByEmail,
  createUser,
  getDeploysRemaining,
  resetMonthlyCountIfNeeded,
  getDb,
} from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email, whatsapp } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!whatsapp || whatsapp.trim().length < 7) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    let user = getUserByEmail(email)
    const isNew = !user

    if (isNew) {
      user = createUser(email, whatsapp.trim())
      sendWelcomeEmail(email).catch(console.error)
    } else {
      // Update whatsapp if not set or changed
      if (user && whatsapp.trim() && user.whatsapp !== whatsapp.trim()) {
        getDb().prepare('UPDATE users SET whatsapp = ? WHERE id = ?').run(whatsapp.trim(), user.id)
        user = getUserByEmail(email)!
      }
    }

    const refreshed = resetMonthlyCountIfNeeded(user!)
    const remaining = getDeploysRemaining(refreshed)

    return NextResponse.json({
      user_id: refreshed.id,
      email: refreshed.email,
      plan: refreshed.plan,
      deploys_remaining: remaining === Infinity ? null : remaining,
      is_new: isNew,
    })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
