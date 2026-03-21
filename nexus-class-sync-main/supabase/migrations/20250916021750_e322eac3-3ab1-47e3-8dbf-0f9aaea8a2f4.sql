-- Remove the duplicate test data I just added
DELETE FROM public.school_users 
WHERE username = 'TEST002' 
  AND full_name = 'Test Student'
  AND school_id = (SELECT id FROM public.schools WHERE school_code = 'TEST' AND school_name = 'Test School');

DELETE FROM public.schools 
WHERE school_code = 'TEST' 
  AND school_name = 'Test School' 
  AND admin_username = 'admin';

-- Check the existing user passwords and update them if needed
-- First, let's see what password format the existing users have
DO $$
DECLARE
  test_user_password text;
BEGIN
  -- Get the current password for existing TEST002 user
  SELECT password INTO test_user_password 
  FROM public.school_users su
  JOIN public.schools s ON s.id = su.school_id
  WHERE su.username = 'TEST002' 
    AND s.school_code = 'TEST' 
    AND s.school_name = 'Test Secondary College';
  
  -- If password doesn't start with our hash format, update it
  IF test_user_password IS NOT NULL AND NOT test_user_password LIKE '$2a$10$%' THEN
    -- Update Jim Street's password to 'jim' with proper hashing
    UPDATE public.school_users 
    SET password = 'jim'  -- This will be hashed by the trigger
    WHERE username = 'TEST002' 
      AND school_id = (SELECT id FROM public.schools WHERE school_code = 'TEST' AND school_name = 'Test Secondary College');
    
    -- Update Robert Hicks' password to 'teacher' with proper hashing  
    UPDATE public.school_users 
    SET password = 'teacher'  -- This will be hashed by the trigger
    WHERE username = 'TEST001' 
      AND school_id = (SELECT id FROM public.schools WHERE school_code = 'TEST' AND school_name = 'Test Secondary College');
  END IF;
END $$;