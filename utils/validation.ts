/**
 * Centralised validation rules — frontend layer (OWASP requirement).
 * Firestore Security Rules enforce the same constraints server-side.
 */

export type ValidationResult = { valid: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[\d+\-() ]{7,20}$/;

export function validateEmail(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: 'البريد الإلكتروني مطلوب' };
  if (!EMAIL_RE.test(value.trim())) return { valid: false, error: 'بريد إلكتروني غير صحيح' };
  return { valid: true };
}

export function validatePassword(value: string): ValidationResult {
  if (!value) return { valid: false, error: 'كلمة المرور مطلوبة' };
  if (value.length < 8) return { valid: false, error: 'كلمة المرور 8 أحرف على الأقل' };
  if (!/[A-Z]/.test(value)) return { valid: false, error: 'يجب أن تحتوي على حرف كبير' };
  if (!/[0-9]/.test(value)) return { valid: false, error: 'يجب أن تحتوي على رقم' };
  return { valid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: `${fieldName} مطلوب` };
  return { valid: true };
}

export function validateMaxLength(value: string, max: number, fieldName: string): ValidationResult {
  if (value.trim().length > max) return { valid: false, error: `${fieldName} لا يتجاوز ${max} حرف` };
  return { valid: true };
}

export function validatePhone(value: string): ValidationResult {
  if (!value.trim()) return { valid: true }; // optional field
  if (!PHONE_RE.test(value.trim())) return { valid: false, error: 'رقم الهاتف غير صحيح' };
  return { valid: true };
}

export function validatePositiveNumber(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: `${fieldName} مطلوب` };
  const n = Number(value);
  if (isNaN(n) || n <= 0) return { valid: false, error: `${fieldName} يجب أن يكون رقماً موجباً` };
  return { valid: true };
}

export function validateDate(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: `${fieldName} مطلوب` };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { valid: false, error: `${fieldName} تاريخ غير صحيح` };
  return { valid: true };
}

/** Collect multiple validation results and return all errors */
export function collectErrors(
  checks: Array<[ValidationResult, string]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [result, field] of checks) {
    if (!result.valid && result.error) errors[field] = result.error;
  }
  return errors;
}
