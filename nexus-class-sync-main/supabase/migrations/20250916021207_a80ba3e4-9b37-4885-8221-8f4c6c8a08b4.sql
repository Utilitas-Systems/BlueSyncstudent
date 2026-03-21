-- Fix remaining function search path security warnings

-- Update all functions to have proper search_path settings
CREATE OR REPLACE FUNCTION public.authenticate_school_user(p_school_code text, p_username text, p_password text, p_user_type text)
RETURNS TABLE(user_id uuid, username text, full_name text, school_id uuid, user_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.username,
    su.full_name,
    su.school_id,
    su.user_type
  FROM public.school_users su
  JOIN public.schools s ON s.id = su.school_id
  WHERE s.school_code = p_school_code
    AND su.username = p_username
    AND su.password = p_password
    AND su.user_type = p_user_type
    AND s.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_audio_level(p_student_id uuid, p_audio_level numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.students 
  SET 
    audio_level = p_audio_level,
    last_audio_update = now(),
    updated_at = now()
  WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_info_for_auth(p_school_code text)
RETURNS TABLE(school_code text, school_name text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.school_code,
    s.school_name,
    s.is_active
  FROM public.schools s
  WHERE s.school_code = p_school_code
    AND s.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_admin_credentials(target_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow superadmins (users with @monere.admin emails) 
  -- or school admins to view admin credentials
  RETURN (
    COALESCE(
      (SELECT email LIKE '%@monere.admin' FROM auth.users WHERE id = auth.uid()),
      false
    ) OR
    is_school_admin(auth.uid(), target_school_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_classes(p_teacher_id uuid)
RETURNS SETOF classes
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT *
  FROM public.classes
  WHERE teacher_id = p_teacher_id
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.create_teacher_class(p_teacher_id uuid, p_school_id uuid, p_class_name text, p_class_code text)
RETURNS classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row public.classes;
BEGIN
  -- Validate teacher belongs to the school
  IF NOT public.is_teacher_in_school(p_teacher_id, p_school_id) THEN
    RAISE EXCEPTION 'Not authorized to create class for this school';
  END IF;

  INSERT INTO public.classes (class_name, class_code, teacher_id, school_id)
  VALUES (p_class_name, p_class_code, p_teacher_id, p_school_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_by_code(p_school_code text)
RETURNS TABLE(school_code text, school_name text, is_active boolean, id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.school_code,
    s.school_name,
    s.is_active,
    s.id
  FROM public.schools s
  WHERE s.school_code = p_school_code
    AND s.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Check if email ends with @monere.admin
  RETURN COALESCE(user_email LIKE '%@monere.admin', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_school_classes(p_teacher_id uuid, p_query text)
RETURNS SETOF classes
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT c.*
  FROM public.classes c
  WHERE public.is_teacher_in_school(p_teacher_id, c.school_id)
    AND (
      c.class_name ILIKE '%' || p_query || '%' OR
      c.class_code ILIKE '%' || p_query || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT 20;
$$;