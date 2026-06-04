# ClearPath — DSP Training Tracker

A multi-tenant SaaS web app for Oregon I/DD agencies to manage DSP employee training compliance. Built for **North Star Oregon** as the default tenant.

## Tech Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Supabase** (Auth, PostgreSQL, Row Level Security)
- **Tailwind CSS** (custom design system)
- **Vercel** (deployment)

---

## Features

| Page | Description |
|---|---|
| `/dashboard` | Metrics, compliance progress bars, expiry alert banner |
| `/employees` | Add/edit employees, view full training history modal |
| `/training-log` | Log, edit, delete training records with auto-filled hours |
| `/courses` | Build your course library with expiration periods |
| `/expiring-soon` | Expired / 30-day / 60-day sections with one-click Renew |
| `/settings` | Agency name + required hours (configurable per tenant) |
| `/setup` | Onboarding wizard for new agencies |

---

## Local Development

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 2. Clone and install

```bash
git clone <your-repo>
cd clearpath
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Only needed for the seed script — never commit this
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Find these in: **Supabase dashboard → Project Settings → API**

### 4. Run database migrations

In the **Supabase SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_initial.sql
```

This creates all tables, indexes, RLS policies, and the `get_user_agency_id()` helper function.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → you'll be redirected to `/login`.

### 6. Create your first agency

Visit `/setup` to create your admin account and agency (e.g., "North Star Oregon", 24 required hours).

### 7. (Optional) Seed sample data

After setup, add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, then:

```bash
npm run db:seed
```

This inserts:
- 9 courses matching North Star Oregon's training list
- 5 sample employees
- ~20 training records (varied compliance status for demo)

---

## Database Schema

```
agencies          id, name, required_hours
employees         id, agency_id, name, employee_number, hire_date
courses           id, agency_id, name, credit_hours, expires_years
training_records  id, agency_id, employee_id, course_id, completed_date, hours
user_profiles     id (→ auth.users), agency_id, role
```

**Row Level Security** ensures every tenant sees only their own data. All tables are scoped by `agency_id` via the `get_user_agency_id()` function which reads the authenticated user's profile.

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial ClearPath commit"
git remote add origin https://github.com/your-org/clearpath.git
git push -u origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

5. Click **Deploy**

### 3. Configure Supabase for production

In Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**`

---

## North Star Oregon Course List

| Course | Hours | Expiration |
|---|---|---|
| Orientation | 6h | Never |
| CPR / First Aid | 2h | 1 year |
| Tier 1 | 6h | 2 years |
| Tier 2 | 6h | 2 years |
| MR for Adults & Children | 1.5h | 1 year |
| RMP Training | 0.25h | 1 year |
| Imp Training | 0.25h | 1 year |
| PSA | 0.25h | 1 year |
| MARS / OIS / BSP / Incident Policy | 2h | 1 year |

---

## Multi-Tenancy

Each agency is fully isolated via PostgreSQL Row Level Security. No additional code is needed — Supabase enforces data boundaries at the database level. Additional agencies can self-register via `/setup`.

## Required Hours Compliance

The default is 24 hours/year (Oregon I/DD standard). This is configurable per agency in **Settings**. Compliance is calculated as calendar-year-to-date hours vs. the agency's `required_hours` threshold.
