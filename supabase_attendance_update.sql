-- Idempotent upgrade script. Safe to run on:
--   (a) the older department-restricted schema (students table + FK), or
--   (b) the newer single-table schema (attendance with date+hours, no students), or
--   (c) an already-migrated database.
-- End state matches supabase_setup.sql: an `attendance` history log plus an
-- `attendance_totals` table (one row per roll_number, updated in place every
-- scan) kept in sync by the record_scan() function.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add 'date' and 'hours' to attendance if coming from an even older schema
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;

-- 2. Drop the students FK/table so scanning isn't limited to a pre-seeded roster
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_roll_number_fkey;
DROP TABLE IF EXISTS students;

-- 3. Backfill 'date' for any pre-existing rows scanned before this column existed
UPDATE attendance SET date = scanned_at::date WHERE date IS NULL;
ALTER TABLE attendance ALTER COLUMN date SET NOT NULL;

-- 4. Ensure one log row per roll number per day
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_roll_number_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_roll_number_date_key UNIQUE (roll_number, date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public insert access on attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public delete access on attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public update access on attendance" ON attendance;
CREATE POLICY "Allow public read access on attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on attendance" ON attendance FOR DELETE USING (true);
CREATE POLICY "Allow public update access on attendance" ON attendance FOR UPDATE USING (true);

-- 5. Create the live totals table (one row per student)
CREATE TABLE IF NOT EXISTS attendance_totals (
    roll_number TEXT PRIMARY KEY,
    total_hours NUMERIC NOT NULL DEFAULT 0,
    last_date DATE,
    last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE attendance_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on attendance_totals" ON attendance_totals;
DROP POLICY IF EXISTS "Allow public insert access on attendance_totals" ON attendance_totals;
DROP POLICY IF EXISTS "Allow public delete access on attendance_totals" ON attendance_totals;
DROP POLICY IF EXISTS "Allow public update access on attendance_totals" ON attendance_totals;
CREATE POLICY "Allow public read access on attendance_totals" ON attendance_totals FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance_totals" ON attendance_totals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on attendance_totals" ON attendance_totals FOR DELETE USING (true);
CREATE POLICY "Allow public update access on attendance_totals" ON attendance_totals FOR UPDATE USING (true);

-- 6. Backfill totals from whatever history is already in `attendance`
INSERT INTO attendance_totals (roll_number, total_hours, last_date, last_scanned_at)
SELECT
    roll_number,
    SUM(hours) AS total_hours,
    MAX(date) AS last_date,
    MAX(scanned_at) AS last_scanned_at
FROM attendance
GROUP BY roll_number
ON CONFLICT (roll_number) DO UPDATE
SET total_hours = EXCLUDED.total_hours,
    last_date = EXCLUDED.last_date,
    last_scanned_at = EXCLUDED.last_scanned_at;

-- 7. Atomic scan recorder: rejects a same-day re-scan, logs to `attendance`,
-- and adds p_hours onto the student's running total in `attendance_totals`.
CREATE OR REPLACE FUNCTION record_scan(p_roll TEXT, p_date DATE, p_hours NUMERIC)
RETURNS attendance_totals
LANGUAGE plpgsql
AS $$
DECLARE
    existing attendance_totals;
    result attendance_totals;
BEGIN
    SELECT * INTO existing FROM attendance_totals WHERE roll_number = p_roll FOR UPDATE;

    IF existing.roll_number IS NOT NULL AND existing.last_date = p_date THEN
        RAISE EXCEPTION 'DUPLICATE_SCAN: % already scanned on %', p_roll, p_date
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO attendance (roll_number, date, hours)
    VALUES (p_roll, p_date, p_hours);

    INSERT INTO attendance_totals (roll_number, total_hours, last_date, last_scanned_at)
    VALUES (p_roll, p_hours, p_date, now())
    ON CONFLICT (roll_number) DO UPDATE
    SET total_hours = attendance_totals.total_hours + EXCLUDED.total_hours,
        last_date = EXCLUDED.last_date,
        last_scanned_at = now()
    RETURNING * INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION record_scan(TEXT, DATE, NUMERIC) TO anon, authenticated;
