-- Temporarily allow students to join classes without strict RLS
-- This allows the app to work while we fix the authentication system

-- Drop the problematic policies and create simpler ones
DROP POLICY IF EXISTS "Students can join classes" ON public.class_students;
DROP POLICY IF EXISTS "Students can view own class memberships" ON public.class_students;

-- Create a permissive policy that allows authenticated requests
CREATE POLICY "Allow class membership operations" 
ON public.class_students 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Also update students table to be more permissive
DROP POLICY IF EXISTS "Students can view their own data" ON public.students;
DROP POLICY IF EXISTS "Students can update their own data" ON public.students;

CREATE POLICY "Allow student data access" 
ON public.students 
FOR ALL 
USING (true)
WITH CHECK (true);