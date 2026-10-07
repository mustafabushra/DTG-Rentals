/**
 * حدّ معدل بسيط في الذاكرة — يحمي حصّتك المدفوعة من الاستهلاك المفرط.
 *
 * **حدّ معروف:** الذاكرة لكل نسخة من الدالة، والمنصّات بلا حالة تُشغّل نسخاً
 * متعددة، فالحدّ الفعلي قد يصل إلى (الحد × عدد النسخ). هذا مقبول كطبقة أولى
 * مع الحد على حجم الصورة والتحقق من الهوية. لحدّ صارم يلزم مخزن مشترك
 * (KV/Redis) — وهو تعقيد لا يستحقه الاستخدام الحالي.
 */

/**
 * ينشئ محدِّداً: `max` طلبات لكل مفتاح خلال `windowMs`.
 * المفتاح هو معرّف المستخدم لا عنوان IP — فالعدل بين المستخدمين لا الشبكات.
 */
export function createRateLimiter({ max = 20, windowMs = 60 * 60_000, maxKeys = 5000 } = {}) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  function prune(now) {
    for (const [key, stamps] of hits) {
      const fresh = stamps.filter(t => now - t < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }

  return {
    /** يرجع { allowed, remaining, retryAfterMs }. */
    check(key, now = Date.now()) {
      if (!key) return { allowed: false, remaining: 0, retryAfterMs: windowMs };

      // حارس ضد تضخّم الذاكرة لو كثرت المفاتيح
      if (hits.size > maxKeys) prune(now);

      const stamps = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      if (stamps.length >= max) {
        const oldest = Math.min(...stamps);
        return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
      }
      stamps.push(now);
      hits.set(key, stamps);
      return { allowed: true, remaining: max - stamps.length, retryAfterMs: 0 };
    },

    /** للاختبار والتشخيص. */
    size() { return hits.size; },
  };
}
