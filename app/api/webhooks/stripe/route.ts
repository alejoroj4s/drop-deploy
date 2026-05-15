import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getUserById, updateUserPlan, type PlanId } from '@/lib/db'
import { sendUpgradeConfirmationEmail } from '@/lib/email'
import { sendUpgradeWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[webhook/stripe] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id, 10) : null
    const planId = session.metadata?.plan as PlanId | undefined

    if (userId && planId) {
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : undefined
      updateUserPlan(userId, planId, stripeCustomerId)

      const user = getUserById(userId)
      if (user) {
        const planName = planId.charAt(0).toUpperCase() + planId.slice(1)
        sendUpgradeConfirmationEmail(user.email, planName).catch(console.error)
        if (user.whatsapp) sendUpgradeWhatsApp(user.whatsapp, planName).catch(console.error)
      }
    }
  }

  return NextResponse.json({ received: true })
}
