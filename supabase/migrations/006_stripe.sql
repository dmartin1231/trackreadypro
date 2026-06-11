-- Stripe billing columns on agencies
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS plan_type                TEXT DEFAULT 'trial' CHECK (plan_type IN ('trial','starter','professional','agency','enterprise')),
  ADD COLUMN IF NOT EXISTS trial_ends_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT CHECK (subscription_status IN ('active','past_due','canceled','trialing'));

-- superadmin role support in user_profiles
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Update setup function to initialize trial when agency is created
-- (call this from app code after insert)
