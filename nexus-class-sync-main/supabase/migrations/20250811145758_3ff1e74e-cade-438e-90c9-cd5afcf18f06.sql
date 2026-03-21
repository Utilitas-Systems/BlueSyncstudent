-- First, populate the students table with existing school_users who are students
INSERT INTO public.students (id, username, full_name, school_id, class_id, is_online, last_seen, created_at, updated_at)
SELECT 
  su.id,
  su.username,
  su.full_name,
  su.school_id,
  cs.class_id,
  false,
  now(),
  su.created_at,
  now()
FROM public.school_users su
LEFT JOIN public.class_students cs ON su.id = cs.student_id
WHERE su.user_type = 'student'
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  school_id = EXCLUDED.school_id,
  class_id = EXCLUDED.class_id,
  updated_at = now();

-- Create a function to sync student data when they join/leave classes
CREATE OR REPLACE FUNCTION public.sync_student_class_membership()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync when students join/leave classes
CREATE TRIGGER sync_student_class_trigger
  AFTER INSERT OR DELETE ON public.class_students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_class_membership();