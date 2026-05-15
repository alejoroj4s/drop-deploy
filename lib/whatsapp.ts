/**
 * lib/whatsapp.ts — Evolution API integration for WhatsApp messaging
 */

const BASE_URL = process.env.EVOLUTION_API_URL     // e.g. https://evo.yourserver.com
const API_KEY  = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE    // WhatsApp instance name

function isConfigured() {
  return BASE_URL && API_KEY && INSTANCE
}

async function sendMessage(phone: string, text: string): Promise<void> {
  if (!isConfigured()) {
    console.warn('[whatsapp] Evolution API not configured — skipping message to', phone)
    return
  }

  // Normalize phone: strip non-digits, ensure country code
  const normalized = phone.replace(/\D/g, '')

  const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY!,
    },
    body: JSON.stringify({
      number: normalized,
      text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[whatsapp] Send failed:', res.status, body)
  }
}

export async function sendWelcomeWhatsApp(phone: string, email: string): Promise<void> {
  await sendMessage(
    phone,
    `👋 Welcome to *Drop Deploy*!\n\nYour free account (${email}) is ready.\n\n✅ 3 deploys/month\n⏱ 48h expiration\n\nUpgrade at https://dropdeploy.co to get permanent deploys.`
  )
}

export async function sendUpgradeWhatsApp(phone: string, plan: string): Promise<void> {
  await sendMessage(
    phone,
    `🎉 *Drop Deploy ${plan}* activated!\n\nYour plan is now live. Enjoy your new limits.\n\nhttps://dropdeploy.co`
  )
}
