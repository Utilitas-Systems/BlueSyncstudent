-- Allow students using anon key + x-app-user-id header to SELECT classes in their school.
-- (Custom auth: no Supabase Auth session, so role is anon.)
DROP POLICY IF EXISTS "Students can search classes by code to join" ON public.classes;

CREATE POLICY "Students can search classes by code to join"
ON public.classes
FOR SELECT
TO anon
USING (
  current_user_id() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = current_user_id()
      AND s.school_id = classes.school_id
  )
);

-- RPC fallback: look up class by code for a given student (bypasses RLS for SELECT when header not forwarded).
-- Only returns a class if the student exists and the class is in the same school.
CREATE OR REPLACE FUNCTION public.student_get_class_by_code(p_class_code text, p_student_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_class json;
BEGIN
  IF p_class_code IS NULL OR trim(p_class_code) = '' OR p_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT school_id INTO v_school_id
  FROM public.students
  WHERE id = p_student_id;

  IF v_school_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(c) INTO v_class
  FROM public.classes c
  WHERE c.class_code = upper(trim(p_class_code))
    AND c.school_id = v_school_id
  LIMIT 1;

  RETURN v_class;
END;
$$;
