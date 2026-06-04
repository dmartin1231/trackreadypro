/**
 * ClearPath — Migration Runner
 *
 * Applies all pending SQL migrations in supabase/migrations/ in order.
 * Tracks which have run in a local .migrations file.
 *
 * Usage:
 *   npm run db:migrate
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')
const APPLIED_FILE = resolve(process.cwd(), 'supabase/.applied_migrations')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

async function runSQL(sql: string): Promise<void> {
  // Supabase exposes a direct Postgres query endpoint for service-role callers
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    // Fallback: try the pg endpoint (available on Pro plans)
    const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    if (!res2.ok) {
      const text = await res2.text()
      throw new Error(text)
    }
  }
}

async function migrate() {
  const applied = existsSync(APPLIED_FILE)
    ? new Set(readFileSync(APPLIED_FILE, 'utf8').split('\n').filter(Boolean))
    : new Set<string>()

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('✅ No pending migrations.')
    return
  }

  console.log(`Found ${pending.length} pending migration(s):\n`)

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`  Running ${file}…`)
    try {
      await runSQL(sql)
      applied.add(file)
      writeFileSync(APPLIED_FILE, [...applied].join('\n') + '\n')
      console.log(`  ✅ ${file} applied`)
    } catch (err: any) {
      console.error(`  ❌ ${file} failed:`, err.message)
      console.error('\n  Run this SQL manually in the Supabase SQL Editor:')
      console.error('\n' + sql)
      process.exit(1)
    }
  }

  console.log('\n🎉 All migrations applied.')
}

migrate().catch(console.error)
