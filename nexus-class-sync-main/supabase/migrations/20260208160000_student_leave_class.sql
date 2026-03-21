-- student_leave_class: Remove student from class, mark offline, clear class_id.
-- Runs as SECURITY DEFINER so it bypasses RLS (student authenticated via app session).
-- The sync_student_class_membership trigger will set class_id = NULL on DELETE.
CREATE OR REPLACE FUNCTION public.student_leave_class(p_student_id uuid, p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_student_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'Student id and class id are required';
  END IF;

  DELETE FROM public.class_students
  WHERE student_id = p_student_id AND class_id = p_class_id;

  UPDATE public.students
  SET class_id = NULL, is_online = false, last_seen = now()
  WHERE id = p_student_id;
END;
$$;
