-- Migration: Add first_login field to family_members table
-- Revision: 001
-- Date: 2026-01-26

-- Add the column with default value TRUE for new users
ALTER TABLE family_members ADD COLUMN first_login BOOLEAN DEFAULT 1;

-- Set existing users to first_login=FALSE
-- (they've already logged in before this feature was added)
UPDATE family_members SET first_login = 0 WHERE first_login IS NULL OR first_login = 1;
