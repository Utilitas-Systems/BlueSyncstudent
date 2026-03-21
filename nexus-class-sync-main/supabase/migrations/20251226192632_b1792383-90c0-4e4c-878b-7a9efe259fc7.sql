-- Drop and recreate get_school_by_code function to include school hours and timezone
DROP FUNCTION IF EXISTS public.get_school_by_code(text);

CREATE FUNCTION public.get_school_by_code(p_school_code text)
RETURNS TABLE(
  id uuid,
  is_active boolean,
  school_code text,
  school_name text,
  school_start_time time without time zone,
  school_end_time time without time zone,
  timezone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.is_active,
    s.school_code,
    s.school_name,
    s.school_start_time,
    s.school_end_time,
    s.timezone
  FROM schools s
  WHERE s.school_code = p_school_code;
END;
$$;