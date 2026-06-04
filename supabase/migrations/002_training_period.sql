-- Add training period configuration to agencies
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS training_period         TEXT    NOT NULL DEFAULT 'calendar_year',
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER NOT NULL DEFAULT 1;

-- Add employee type (employee vs admin) to employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_type TEXT NOT NULL DEFAULT 'employee';

-- training_period values: 'calendar_year' | 'hire_date' | 'fiscal_year' | 'license_renewal'
-- employee_type values:   'employee' | 'admin'
