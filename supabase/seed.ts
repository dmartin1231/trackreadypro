/**
 * ClearPath — North Star Oregon Seed Script
 *
 * Usage:
 *   1. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 *   2. Create your admin account via /setup
 *   3. Run: npm run db:seed
 *
 * The script uses the service role key so it can bypass RLS.
 * Set SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit this).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const AGENCY_NAME = 'North Star Oregon'

async function seed() {
  console.log('🌱 Seeding ClearPath for North Star Oregon…\n')

  // Find the agency
  const { data: agency, error: agencyErr } = await supabase
    .from('agencies')
    .select('id, name')
    .eq('name', AGENCY_NAME)
    .single()

  if (agencyErr || !agency) {
    console.error(`Agency "${AGENCY_NAME}" not found. Create it via /setup first.`)
    console.error(agencyErr?.message)
    process.exit(1)
  }

  console.log(`✅ Found agency: ${agency.name} (${agency.id})`)

  // ─── Courses ──────────────────────────────────────────────

  const courseData = [
    { name: 'Orientation',                         credit_hours: 6,    expires_years: null },
    { name: 'CPR / First Aid',                     credit_hours: 2,    expires_years: 1    },
    { name: 'Tier 1',                              credit_hours: 6,    expires_years: 2    },
    { name: 'Tier 2',                              credit_hours: 6,    expires_years: 2    },
    { name: 'MR for Adults & Children',            credit_hours: 1.5,  expires_years: 1    },
    { name: 'RMP Training',                        credit_hours: 0.25, expires_years: 1    },
    { name: 'Imp Training',                        credit_hours: 0.25, expires_years: 1    },
    { name: 'PSA',                                 credit_hours: 0.25, expires_years: 1    },
    { name: 'MARS / OIS / BSP / Incident Policy',  credit_hours: 2,    expires_years: 1    },
  ]

  const { data: courses, error: courseErr } = await supabase
    .from('courses')
    .insert(courseData.map((c) => ({ ...c, agency_id: agency.id })))
    .select()

  if (courseErr) {
    console.error('Course insert failed:', courseErr.message)
    process.exit(1)
  }

  console.log(`✅ Inserted ${courses?.length ?? 0} courses`)

  // ─── Employees ────────────────────────────────────────────

  const employeeData = [
    { name: 'Maria Garcia',  employee_number: 'EMP001', hire_date: '2023-01-15' },
    { name: 'James Wilson',  employee_number: 'EMP002', hire_date: '2023-03-01' },
    { name: 'Sarah Chen',    employee_number: 'EMP003', hire_date: '2022-11-20' },
    { name: 'Michael Brown', employee_number: 'EMP004', hire_date: '2024-01-08' },
    { name: 'Emily Davis',   employee_number: 'EMP005', hire_date: '2023-07-12' },
  ]

  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .insert(employeeData.map((e) => ({ ...e, agency_id: agency.id })))
    .select()

  if (empErr) {
    console.error('Employee insert failed:', empErr.message)
    process.exit(1)
  }

  console.log(`✅ Inserted ${employees?.length ?? 0} employees`)

  // ─── Training Records ─────────────────────────────────────

  const courseMap = Object.fromEntries((courses ?? []).map((c) => [c.name, c]))
  const empMap    = Object.fromEntries((employees ?? []).map((e) => [e.name, e]))

  const today = new Date()
  const thisYear = today.getFullYear()

  function date(monthsAgo: number): string {
    const d = new Date(today)
    d.setMonth(d.getMonth() - monthsAgo)
    return d.toISOString().split('T')[0]
  }

  const recordData = [
    // Maria — fully compliant, several certs
    { emp: 'Maria Garcia', course: 'Orientation',                        completed: date(18) },
    { emp: 'Maria Garcia', course: 'CPR / First Aid',                    completed: date(10) },
    { emp: 'Maria Garcia', course: 'Tier 1',                             completed: date(14) },
    { emp: 'Maria Garcia', course: 'MR for Adults & Children',           completed: date(2)  },
    { emp: 'Maria Garcia', course: 'RMP Training',                       completed: date(1)  },
    { emp: 'Maria Garcia', course: 'PSA',                                completed: date(1)  },
    // James — partially compliant
    { emp: 'James Wilson', course: 'Orientation',                        completed: date(20) },
    { emp: 'James Wilson', course: 'CPR / First Aid',                    completed: date(13) },
    { emp: 'James Wilson', course: 'Tier 1',                             completed: date(9)  },
    // Sarah — has an expired cert
    { emp: 'Sarah Chen',   course: 'Orientation',                        completed: date(24) },
    { emp: 'Sarah Chen',   course: 'CPR / First Aid',                    completed: date(15) },
    { emp: 'Sarah Chen',   course: 'Tier 1',                             completed: date(22) },
    { emp: 'Sarah Chen',   course: 'Tier 2',                             completed: date(6)  },
    { emp: 'Sarah Chen',   course: 'MR for Adults & Children',           completed: date(0)  },
    { emp: 'Sarah Chen',   course: 'MARS / OIS / BSP / Incident Policy', completed: date(3)  },
    // Michael — new hire, just starting
    { emp: 'Michael Brown', course: 'Orientation',                       completed: date(1)  },
    // Emily — compliant this year
    { emp: 'Emily Davis',  course: 'Orientation',                        completed: date(10) },
    { emp: 'Emily Davis',  course: 'CPR / First Aid',                    completed: date(8)  },
    { emp: 'Emily Davis',  course: 'Tier 1',                             completed: date(5)  },
    { emp: 'Emily Davis',  course: 'MR for Adults & Children',           completed: date(2)  },
    { emp: 'Emily Davis',  course: 'Imp Training',                       completed: date(1)  },
  ]

  const records = recordData
    .map((r) => {
      const emp    = empMap[r.emp]
      const course = courseMap[r.course]
      if (!emp || !course) {
        console.warn(`⚠️  Skipping record: ${r.emp} / ${r.course}`)
        return null
      }
      return {
        agency_id:      agency.id,
        employee_id:    emp.id,
        course_id:      course.id,
        completed_date: r.completed,
        hours:          course.credit_hours,
      }
    })
    .filter(Boolean)

  const { error: recErr } = await supabase.from('training_records').insert(records)

  if (recErr) {
    console.error('Record insert failed:', recErr.message)
    process.exit(1)
  }

  console.log(`✅ Inserted ${records.length} training records`)
  console.log('\n🎉 Seed complete! Visit /dashboard to see the data.')
}

seed().catch(console.error)
