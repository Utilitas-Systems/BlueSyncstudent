-- Fix authentication issues - ensure password verification works correctly

-- First, let's check if we have test data and fix the password verification
-- The issue might be that the new security policies are blocking authentication

-- Temporarily create a function to debug authentication
CREATE OR REPLACE FUNCTION public.debug_authentication(p_school_code text, p_username text, p_password text, p_user_type text)
RETURNS TABLE(
  school_exists boolean,
  user_exists boolean, 
  password_matches boolean,
  school_active boolean,
  user_id uuid,
  stored_password text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_user_record record;
BEGIN
  -- Check if school exists
  SELECT id INTO v_school_id 
  FROM public.schools s 
  WHERE s.school_code = p_school_code;
  
  -- Check if user exists
  SELECT su.id, su.password, s.is_active 
  INTO v_user_record
  FROM public.school_users su
  JOIN public.schools s ON s.id = su.school_id
  WHERE s.school_code = p_school_code
    AND su.username = UPPER(p_username)
    AND su.user_type = p_user_type;
    
  RETURN QUERY SELECT 
    v_school_id IS NOT NULL as school_exists,
    v_user_record.id IS NOT NULL as user_exists,
    CASE 
      WHEN v_user_record.password IS NOT NULL THEN 
        public.verify_password(p_password, v_user_record.password)
      ELSE false
    END as password_matches,
    COALESCE(v_user_record.is_active, false) as school_active,
    v_user_record.id as user_id,
    LEFT(v_user_record.password, 10) || '...' as stored_password;
END;
$$;

-- Fix the authenticate function to handle the security policies properly
CREATE OR REPLACE FUNCTION public.authenticate_school_user_secure(p_school_code text, p_username text, p_password text, p_user_type text)
RETURNS TABLE(user_id uuid, username text, full_name text, school_id uuid, user_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_record record;
BEGIN
  -- First verify the credentials exist and match
  SELECT 
    su.id,
    su.username,
    su.full_name,
    su.school_id,
    su.user_type,
    su.password
  INTO v_user_record
  FROM public.school_users su
  JOIN public.schools s ON s.id = su.school_id
  WHERE s.school_code = UPPER(p_school_code)
    AND su.username = UPPER(p_username)
    AND su.user_type = p_user_type
    AND s.is_active = true;

  -- If user exists, verify password
  IF v_user_record.id IS NOT NULL AND public.verify_password(p_password, v_user_record.password) THEN
    -- Return user data without password
    RETURN QUERY SELECT 
      v_user_record.id,
      v_user_record.username,
      v_user_record.full_name,
      v_user_record.school_id,
      v_user_record.user_type;
  END IF;
  
  -- If we get here, authentication failed - return nothing
END;
$$;

-- Also ensure we have some test data (if not already present)
-- Insert a test school if it doesn't exist
INSERT INTO public.schools (school_code, school_name, admin_username, admin_password, address, is_active)
SELECT 'TEST', 'Test School', 'admin', 'admin123', '123 Test St', true
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE school_code = 'TEST');

-- Insert test student if it doesn't exist
INSERT INTO public.school_users (username, full_name, password, user_type, school_id)
SELECT 'TEST002', 'Test Student', 'damo', 'student', s.id
FROM public.schools s
WHERE s.school_code = 'TEST'
  AND NOT EXISTS (
    SELECT 1 FROM public.school_users su 
    WHERE su.username = 'TEST002' AND su.school_id = s.id
  );