-- Fix student_devices RLS policies to use current_user_id() instead of auth.uid()
-- This app uses custom authentication, not Supabase Auth

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Students can view own devices" ON student_devices;
DROP POLICY IF EXISTS "Students can insert own devices" ON student_devices;
DROP POLICY IF EXISTS "Students can update own devices" ON student_devices;
DROP POLICY IF EXISTS "Students can delete own devices" ON student_devices;
DROP POLICY IF EXISTS "Teachers can view devices of class students" ON student_devices;

-- Create new policies using current_user_id()
CREATE POLICY "Students can view own devices" 
ON student_devices 
FOR SELECT 
USING (student_id = current_user_id());

CREATE POLICY "Students can insert own devices" 
ON student_devices 
FOR INSERT 
WITH CHECK (student_id = current_user_id());

CREATE POLICY "Students can update own devices" 
ON student_devices 
FOR UPDATE 
USING (student_id = current_user_id())
WITH CHECK (student_id = current_user_id());

CREATE POLICY "Students can delete own devices" 
ON student_devices 
FOR DELETE 
USING (student_id = current_user_id());

-- Teachers can view devices of students in their classes
CREATE POLICY "Teachers can view devices of class students" 
ON student_devices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_devices.student_id
    AND s.class_id IS NOT NULL
    AND is_teacher_of_class(current_user_id(), s.class_id)
  )
);

-- Also fix login_logs policy to allow inserts during login (before current_user is set)
-- We need to allow inserts from the authentication flow
DROP POLICY IF EXISTS "Authenticated login logging only" ON login_logs;

CREATE POLICY "Allow login logging" 
ON login_logs 
FOR INSERT 
WITH CHECK (
  user_id IS NOT NULL 
  AND school_id IS NOT NULL
);