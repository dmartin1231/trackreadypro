-- Add certificate image URL to training records
ALTER TABLE training_records
  ADD COLUMN IF NOT EXISTS certificate_url TEXT;

-- NOTE: You also need to create a Supabase Storage bucket named "certificates".
-- Run this in the Supabase SQL editor (Storage is not configurable via SQL migrations):
--
--   In Supabase dashboard → Storage → New bucket
--   Name: certificates
--   Public bucket: YES  (URLs are obscure UUIDs — safe for internal use)
--
-- Or run:  npm run db:setup-storage
