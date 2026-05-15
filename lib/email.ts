/**
 * lib/email.ts — send emails via Resend
 */
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? 'Drop Deploy <hello@dropdeploy.co>'

export async function sendWelcomeEmail(to: string): Promise<void> {
  if (!resend) { console.warn('[email] Resend not configured'); return }
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Drop Deploy 🚀',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Welcome to Drop Deploy</h1>
        <p style="color:#52525b">Your free account is ready. You have <strong>3 deploys/month</strong>.</p>
        <p style="color:#52525b">Each deploy expires in 48h. Upgrade to keep them permanent.</p>
        <a href="https://dropdeploy.co" style="display:inline-block;margin-top:16px;background:#09090b;color:#fff;padding:10px 20px;border-radius:100px;text-decoration:none;font-weight:600">
          Start deploying →
        </a>
      </div>
    `,
  })
}

export async function sendUpgradeConfirmationEmail(to: string, plan: string): Promise<void> {
  if (!resend) { console.warn('[email] Resend not configured'); return }
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're on Drop Deploy ${plan} ✅`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Plan activated: ${plan}</h1>
        <p style="color:#52525b">Your upgrade is live. Enjoy your new deploy limits.</p>
        <a href="https://dropdeploy.co" style="display:inline-block;margin-top:16px;background:#09090b;color:#fff;padding:10px 20px;border-radius:100px;text-decoration:none;font-weight:600">
          Deploy now →
        </a>
      </div>
    `,
  })
}
