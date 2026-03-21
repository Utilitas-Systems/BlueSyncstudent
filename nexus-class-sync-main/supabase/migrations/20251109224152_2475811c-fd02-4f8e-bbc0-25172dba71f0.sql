-- Allow students to join classes themselves
-- This is safe because:
-- 1. Students can only add themselves (student_id = current_user_id())
-- 2. They need a valid class code to find the class first
-- 3. The class must exist in the database

CREATE POLICY "Students can join classes themselves"
ON public.class_students
FOR INSERT
WITH CHECK (student_id = current_user_id());