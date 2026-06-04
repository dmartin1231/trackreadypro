-- Track which records came from which import so a single import can be undone
ALTER TABLE employees       ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE courses         ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE training_records ADD COLUMN IF NOT EXISTS import_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_employees_batch        ON employees(import_batch_id)        WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_batch          ON courses(import_batch_id)          WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_records_batch ON training_records(import_batch_id) WHERE import_batch_id IS NOT NULL;
