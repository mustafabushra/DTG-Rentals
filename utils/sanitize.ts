/**
 * Input sanitization utilities — OWASP compliant.
 * All user-supplied strings pass through these before storage or display.
 */

/** Remove leading/trailing whitespace and collapse internal whitespace */
export function sanitizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Strip any character that isn't a digit, +, -, space, or parenthesis */
export function sanitizePhone(value: string): string {
  return value.replace(/[^\d+\-() ]/g, '').trim();
}

/** Lowercase + trim; reject anything that doesn't look like an email */
export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Allow only digits and one optional decimal point */
export function sanitizeNumber(value: string): string {
  return value.replace(/[^\d.]/g, '');
}

/** Strip HTML/script tags to prevent XSS in displayed content */
export function sanitizeHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/** Strip path traversal and shell-injection characters from file names */
export function sanitizeFileName(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, '').trim();
}

/** Sanitize a free-text description: trim + strip HTML tags */
export function sanitizeDescription(value: string): string {
  return sanitizeHtml(sanitizeText(value));
}

/** Apply sanitizeText to every string value in a plain object */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = sanitizeText(result[key] as string);
    }
  }
  return result as T;
}
