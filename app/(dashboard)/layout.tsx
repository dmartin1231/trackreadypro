import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import { RoleProvider } from '@/components/role-provider'
import TrialBanner from '@/components/trial-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('user_profiles')
    .select('agency_id, role, email')
    .eq('id', user.id)
    .single()

  // First-time login for an invited user: create their profile from invite metadata
  if (!profile?.agency_id) {
    const meta = user.user_metadata as Record<string, string> | null
    if (meta?.agency_id) {
      await supabase.from('user_profiles').upsert({
        id: user.id,
        agency_id: meta.agency_id,
        role: meta.role ?? 'viewer',
        email: user.email ?? null,
      })
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('agency_id, role, email')
        .eq('id', user.id)
        .single()
      profile = newProfile
    } else {
      redirect('/setup')
    }
  }

  // Sync email into profile if missing
  if (profile && !profile.email && user.email) {
    await supabase
      .from('user_profiles')
      .update({ email: user.email })
      .eq('id', user.id)
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('name, plan_type, trial_ends_at, subscription_status')
    .eq('id', profile!.agency_id)
    .single()

  const role = profile?.role ?? 'viewer'

  return (
    <RoleProvider role={role}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar
          agencyName={agency?.name ?? 'My Agency'}
          userEmail={user.email ?? ''}
          role={role}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TrialBanner
            trialEndsAt={agency?.trial_ends_at ?? null}
            planType={agency?.plan_type ?? null}
            subscriptionStatus={agency?.subscription_status ?? null}
          />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  )
}
