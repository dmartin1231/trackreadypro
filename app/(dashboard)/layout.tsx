import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.agency_id) redirect('/setup')

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', profile.agency_id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar agencyName={agency?.name ?? 'My Agency'} userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
