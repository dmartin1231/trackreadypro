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

export async function POST(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 403 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email, role } = await request.json()
  if (!email || !role) return NextResponse.json({ error: 'Email and role required' }, { status: 400 })

  const admin = adminClient()

  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=/dashboard`
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { agency_id: profile.agency_id, role },
    redirectTo,
  })

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

  // Pre-create profile so the member shows in the team list immediately
  if (inviteData?.user?.id) {
    await admin.from('user_profiles').upsert({
      id: inviteData.user.id,
      agency_id: profile.agency_id,
      role,
      email,
    })
  }

  return NextResponse.json({ ok: true })
}
