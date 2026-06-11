import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, adminDb } from '../_auth'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { action, agencyId, ...params } = await request.json()
  const db = adminDb()

  switch (action) {
    case 'extend_trial': {
      const { days } = params as { days: number }
      const { data: agency } = await db.from('agencies').select('trial_ends_at').eq('id', agencyId).single()
      const base = agency?.trial_ends_at ? new Date(agency.trial_ends_at) : new Date()
      if (base < new Date()) base.setTime(Date.now())
      base.setDate(base.getDate() + (days ?? 7))
      await db.from('agencies').update({ trial_ends_at: base.toISOString(), subscription_status: 'trialing' }).eq('id', agencyId)
      return NextResponse.json({ ok: true, newDate: base.toISOString() })
    }

    case 'change_plan': {
      const { planType } = params as { planType: string }
      await db.from('agencies').update({ plan_type: planType }).eq('id', agencyId)
      return NextResponse.json({ ok: true })
    }

    case 'suspend': {
      await db.from('agencies').update({ subscription_status: 'canceled' }).eq('id', agencyId)
      return NextResponse.json({ ok: true })
    }

    case 'unsuspend': {
      await db.from('agencies').update({ subscription_status: 'active' }).eq('id', agencyId)
      return NextResponse.json({ ok: true })
    }

    case 'delete': {
      await db.from('training_records').delete().eq('agency_id', agencyId)
      await db.from('employees').delete().eq('agency_id', agencyId)
      await db.from('courses').delete().eq('agency_id', agencyId)
      await db.from('user_profiles').delete().eq('agency_id', agencyId)
      await db.from('agencies').delete().eq('id', agencyId)
      return NextResponse.json({ ok: true })
    }

    case 'apply_coupon': {
      const { couponId, customerId } = params as { couponId: string; customerId: string }
      if (!customerId) return NextResponse.json({ error: 'No Stripe customer for this agency' }, { status: 400 })
      await stripe.customers.update(customerId, { discount: { coupon: couponId } } as any)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
