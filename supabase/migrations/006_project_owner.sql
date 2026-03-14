-- Add owner field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner text;
