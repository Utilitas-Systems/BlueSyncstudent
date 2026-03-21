-- Add unique constraint for student devices to prevent duplicates
ALTER TABLE public.student_devices 
ADD CONSTRAINT unique_student_device UNIQUE (student_id, device_name);

-- Now insert mock devices for testing
INSERT INTO public.student_devices (student_id, device_name, device_type, is_connected, last_connected)
SELECT 
  s.id,
  device_info.name,
  device_info.type,
  device_info.connected,
  now()
FROM public.students s
CROSS JOIN (
  VALUES 
    ('AirPods Pro', 'headphones', true),
    ('iPhone 14', 'smartphone', true),
    ('MacBook Pro', 'laptop', true),
    ('Apple Watch', 'watch', false)
) AS device_info(name, type, connected)
WHERE s.is_online = true
ON CONFLICT (student_id, device_name) DO UPDATE SET
  is_connected = EXCLUDED.is_connected,
  last_connected = EXCLUDED.last_connected;