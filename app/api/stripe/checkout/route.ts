import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { PLANS, type PlanKey } from '@/lib/plans'

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

  const { planKey } = await request.json() as { planKey: PlanKey }
  const plan = PLANS[planKey]
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const { data: profile } = await supabase
    .from('user_profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) return NextResponse.json({ error: 'No agency' }, { status: 400 })

  const { data: agency } = await supabase
    .from('agencies').select('*').eq('id', profile.agency_id).single()
  if (!agency) return NextResponse.json({ error: 'Agency not found' }, { status: 400 })

  // Create or retrieve Stripe customer
  let customerId: string = agency.stripe_customer_id ?? ''
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { agency_id: agency.id, agency_name: agency.name },
    })
    customerId = customer.id
    await supabase.from('agencies').update({ stripe_customer_id: customerId }).eq('id', agency.id)
  }

  const origin = request.nextUrl.origin
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 15,
      metadata: { agency_id: agency.id, plan_key: planKey },
    },
    metadata: { agency_id: agency.id, plan_key: planKey },
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
