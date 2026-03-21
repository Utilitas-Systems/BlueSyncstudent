-- Fix critical security issues identified in security scan

-- 1. Fix overly permissive student creation policy
-- Remove the dangerous "anyone can create students" policy
DROP POLICY IF EXISTS "Allow student creation during enrollment" ON public.students;

-- Create a more secure policy that only allows authenticated school staff
CREATE POLICY "School staff can create students" ON public.students
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.school_users su
    WHERE su.id = current_user_id()
      AND su.school_id = students.school_id
      AND su.user_type IN ('admin', 'teacher')
  )
);

-- 2. Fix login logs policy to be more restrictive
-- Remove the overly permissive login logging policy
DROP POLICY IF EXISTS "Allow user login logging" ON public.login_logs;

-- Create a more secure policy that requires proper authentication context
CREATE POLICY "Authenticated login logging only" ON public.login_logs
FOR INSERT 
WITH CHECK (
  -- Only allow if the user_id matches a valid school user
  user_id IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM public.school_users su
    WHERE su.id = user_id
      AND su.school_id = login_logs.school_id
  )
);

-- 3. Fix function search paths for security
-- Update functions to have proper search_path settings
CREATE OR REPLACE FUNCTION public.is_current_student_member(target_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_students cs
    WHERE cs.class_id = target_class_id
      AND cs.student_id = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT school_id 
  FROM public.school_users 
  WHERE id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.get_user_type(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT user_type 
  FROM public.school_users 
  WHERE id = user_uuid;
$$;

-- 4. Ensure password hashing is working correctly
-- Check if there are any unhashed passwords and hash them
UPDATE public.school_users 
SET password = public.hash_password(password)
WHERE password IS NOT NULL 
  AND NOT password LIKE '$2a$%';

UPDATE public.schools 
SET admin_password = public.hash_password(admin_password)
WHERE admin_password IS NOT NULL 
  AND NOT admin_password LIKE '$2a$%';

-- 5. Add additional security for sensitive data access
-- Create a more restrictive policy for school_users password access
DROP POLICY IF EXISTS "Allow secure authentication lookup" ON public.school_users;

CREATE POLICY "No direct password access" ON public.school_users
FOR SELECT 
USING (false); -- Completely block direct access to prevent password exposure

-- Allow only specific authentication functions to access user data
CREATE POLICY "Authentication functions only" ON public.school_users
FOR SELECT 
USING (
  -- Only allow access during authentication function execution
  current_setting('role', true) = 'supabase_admin' OR
  current_user_id() = id
);

-- 6. Improve school table security
DROP POLICY IF EXISTS "Allow secure school lookup" ON public.schools;

CREATE POLICY "No direct admin password access" ON public.schools
FOR SELECT 
USING (false); -- Block direct access to prevent admin password exposure

-- Add comment for documentation
COMMENT ON POLICY "School staff can create students" ON public.students IS 'Only authenticated school administrators and teachers can create student records';
COMMENT ON POLICY "Authenticated login logging only" ON public.login_logs IS 'Login logs can only be created for valid school users during authentication';
COMMENT ON POLICY "No direct password access" ON public.school_users IS 'Prevents direct access to user passwords - authentication must use secure functions';
COMMENT ON POLICY "No direct admin password access" ON public.schools IS 'Prevents direct access to admin passwords - authentication must use secure functions';