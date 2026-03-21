-- The classes table RLS policy for students uses is_current_student_member which only allows
-- viewing classes they're already enrolled in. But to JOIN a class, students need to see
-- classes in their school first.

-- Add a policy that allows students to view classes in their school (for joining)
CREATE POLICY "Students can view classes in their school for joining" 
ON classes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = current_user_id()
    AND s.school_id = classes.school_id
  )
);