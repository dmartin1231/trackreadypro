/**
 * Creates the Supabase Storage bucket for certificate images.
 * Run once: npm run db:setup-storage
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: existing } = await supabase.storage.getBucket('certificates')
  if (existing) {
    console.log('✅ Storage bucket "certificates" already exists.')
    return
  }
  const { error } = await supabase.storage.createBucket('certificates', { public: true })
  if (error) {
    console.error('❌ Failed to create bucket:', error.message)
    process.exit(1)
  }
  console.log('✅ Storage bucket "certificates" created.')
}

main().catch(console.error)
