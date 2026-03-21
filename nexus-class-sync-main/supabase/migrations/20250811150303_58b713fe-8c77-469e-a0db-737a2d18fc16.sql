-- Fix the security issue by setting search_path for the function
CREATE OR REPLACE FUNCTION public.sync_student_class_membership()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Student joined a class
    INSERT INTO public.students (id, username, full_name, school_id, class_id, is_online, last_seen, created_at, updated_at)
    SELECT 
      su.id,
      su.username,
      su.full_name,
      su.school_id,
      NEW.class_id,
      false,
      now(),
      su.created_at,
      now()
    FROM public.school_users su
    WHERE su.id = NEW.student_id
    ON CONFLICT (id) DO UPDATE SET
      class_id = NEW.class_id,
      updated_at = now();
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Student left a class - set class_id to null
    UPDATE public.students 
    SET class_id = NULL, updated_at = now()
    WHERE id = OLD.student_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;