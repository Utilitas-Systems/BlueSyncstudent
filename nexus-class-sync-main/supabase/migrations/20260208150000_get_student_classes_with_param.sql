-- Fix: Supabase Cloud may not forward custom x-app-user-id headers to PostgREST.
-- Pass student_id as parameter so classes load reliably without depending on headers.

CREATE OR REPLACE FUNCTION public.get_student_classes(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, class_code text, class_name text, created_at timestamptz, teacher_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sid uuid;
BEGIN
  sid := COALESCE(p_student_id, public.current_user_id());
  IF sid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.id, c.class_code, c.class_name, c.created_at, c.teacher_id
  FROM public.classes c
  JOIN public.class_students cs ON cs.class_id = c.id
  WHERE cs.student_id = sid
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_class(p_class_id uuid, p_student_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sid uuid;
BEGIN
  IF p_class_id IS NULL THEN
    RAISE EXCEPTION 'Invalid class id';
  END IF;
  sid := COALESCE(p_student_id, public.current_user_id());
  IF sid IS NULL THEN
    RAISE EXCEPTION 'Student id required';
  END IF;
  DELETE FROM public.class_students
  WHERE class_id = p_class_id AND student_id = sid;
END;
$$;
