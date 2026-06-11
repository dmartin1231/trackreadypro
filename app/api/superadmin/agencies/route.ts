import { NextResponse } from 'next/server'
import { requireSuperAdmin, adminDb } from '../_auth'

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const db = adminDb()

  const { data: agencies } = await db
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false })

  if (!agencies) return NextResponse.json({ agencies: [] })

  // Get employee and record counts per agency
  const [{ data: empCounts }, { data: recCounts }] = await Promise.all([
    db.from('employees').select('agency_id').in('agency_id', agencies.map(a => a.id)),
    db.from('training_records').select('agency_id').in('agency_id', agencies.map(a => a.id)),
  ])

  const empMap: Record<string, number> = {}
  const recMap: Record<string, number> = {}
  empCounts?.forEach(e => { empMap[e.agency_id] = (empMap[e.agency_id] ?? 0) + 1 })
  recCounts?.forEach(r => { recMap[r.agency_id] = (recMap[r.agency_id] ?? 0) + 1 })

  // Get owner email per agency from user_profiles
  const { data: profiles } = await db
    .from('user_profiles')
    .select('agency_id, email, role')
    .in('agency_id', agencies.map(a => a.id))
    .eq('role', 'admin')

  const ownerMap: Record<string, string> = {}
  profiles?.forEach(p => { if (p.email && !ownerMap[p.agency_id]) ownerMap[p.agency_id] = p.email })

  const enriched = agencies.map(a => ({
    ...a,
    employee_count: empMap[a.id] ?? 0,
    record_count: recMap[a.id] ?? 0,
    owner_email: ownerMap[a.id] ?? '—',
  }))

  return NextResponse.json({ agencies: enriched })
}
