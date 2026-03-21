-- Fix all RLS policies that incorrectly use auth.uid() instead of current_user_id()
-- This app uses custom authentication, not Supabase Auth

-- 1. Fix class_students policies
DROP POLICY IF EXISTS "School admins can view school memberships" ON class_students;
CREATE POLICY "School admins can view school memberships" 
ON class_students 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = class_students.class_id 
    AND is_school_admin(current_user_id(), c.school_id)
  )
);

-- 2. Fix login_logs policies
DROP POLICY IF EXISTS "School admins can view login logs" ON login_logs;
CREATE POLICY "School admins can view login logs" 
ON login_logs 
FOR SELECT 
USING (is_school_admin(current_user_id(), school_id));

-- 3. Fix students table policies that use auth.uid()
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON students;
CREATE POLICY "Teachers can view students in their classes" 
ON students 
FOR SELECT 
USING (
  class_id IS NOT NULL 
  AND is_teacher_of_class(current_user_id(), class_id)
);

DROP POLICY IF EXISTS "Teachers can update students in their classes" ON students;
CREATE POLICY "Teachers can update students in their classes" 
ON students 
FOR UPDATE 
USING (
  class_id IS NOT NULL 
  AND is_teacher_of_class(current_user_id(), class_id)
);

DROP POLICY IF EXISTS "School staff can insert students" ON students;
CREATE POLICY "School staff can insert students" 
ON students 
FOR INSERT 
WITH CHECK (
  is_school_admin(current_user_id(), school_id) 
  OR is_teacher_in_school(current_user_id(), school_id)
);

-- Remove duplicate policy (School staff can create students already exists with correct logic)
DROP POLICY IF EXISTS "School staff can create students" ON students;