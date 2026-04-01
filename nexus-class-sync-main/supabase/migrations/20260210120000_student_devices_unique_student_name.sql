-- Ensure upsert target exists for student device persistence from student app.
-- This keeps `.upsert(..., { onConflict: 'student_id,device_name' })` valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_student_device'
      AND conrelid = 'public.student_devices'::regclass
  ) THEN
    ALTER TABLE public.student_devices
      ADD CONSTRAINT unique_student_device UNIQUE (student_id, device_name);
  END IF;
END$$;

