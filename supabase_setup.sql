-- ==========================================
-- COMPLETE SUPABASE SETUP SCRIPT
-- ==========================================
-- Open to all students, any roll number / any department.
-- No pre-seeded roster: a roll number becomes known the first time it is scanned.
--
-- Two tables:
--   attendance        -> history log, one row per (roll_number, date) scan session
--   attendance_totals -> one row per roll_number, hours updated in place on every scan
--
-- Both are written together, atomically, by the record_scan() function below.

-- 0. ENABLE UUID EXTENSION (required for attendance ids)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. HISTORY LOG (per-date breakdown, used by the dashboard)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    roll_number TEXT NOT NULL,
    date DATE NOT NULL,
    hours NUMERIC DEFAULT 0,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(roll_number, date)
);

-- 2. LIVE TOTALS (one row per student, updated in place every scan)
CREATE TABLE IF NOT EXISTS attendance_totals (
    roll_number TEXT PRIMARY KEY,
    total_hours NUMERIC NOT NULL DEFAULT 0,
    last_date DATE,
    last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_totals ENABLE ROW LEVEL SECURITY;

-- 4. CREATE POLICIES (Allow public access for now since this is a frontend-only app)
CREATE POLICY "Allow public read access on attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on attendance" ON attendance FOR DELETE USING (true);
CREATE POLICY "Allow public update access on attendance" ON attendance FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on attendance_totals" ON attendance_totals FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance_totals" ON attendance_totals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on attendance_totals" ON attendance_totals FOR DELETE USING (true);
CREATE POLICY "Allow public update access on attendance_totals" ON attendance_totals FOR UPDATE USING (true);

-- 5. RECORD A SCAN
-- Atomically: reject a second scan of the same roll_number on the same date,
-- log the scan in `attendance`, and add p_hours onto the student's running
-- total in `attendance_totals`.
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
