-- Drop the incorrect policy that uses auth.uid()
DROP POLICY IF EXISTS "Students can search classes by code to join" ON public.classes;

-- Create the correct policy using current_user_id() for custom auth
CREATE POLICY "Students can search classes by code to join"
ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.students s
    WHERE s.id = current_user_id() 
    AND s.school_id = classes.school_id
  )
);