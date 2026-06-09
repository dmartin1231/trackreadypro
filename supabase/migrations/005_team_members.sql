-- Add email to user_profiles so team members are listable without admin API
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Allow agency members to see each other's profiles (for team listing)
CREATE POLICY "profiles_select_agency" ON user_profiles
  FOR SELECT USING (agency_id = get_user_agency_id());
