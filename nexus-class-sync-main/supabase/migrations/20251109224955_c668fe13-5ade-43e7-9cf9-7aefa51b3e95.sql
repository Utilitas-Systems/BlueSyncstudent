-- Fix the SELECT policy on class_students to work with custom authentication
DROP POLICY IF EXISTS "Students can view own memberships" ON public.class_students;

-- Create a new SELECT policy using current_user_id() instead of auth.uid()
CREATE POLICY "Students can view own memberships"
ON public.class_students
FOR SELECT
USING (student_id = current_user_id());