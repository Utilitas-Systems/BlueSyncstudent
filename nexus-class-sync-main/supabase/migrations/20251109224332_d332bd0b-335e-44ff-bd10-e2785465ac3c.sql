-- Drop the policy that doesn't work with custom auth
DROP POLICY IF EXISTS "Students can join classes themselves" ON public.class_students;

-- Create a new policy that validates the student exists
-- This works because it checks the database, not session state
CREATE POLICY "Students can join classes themselves"
ON public.class_students
FOR INSERT
WITH CHECK (
  -- Ensure the student_id being inserted exists in the students table
  EXISTS (
    SELECT 1 
    FROM public.students s
    WHERE s.id = class_students.student_id
  )
  AND
  -- Ensure the class_id exists
  EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_students.class_id
  )
);