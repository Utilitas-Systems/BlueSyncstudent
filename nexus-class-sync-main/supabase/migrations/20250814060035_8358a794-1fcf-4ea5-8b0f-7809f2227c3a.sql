-- Update RLS policies to work with custom authentication system
-- The current policies rely on auth.uid() but we're using custom auth

-- Update class_students policies to use current_user_id() instead of auth.uid()
DROP POLICY IF EXISTS "Students can join classes" ON public.class_students;
DROP POLICY IF EXISTS "Students can leave classes" ON public.class_students;
DROP POLICY IF EXISTS "Students can view own class memberships" ON public.class_students;

-- Create new policies that work with custom authentication
CREATE POLICY "Students can join classes" 
ON public.class_students 
FOR INSERT 
WITH CHECK (student_id = current_user_id());

CREATE POLICY "Students can leave classes" 
ON public.class_students 
FOR DELETE 
USING (student_id = current_user_id());

CREATE POLICY "Students can view own class memberships" 
ON public.class_students 
FOR SELECT 
USING (student_id = current_user_id());

-- Update students table policies to use current_user_id()
DROP POLICY IF EXISTS "Students can view their own data" ON public.students;
DROP POLICY IF EXISTS "Students can update their own data" ON public.students;

CREATE POLICY "Students can view their own data" 
ON public.students 
FOR SELECT 
USING (id = current_user_id());

CREATE POLICY "Students can update their own data" 
ON public.students 
FOR UPDATE 
USING (id = current_user_id());

-- Update student_devices policies to use current_user_id()
DROP POLICY IF EXISTS "Students can view own devices" ON public.student_devices;
DROP POLICY IF EXISTS "Students can insert own devices" ON public.student_devices;
DROP POLICY IF EXISTS "Students can update own devices" ON public.student_devices;

CREATE POLICY "Students can view own devices" 
ON public.student_devices 
FOR SELECT 
USING (student_id = current_user_id());

CREATE POLICY "Students can insert own devices" 
ON public.student_devices 
FOR INSERT 
WITH CHECK (student_id = current_user_id());

CREATE POLICY "Students can update own devices" 
ON public.student_devices 
FOR UPDATE 
USING (student_id = current_user_id());