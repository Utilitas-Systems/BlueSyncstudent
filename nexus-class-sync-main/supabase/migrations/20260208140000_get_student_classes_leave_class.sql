-- get_student_classes: returns classes the current student has joined (uses current_user_id from x-app-user-id header)
CREATE OR REPLACE FUNCTION public.get_student_classes()
RETURNS TABLE(id uuid, class_code text, class_name text, created_at timestamptz, teacher_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.class_code, c.class_name, c.created_at, c.teacher_id
  FROM public.classes c
  JOIN public.class_students cs ON cs.class_id = c.id
  WHERE cs.student_id = public.current_user_id()
  ORDER BY c.created_at DESC;
END;
$$;

-- leave_class: remove student from a class (uses current_user_id)
CREATE OR REPLACE FUNCTION public.leave_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_class_id IS NULL THEN
    RAISE EXCEPTION 'Invalid class id';
  END IF;
  DELETE FROM public.class_students
  WHERE class_id = p_class_id AND student_id = public.current_user_id();
END;
$$;
