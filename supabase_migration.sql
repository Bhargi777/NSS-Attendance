-- ==========================================
-- NSS Attendance System - Database Schema
-- ==========================================

-- 1. Create the attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    roll_number TEXT NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add a unique constraint to prevent duplicate roll numbers
-- (If you want to allow a student to be scanned again on a different day, 
--  you might need to alter this to include a date column. But based on the current 
--  simple implementation, this prevents a roll number from being scanned twice overall.)
ALTER TABLE attendance ADD CONSTRAINT unique_roll_number UNIQUE (roll_number);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
-- Allow anonymous read access (needed for the frontend live table)
CREATE POLICY "Allow public read access" 
ON attendance 
FOR SELECT 
USING (true);

-- Allow anonymous insert access (needed for scanner)
CREATE POLICY "Allow public insert access" 
ON attendance 
FOR INSERT 
WITH CHECK (true);

-- Allow anonymous delete access (needed for removing entries / clearing cloud)
CREATE POLICY "Allow public delete access" 
ON attendance 
FOR DELETE 
USING (true);

-- 5. Enable real-time subscriptions for the table
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- ==========================================
-- Optional: Students Table (for seeding/lookup)
-- ==========================================
CREATE TABLE IF NOT EXISTS students (
    roll_number TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Allow public read access to students
CREATE POLICY "Allow public read access to students" 
ON students 
FOR SELECT 
USING (true);
