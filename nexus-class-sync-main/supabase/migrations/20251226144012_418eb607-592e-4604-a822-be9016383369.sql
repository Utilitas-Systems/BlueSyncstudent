-- Fix linter: ensure function search_path is fixed
CREATE OR REPLACE FUNCTION public.update_device_connection_status(
  p_student_id uuid,
  p_device_id text,
  p_is_connected boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.student_devices
  SET
    connected = p_is_connected,
    updated_at = now()
  WHERE student_id = p_student_id
    AND device_id = p_device_id;
END;
$$;