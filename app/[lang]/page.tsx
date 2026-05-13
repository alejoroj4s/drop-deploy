import { notFound } from 'next/navigation'
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n'
import HomePage from '@/components/home-page'

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }))
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isValidLang(lang)) notFound()
  return <HomePage lang={lang} />
}
