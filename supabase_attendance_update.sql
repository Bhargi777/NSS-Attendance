-- Run this side-by-side with your existing tables to upgrade the schema for the new Date-based system

-- 1. Create the Students Table if not exists
CREATE TABLE IF NOT EXISTS students (
    roll_number TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- 2. Add 'date' and 'hours' to existing Attendance Table
-- Using IF NOT EXISTS safely in PostgreSQL blocks or simple alters
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;

-- 3. To track attendance per day per student unique:
-- Only run this after deleting duplicates, or if the table is fresh/cleared.
-- ALTER TABLE attendance ADD CONSTRAINT unique_roll_date UNIQUE(roll_number, date);

-- 4. Re-run your Seed File (supabase_seed.sql) to populate the students table if needed!
