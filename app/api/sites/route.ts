import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const DEPLOYMENTS_FILE = join(process.cwd(), 'data', 'deployments.json')

export async function GET() {
  try {
    const data = await readFile(DEPLOYMENTS_FILE, 'utf-8')
    return NextResponse.json(JSON.parse(data))
  } catch {
    return NextResponse.json([])
  }
}
