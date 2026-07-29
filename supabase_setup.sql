-- ==========================================
-- COMPLETE SUPABASE SETUP SCRIPT
-- ==========================================
-- Open to all students, any roll number / any department.
-- No pre-seeded roster: a roll number becomes known the first time it is scanned.

-- 0. ENABLE UUID EXTENSION (required for attendance IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREATE ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    roll_number TEXT NOT NULL,
    date DATE NOT NULL,
    hours NUMERIC DEFAULT 0,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(roll_number, date)
);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 3. CREATE POLICIES (Allow public access for now since this is a frontend-only app)
CREATE POLICY "Allow public read access on attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on attendance" ON attendance FOR DELETE USING (true);
CREATE POLICY "Allow public update access on attendance" ON attendance FOR UPDATE USING (true);
