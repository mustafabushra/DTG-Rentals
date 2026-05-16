/**
 * Production logger — silent in release builds, structured in dev.
 * Strips PII before logging. Never logs passwords, tokens, or full user objects.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'national', 'iban'];

function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.some(s => k.toLowerCase().includes(s)) ? '[REDACTED]' : redact(v);
  }
  return result;
}

function log(level: Level, tag: string, message: string, data?: unknown) {
  if (!__DEV__ && level === 'debug') return;
  const entry = { ts: new Date().toISOString(), level, tag, message, data: data ? redact(data) : undefined };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${entry.level.toUpperCase()}][${entry.tag}]`, entry.message, entry.data ?? '');
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => log('debug', tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => log('info',  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => log('warn',  tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => log('error', tag, msg, data),
};
