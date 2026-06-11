import { NextResponse } from 'next/server'
import { requireSuperAdmin, adminDb } from '../_auth'
import { startOfMonth, subMonths } from 'date-fns'

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const db = adminDb()
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalAgencies },
    { count: activeAgencies },
    { count: trialAgencies },
    { count: canceledAgencies },
    { count: newThisMonth },
    { count: newThisWeek },
    { count: totalEmployees },
    { count: totalRecords },
  ] = await Promise.all([
    db.from('agencies').select('id', { count: 'exact', head: true }),
    db.from('agencies').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    db.from('agencies').select('id', { count: 'exact', head: true }).eq('plan_type', 'trial'),
    db.from('agencies').select('id', { count: 'exact', head: true }).eq('subscription_status', 'canceled'),
    db.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    db.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', weekStart),
    db.from('employees').select('id', { count: 'exact', head: true }),
    db.from('training_records').select('id', { count: 'exact', head: true }),
  ])

  // Trial to paid conversion: active / (active + canceled) if > 0
  const converted = activeAgencies ?? 0
  const churned = canceledAgencies ?? 0
  const conversionRate = (converted + churned) > 0
    ? Math.round((converted / (converted + churned)) * 100)
    : 0

  // Trials expiring in 3 days
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: expiringTrials } = await db
    .from('agencies')
    .select('id, name, trial_ends_at')
    .eq('plan_type', 'trial')
    .lte('trial_ends_at', threeDaysOut)
    .gte('trial_ends_at', now.toISOString())

  return NextResponse.json({
    totalAgencies: totalAgencies ?? 0,
    activeAgencies: activeAgencies ?? 0,
    trialAgencies: trialAgencies ?? 0,
    canceledAgencies: canceledAgencies ?? 0,
    newThisMonth: newThisMonth ?? 0,
    newThisWeek: newThisWeek ?? 0,
    totalEmployees: totalEmployees ?? 0,
    totalRecords: totalRecords ?? 0,
    conversionRate,
    expiringTrials: expiringTrials ?? [],
  })
}
