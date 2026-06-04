-- =========================================================
-- ClearPath — DSP Training Tracker
-- Initial Schema Migration
-- =========================================================

-- ─── Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  required_hours  NUMERIC NOT NULL DEFAULT 24,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  employee_number  TEXT,
  hire_date        DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  credit_hours   NUMERIC NOT NULL DEFAULT 1,
  expires_years  NUMERIC,            -- NULL = never expires
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_date  DATE NOT NULL,
  hours           NUMERIC NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id  UUID REFERENCES agencies(id) ON DELETE SET NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_employees_agency   ON employees(agency_id);
CREATE INDEX IF NOT EXISTS idx_courses_agency     ON courses(agency_id);
CREATE INDEX IF NOT EXISTS idx_records_agency     ON training_records(agency_id);
CREATE INDEX IF NOT EXISTS idx_records_employee   ON training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_records_course     ON training_records(course_id);
CREATE INDEX IF NOT EXISTS idx_records_date       ON training_records(completed_date);
CREATE INDEX IF NOT EXISTS idx_profiles_agency    ON user_profiles(agency_id);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE agencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's agency_id (SECURITY DEFINER skips RLS on user_profiles)
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT agency_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── user_profiles policies ──────────────────────────────

CREATE POLICY "profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─── agencies policies ────────────────────────────────────

CREATE POLICY "agencies_select" ON agencies
  FOR SELECT USING (id = get_user_agency_id());

CREATE POLICY "agencies_insert" ON agencies
  FOR INSERT WITH CHECK (true);  -- allow during onboarding; profile check enforced app-side

CREATE POLICY "agencies_update" ON agencies
  FOR UPDATE USING (id = get_user_agency_id());

-- ─── employees policies ───────────────────────────────────

CREATE POLICY "employees_all" ON employees
  FOR ALL USING (agency_id = get_user_agency_id())
  WITH CHECK (agency_id = get_user_agency_id());

-- ─── courses policies ────────────────────────────────────

CREATE POLICY "courses_all" ON courses
  FOR ALL USING (agency_id = get_user_agency_id())
  WITH CHECK (agency_id = get_user_agency_id());

-- ─── training_records policies ───────────────────────────

CREATE POLICY "records_all" ON training_records
  FOR ALL USING (agency_id = get_user_agency_id())
  WITH CHECK (agency_id = get_user_agency_id());
