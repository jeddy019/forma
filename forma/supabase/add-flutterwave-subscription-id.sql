-- Standalone fix, applied live to the production Supabase project.
-- Phase 5 (Payment): needed to call Flutterwave's cancel-subscription API
-- from the settings page later. See CHANGELOG.md for the session this was
-- applied in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS flutterwave_subscription_id TEXT;
