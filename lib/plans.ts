export type PlanKey = 'starter' | 'professional' | 'agency' | 'enterprise'

export const PLANS: Record<PlanKey, {
  name: string
  price: number
  maxEmployees: number
  priceId: string
  features: string[]
}> = {
  starter: {
    name: 'Starter',
    price: 49,
    maxEmployees: 15,
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    features: ['Up to 15 employees', 'Training log & records', 'Certificate uploads', 'Expiration alerts', 'Compliance reports'],
  },
  professional: {
    name: 'Professional',
    price: 99,
    maxEmployees: 50,
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    features: ['Up to 50 employees', 'Everything in Starter', 'Bulk CSV import', 'Custom training periods', 'Team members (2 users)'],
  },
  agency: {
    name: 'Agency',
    price: 149,
    maxEmployees: 150,
    priceId: process.env.STRIPE_PRICE_AGENCY ?? '',
    features: ['Up to 150 employees', 'Everything in Professional', 'Unlimited team members', 'Advanced reports', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 249,
    maxEmployees: Infinity,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    features: ['Unlimited employees', 'Everything in Agency', 'Dedicated onboarding', 'Custom integrations', 'SLA support'],
  },
}

export const PLAN_ORDER: PlanKey[] = ['starter', 'professional', 'agency', 'enterprise']

export function getPlanMaxEmployees(planType: string | null | undefined): number {
  if (!planType || planType === 'trial') return 15 // trial = starter limits
  return PLANS[planType as PlanKey]?.maxEmployees ?? 15
}

export function getPlanName(planType: string | null | undefined): string {
  if (!planType || planType === 'trial') return 'Free Trial'
  return PLANS[planType as PlanKey]?.name ?? 'Unknown'
}
