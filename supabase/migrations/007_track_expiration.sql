-- Allow courses to opt out of expiration tracking
-- When track_expiration = false, certs for that course will NOT
-- show as expired/expiring anywhere in the app (alerts, badges, dashboard).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS track_expiration BOOLEAN DEFAULT TRUE NOT NULL;
