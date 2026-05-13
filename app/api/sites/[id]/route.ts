import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, rm } from 'fs/promises'
import { join } from 'path'

const DEPLOYMENTS_FILE = join(process.cwd(), 'data', 'deployments.json')
const SITES_DIR = join(process.cwd(), 'public', 'sites')

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    // Remove site files
    await rm(join(SITES_DIR, id), { recursive: true, force: true })

    // Remove from deployments list
    const data = await readFile(DEPLOYMENTS_FILE, 'utf-8')
    const list = JSON.parse(data).filter((d: { id: string }) => d.id !== id)
    await writeFile(DEPLOYMENTS_FILE, JSON.stringify(list, null, 2))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
