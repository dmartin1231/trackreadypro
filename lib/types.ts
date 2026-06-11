export type Agency = {
  id: string
  name: string
  required_hours: number
  training_period: 'calendar_year' | 'hire_date' | 'fiscal_year' | 'license_renewal'
  fiscal_year_start_month: number  // 1–12
  created_at: string
  // Stripe billing
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan_type: 'trial' | 'starter' | 'professional' | 'agency' | 'enterprise' | null
  trial_ends_at: string | null
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | null
}

export type Employee = {
  id: string
  agency_id: string
  name: string
  employee_number: string | null
  hire_date: string | null
  employee_type: 'employee' | 'admin'
  created_at: string
}

export type Course = {
  id: string
  agency_id: string
  name: string
  credit_hours: number
  expires_years: number | null // null = never expires
  created_at: string
}

export type TrainingRecord = {
  id: string
  agency_id: string
  employee_id: string
  course_id: string
  completed_date: string
  hours: number
  certificate_url: string | null
  created_at: string
  // joined
  employee?: Employee
  course?: Course
}

export type UserProfile = {
  id: string
  agency_id: string | null
  role: string
  created_at: string
}

export type ExpirationStatus = 'expired' | 'expiring_30' | 'expiring_60' | 'valid' | 'never'

export type TrainingRecordWithStatus = TrainingRecord & {
  expiration_date: string | null
  expiration_status: ExpirationStatus
}

export type TrainingAssignment = {
  id: string
  agency_id: string
  employee_id: string
  course_id: string
  assigned_date: string
  due_date: string
  notes: string | null
  created_at: string
  employee?: Employee
  course?: Course
}

export type EmployeeCompliance = {
  employee: Employee
  hours_ytd: number
  required_hours: number
  percent: number
  is_compliant: boolean
  expiring_certs: number
}
