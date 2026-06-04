import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { agencyName, requiredHours, accessToken } = await request.json()

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Service role client bypasses RLS — safe here since we verify the user first
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the user's token is valid
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (!user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  // Create agency
  const { data: agency, error: agencyErr } = await adminClient
    .from('agencies')
    .insert({ name: agencyName.trim(), required_hours: Number(requiredHours) })
    .select()
    .single()

  if (agencyErr) {
    return NextResponse.json({ error: agencyErr.message }, { status: 400 })
  }

  // Link user to agency
  const { error: profileErr } = await adminClient
    .from('user_profiles')
    .upsert({ id: user.id, agency_id: agency.id, role: 'admin' })

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
