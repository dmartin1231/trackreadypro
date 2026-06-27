import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

// Fuzzy column matching — checks if the header contains or equals any pattern
function matchColumn(header: string, patterns: string[]): boolean {
  const h = header.toLowerCase().trim()
  return patterns.some(p => h === p || h.includes(p))
}

function findColumn(headers: string[], patterns: string[]): string | null {
  return headers.find(h => matchColumn(h, patterns)) ?? null
}

const COLUMNS = {
  // NOTE: bare 'employee' and bare 'name' are intentionally excluded:
  //   'employee' matches 'Employee ID' (a number column)
  //   'name' matches 'Course Name', causing course names to be stored as employees
  employee_name: [
    'employee name', 'full name', 'staff name', 'worker name', 'person name',
    'staff', 'worker',
  ],
  employee_number: [
    'employee id', 'emp id', 'employee #', 'emp #', 'badge', 'employee number',
    'id number', 'staff id',
  ],
  hire_date: ['hire date', 'start date', 'date hired', 'hired date', 'date of hire'],
  course_name: [
    'course name', 'course', 'training name', 'training', 'class name', 'class',
    'certification', 'program',
  ],
  completed_date: [
    'completion date', 'completed date', 'date completed', 'finish date',
    'date finished', 'completed', 'completion',
  ],
  hours: ['credit hours', 'course length', 'hours', 'hrs', 'credits', 'duration', 'length'],
  // Note: bare 'expiration'/'expiry' intentionally excluded — they match 'Expiration Date' (a date column)
  expires_years: [
    'expiration years', 'expires years', 'expiry years', 'renewal years',
    'expiration (years)', 'expires (years)', 'expiry (years)',
  ],
}

function toDateString(value: unknown): string | null {
  if (value == null || value === '') return null

  // Date object (xlsx with cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }

  // Excel serial date number
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      }
    } catch { /* ignore */ }
    return null
  }

  const str = String(value).trim()
  if (!str) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // MM/DD/YYYY or M/D/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`

  // MM/DD/YY
  const mdyShort = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (mdyShort) {
    const year = parseInt(mdyShort[3]) > 50 ? `19${mdyShort[3]}` : `20${mdyShort[3]}`
    return `${year}-${mdyShort[1].padStart(2, '0')}-${mdyShort[2].padStart(2, '0')}`
  }

  // Fallback to native Date parse
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  return null
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return isNaN(n) ? null : n
}

function toStr(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

const AI_SYSTEM_PROMPT = `You are a training record extraction assistant for an employee compliance tracker.
Extract all employee training records from the document provided and return ONLY valid JSON.

Return this exact structure:
{
  "records": [
    {
      "employee_name": "Full Name",
      "employee_number": "optional ID or null",
      "hire_date": "YYYY-MM-DD or null",
      "course_name": "Course / Certification Name",
      "completed_date": "YYYY-MM-DD",
      "hours": 1.0
    }
  ]
}

Rules:
- completed_date MUST be in YYYY-MM-DD format (convert from any format you see)
- hours must be a positive number; default to 1 if not specified
- Include every row/entry you find — do not skip any
- If a field is missing, use null (never omit the key)
- Return { "records": [] } if no training records are found
- Return ONLY the JSON object, no explanation or markdown`

async function parseWithAI(file: File, ext: string): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('REPLACE_ME')) {
    return NextResponse.json(
      { error: 'AI parsing requires an Anthropic API key. Add ANTHROPIC_API_KEY to your environment variables, or export your document as an Excel/CSV file.' },
      { status: 400 }
    )
  }

  const client = new Anthropic({ apiKey })
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let message: Anthropic.Message

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)) {
      // Image — use vision
      const mediaType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : 'image/webp'
      message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
            { type: 'text', text: 'Extract all training records from this document.' },
          ],
        }],
      })
    } else if (ext === 'pdf') {
      // PDF — send as document
      message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } } as any,
            { type: 'text', text: 'Extract all training records from this document.' },
          ],
        }],
      })
    } else {
      // Word (.docx/.doc) — extract text with mammoth, then send as text
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value.trim()
      if (!text) return NextResponse.json({ error: 'Could not read text from Word document.' }, { status: 422 })
      message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract all training records from this document:\n\n${text}`,
        }],
      })
    }

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI could not extract structured data from this file.' }, { status: 422 })

    const parsed = JSON.parse(jsonMatch[0]) as { records: Array<{
      employee_name: string; employee_number: string | null; hire_date: string | null
      course_name: string; completed_date: string; hours: number
    }> }

    if (!parsed.records?.length) {
      return NextResponse.json(
        { error: 'No training records found in this file. Make sure it contains employee names, course names, completion dates, and hours.' },
        { status: 422 }
      )
    }

    // Convert to the same shape the spreadsheet parser returns
    const employeeMap = new Map<string, { name: string; employee_number: string | null; hire_date: string | null }>()
    const courseMap   = new Map<string, { name: string; credit_hours: number; expires_years: number | null }>()
    const training_records: Array<{ employee_name: string; course_name: string; completed_date: string; hours: number }> = []

    for (const r of parsed.records) {
      if (!r.employee_name || !r.course_name || !r.completed_date) continue
      const empKey    = r.employee_name.toLowerCase()
      const courseKey = r.course_name.toLowerCase()
      if (!employeeMap.has(empKey)) {
        employeeMap.set(empKey, { name: r.employee_name, employee_number: r.employee_number ?? null, hire_date: r.hire_date ?? null })
      }
      if (!courseMap.has(courseKey)) {
        courseMap.set(courseKey, { name: r.course_name, credit_hours: r.hours ?? 1, expires_years: null })
      }
      training_records.push({ employee_name: r.employee_name, course_name: r.course_name, completed_date: r.completed_date, hours: r.hours ?? 1 })
    }

    return NextResponse.json({
      employees: Array.from(employeeMap.values()),
      courses: Array.from(courseMap.values()),
      training_records,
      ai_parsed: true,
    })
  } catch (err: any) {
    console.error('AI parse error:', err)
    return NextResponse.json({ error: err.message ?? 'AI parsing failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  const AI_TYPES = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif']
  const SPREADSHEET_TYPES = ['xlsx', 'xls', 'xlsm', 'csv']

  if (AI_TYPES.includes(ext)) {
    return await parseWithAI(file, ext)
  }

  if (!SPREADSHEET_TYPES.includes(ext)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Accepted: Excel (.xlsx, .xls), CSV, Word (.docx), PDF, or images (JPG, PNG, etc.).' },
      { status: 400 }
    )
  }

  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const employeeMap = new Map<string, { name: string; employee_number: string | null; hire_date: string | null }>()
    const courseMap = new Map<string, { name: string; credit_hours: number; expires_years: number | null }>()
    const training_records: Array<{ employee_name: string; course_name: string; completed_date: string; hours: number }> = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
      if (rows.length === 0) continue

      const headers = Object.keys(rows[0])

      const colEmpName = findColumn(headers, COLUMNS.employee_name)
      const colEmpNum = findColumn(headers, COLUMNS.employee_number)
      const colHireDate = findColumn(headers, COLUMNS.hire_date)
      const colCourse = findColumn(headers, COLUMNS.course_name)
      const colDate = findColumn(headers, COLUMNS.completed_date)
      const colHours = findColumn(headers, COLUMNS.hours)
      const colExpires = findColumn(headers, COLUMNS.expires_years)

      // Need distinct employee and course columns — same column means this is a reference sheet, not a training log
      if (!colEmpName || !colCourse || colEmpName === colCourse) continue

      for (const row of rows) {
        const empName = toStr(colEmpName ? row[colEmpName] : null)
        const courseName = toStr(colCourse ? row[colCourse] : null)
        if (!empName || !courseName) continue

        const empKey = empName.toLowerCase()
        const courseKey = courseName.toLowerCase()

        if (!employeeMap.has(empKey)) {
          employeeMap.set(empKey, {
            name: empName,
            employee_number: toStr(colEmpNum ? row[colEmpNum] : null),
            hire_date: colHireDate ? toDateString(row[colHireDate]) : null,
          })
        }

        const creditHours = toNumber(colHours ? row[colHours] : null) ?? 1
        const expiresRaw = toNumber(colExpires ? row[colExpires] : null)
        // 0 means "never expires" in this file format — store as null
        const expiresYears = expiresRaw === null || expiresRaw <= 0 ? null : expiresRaw

        if (!courseMap.has(courseKey)) {
          courseMap.set(courseKey, {
            name: courseName,
            credit_hours: creditHours,
            expires_years: expiresYears,
          })
        }

        const completedDate = colDate ? toDateString(row[colDate]) : null
        if (completedDate) {
          training_records.push({
            employee_name: empName,
            course_name: courseName,
            completed_date: completedDate,
            hours: creditHours,
          })
        }
      }
    }

    if (employeeMap.size === 0 && courseMap.size === 0) {
      return NextResponse.json(
        { error: 'Could not detect any employee or course data. Make sure your spreadsheet has column headers like "Employee Name", "Course Name", "Completion Date", and "Hours".' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      employees: Array.from(employeeMap.values()),
      courses: Array.from(courseMap.values()),
      training_records,
    })
  } catch (err: any) {
    console.error('Import parse error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to parse file' }, { status: 500 })
  }
}
