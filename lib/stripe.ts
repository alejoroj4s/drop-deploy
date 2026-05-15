import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — payments disabled')
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
  : null

// Price IDs pre-created in Stripe dashboard (set in .env)
export const STRIPE_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  single: process.env.STRIPE_PRICE_SINGLE,
}

export async function createCheckoutSession(opts: {
  user_id: number
  plan: 'starter' | 'pro' | 'single'
  customer_id?: string
  success_url: string
  cancel_url: string
}) {
  if (!stripe) throw new Error('Stripe not configured')

  const price_id = STRIPE_PRICES[opts.plan]
  if (!price_id) throw new Error(`No Stripe price configured for plan: ${opts.plan}`)

  const mode = opts.plan === 'single' ? 'payment' : 'subscription'

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: price_id, quantity: 1 }],
    customer: opts.customer_id,
    customer_email: opts.customer_id ? undefined : undefined,
    metadata: { user_id: String(opts.user_id), plan: opts.plan },
    success_url: opts.success_url,
    cancel_url: opts.cancel_url,
  })

  return session
}
