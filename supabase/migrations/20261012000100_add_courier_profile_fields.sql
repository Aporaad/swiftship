-- Add the five profile fields explicitly approved for courier API migration.
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS notes text;
