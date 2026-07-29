-- Run this against an existing database that was set up with the older,
-- department-restricted schema (students table + FK on attendance.roll_number).
-- Result: any roll number can be scanned, not just pre-seeded ones.

-- 1. Add 'date' and 'hours' to existing Attendance Table (no-op if already present)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;

-- 2. Drop the students FK so scanning isn't limited to a pre-seeded roster
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_roll_number_fkey;
DROP TABLE IF EXISTS students;

-- 3. Backfill 'date' for any pre-existing rows scanned before this column existed
UPDATE attendance SET date = scanned_at::date WHERE date IS NULL;
ALTER TABLE attendance ALTER COLUMN date SET NOT NULL;

-- 4. Ensure one row per roll number per day (skip if this already exists)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_roll_number_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_roll_number_date_key UNIQUE (roll_number, date);
