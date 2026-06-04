-- =========================================================
-- ClearPath — North Star Oregon Seed Data
-- Run AFTER creating your admin user via /setup
-- Replace 'YOUR_AGENCY_ID' with your actual agency UUID
-- =========================================================

-- Get your agency ID from Supabase dashboard or run:
-- SELECT id FROM agencies WHERE name = 'North Star Oregon';

-- ─── North Star Oregon Courses ────────────────────────────
-- NOTE: Replace <AGENCY_ID> with your actual agency UUID before running

INSERT INTO courses (agency_id, name, credit_hours, expires_years) VALUES
  ('<AGENCY_ID>', 'Orientation',                        6,    NULL),
  ('<AGENCY_ID>', 'CPR / First Aid',                    2,    1),
  ('<AGENCY_ID>', 'Tier 1',                             6,    2),
  ('<AGENCY_ID>', 'Tier 2',                             6,    2),
  ('<AGENCY_ID>', 'MR for Adults & Children',           1.5,  1),
  ('<AGENCY_ID>', 'RMP Training',                       0.25, 1),
  ('<AGENCY_ID>', 'Imp Training',                       0.25, 1),
  ('<AGENCY_ID>', 'PSA',                                0.25, 1),
  ('<AGENCY_ID>', 'MARS / OIS / BSP / Incident Policy', 2,    1);

-- ─── Sample Employees ─────────────────────────────────────

INSERT INTO employees (agency_id, name, employee_number, hire_date) VALUES
  ('<AGENCY_ID>', 'Maria Garcia',   'EMP001', '2023-01-15'),
  ('<AGENCY_ID>', 'James Wilson',   'EMP002', '2023-03-01'),
  ('<AGENCY_ID>', 'Sarah Chen',     'EMP003', '2022-11-20'),
  ('<AGENCY_ID>', 'Michael Brown',  'EMP004', '2024-01-08'),
  ('<AGENCY_ID>', 'Emily Davis',    'EMP005', '2023-07-12');

-- ─── Sample Training Records ──────────────────────────────
-- After inserting courses and employees, you can run a script
-- to insert training records using the returned IDs.
-- See supabase/seed.ts for the TypeScript version that handles IDs automatically.
