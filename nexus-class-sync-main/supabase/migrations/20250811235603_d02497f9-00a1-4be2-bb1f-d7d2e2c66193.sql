-- Ensure students are created in the students table during login
-- First, let's create or update the sync function to handle login status

CREATE OR REPLACE FUNCTION public.ensure_student_record(
  p_user_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_school_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert or update student record to ensure they exist
  INSERT INTO public.students (id, username, full_name, school_id, class_id, is_online, last_seen, created_at, updated_at)
  VALUES (
    p_user_id,
    p_username,
    p_full_name,
    p_school_id,
    NULL, -- No class initially
    true, -- Online when logging in
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    is_online = true,
    last_seen = now(),
    updated_at = now();
END;
$$;