import { NextResponse } from 'next/server'
import { requireSuperAdmin, adminDb } from '../_auth'
import { stripe } from '@/lib/stripe'
import { startOfMonth, subMonths, format } from 'date-fns'

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const now = new Date()

    // Get active subscriptions from Supabase (Stripe API not available during build)
    const db = adminDb()
    const { data: agencies } = await db
      .from('agencies')
      .select('plan_type, subscription_status, stripe_subscription_id')
      .eq('subscription_status', 'active')

    // Calculate MRR from plan prices
    const planPrices: Record<string, number> = {
      starter: 49, professional: 99, agency: 149, enterprise: 249,
    }
    let mrr = 0
    agencies?.forEach(a => {
      if (a.plan_type && planPrices[a.plan_type]) mrr += planPrices[a.plan_type]
    })
    const arr = mrr * 12

    // Get last 12 months from Stripe charges if key is configured
    const months: Array<{ month: string; revenue: number }> = []
    const isStripeConfigured = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_')

    if (isStripeConfigured && !process.env.STRIPE_SECRET_KEY?.includes('REPLACE_ME')) {
      for (let i = 11; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i))
        const monthEnd = startOfMonth(subMonths(now, i - 1))
        const charges = await stripe.charges.list({
          created: { gte: Math.floor(monthStart.getTime() / 1000), lt: Math.floor(monthEnd.getTime() / 1000) },
          limit: 100,
        })
        const revenue = charges.data
          .filter(c => c.paid && !c.refunded)
          .reduce((sum, c) => sum + c.amount / 100, 0)
        months.push({ month: format(monthStart, 'MMM yyyy'), revenue })
      }

      // This month vs last month
      const thisMonth = months[months.length - 1]?.revenue ?? 0
      const lastMonth = months[months.length - 2]?.revenue ?? 0
      const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0

      // Failed payments this month
      const failedCharges = await stripe.charges.list({
        created: { gte: Math.floor(startOfMonth(now).getTime() / 1000) },
        limit: 100,
      })
      const failedThisMonth = failedCharges.data.filter(c => !c.paid).length

      return NextResponse.json({ mrr, arr, months, thisMonth, lastMonth, change, failedThisMonth })
    }

    // Fallback when Stripe not configured — return DB-derived data only
    for (let i = 11; i >= 0; i--) {
      months.push({ month: format(subMonths(now, i), 'MMM yyyy'), revenue: 0 })
    }
    return NextResponse.json({ mrr, arr, months, thisMonth: mrr, lastMonth: 0, change: 0, failedThisMonth: 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
