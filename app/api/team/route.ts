import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getCallerProfile() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: CookieOptions }[]) =>
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles').select('agency_id, role').eq('id', user.id).single()
  return profile ? { ...profile, userId: user.id } : null
}

export async function GET() {
  const caller = await getCallerProfile()
  if (!caller?.agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data: members } = await admin
    .from('user_profiles')
    .select('id, email, role')
    .eq('agency_id', caller.agency_id)
    .order('role')

  return NextResponse.json({ members: members ?? [] })
}

export async function DELETE(request: NextRequest) {
  const caller = await getCallerProfile()
  if (!caller?.agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  if (memberId === caller.userId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const admin = adminClient()
  await admin.from('user_profiles').delete().eq('id', memberId).eq('agency_id', caller.agency_id)
  await admin.auth.admin.deleteUser(memberId)

  return NextResponse.json({ ok: true })
}
