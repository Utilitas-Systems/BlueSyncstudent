-- Allow students to view classes by code for joining purposes
-- This is safe because class codes are meant to be shared, and students
-- can only see classes from their own school

CREATE POLICY "Students can search classes by code to join"
ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.students s
    WHERE s.id = auth.uid() 
    AND s.school_id = classes.school_id
  )
);