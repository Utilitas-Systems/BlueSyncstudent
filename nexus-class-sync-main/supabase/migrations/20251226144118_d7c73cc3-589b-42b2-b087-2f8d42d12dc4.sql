-- Harden function search_path (may reduce linter warnings)
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(teacher_user_id uuid, target_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = target_class_id
      AND teacher_id = teacher_user_id
  );
END;
$$;