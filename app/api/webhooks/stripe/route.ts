import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  async function updateAgency(agencyId: string, fields: Record<string, unknown>) {
    await supabaseAdmin.from('agencies').update(fields).eq('id', agencyId)
  }

  async function getAgencyByCustomer(customerId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('agencies').select('id').eq('stripe_customer_id', customerId).single()
    return data?.id ?? null
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const agencyId = session.metadata?.agency_id
      const planKey = session.metadata?.plan_key
      if (!agencyId || !planKey) break
      await updateAgency(agencyId, {
        stripe_subscription_id: session.subscription,
        plan_type: planKey,
        subscription_status: 'trialing',
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const agencyId = sub.metadata?.agency_id
        ?? await getAgencyByCustomer(sub.customer as string)
      if (!agencyId) break
      const planKey = sub.metadata?.plan_key ?? sub.items.data[0]?.price?.metadata?.plan_key
      await updateAgency(agencyId, {
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        ...(planKey ? { plan_type: planKey } : {}),
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const agencyId = sub.metadata?.agency_id
        ?? await getAgencyByCustomer(sub.customer as string)
      if (!agencyId) break
      await updateAgency(agencyId, {
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        plan_type: 'trial',
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const agencyId = await getAgencyByCustomer(invoice.customer as string)
      if (!agencyId) break
      await updateAgency(agencyId, { subscription_status: 'past_due' })
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const agencyId = await getAgencyByCustomer(invoice.customer as string)
      if (!agencyId) break
      await updateAgency(agencyId, { subscription_status: 'active' })
      break
    }
  }

  return NextResponse.json({ received: true })
}
