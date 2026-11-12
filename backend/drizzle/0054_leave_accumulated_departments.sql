-- Migration: 0054_leave_accumulated_departments.sql
-- Create table for departments with unlimited leave accumulation per year

CREATE TABLE IF NOT EXISTS "leave_accumulated_departments" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "year" integer NOT NULL,
  "department_id" bigint NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_accumulated_depts_year_dept_unique" 
ON "leave_accumulated_departments" ("year", "department_id");
