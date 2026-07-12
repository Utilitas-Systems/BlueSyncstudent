import type { JoinedClass } from '@/lib/studentRpc';

/** Persist authoritative class from `join_class_by_code_v2` (not login_student). */
export function persistStudentClass(cls: JoinedClass): void {
  const record = {
    id: cls.id,
    class_code: cls.class_code,
    class_name: cls.class_name,
  };
  sessionStorage.setItem('student_class', JSON.stringify(record));
  localStorage.setItem('student_class', JSON.stringify(record));
  sessionStorage.setItem('current_class_id', cls.id);
}

export function clearStudentClass(): void {
  sessionStorage.removeItem('student_class');
  sessionStorage.removeItem('current_class_id');
  try {
    localStorage.removeItem('student_class');
    localStorage.removeItem('current_class_id');
  } catch {
    /* ignore */
  }
}

export function readStoredClassCode(): string | null {
  try {
    const raw =
      sessionStorage.getItem('student_class') ?? localStorage.getItem('student_class');
    if (!raw) return null;
    const cls = JSON.parse(raw) as { class_code?: string };
    const code = cls?.class_code?.trim();
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}
