/**
 * SnapshotReconciler — دمج لقطة قادمة من Firestore مع الحالة المحلية.
 *
 * المشكلة التي يحلّها: التحميل يقرأ المجموعة كاملة ثم يستبدل الحالة المحلية بها
 * (`setPayments(fetched)`). إذا عدّل المستخدم سجلاً **بعد بدء الجلب وقبل وصوله**
 * — مثل تأكيد استلام دفعة — فاللقطة أقدم من التعديل، فتُرجع السجل إلى حالته
 * السابقة في الواجهة، ثم يعيد منطق "وسم المتأخرات" كتابة تلك الحالة القديمة إلى
 * قاعدة البيانات. النتيجة: دفعة مؤكَّدة تعود "متأخرة" وتبقى كذلك.
 *
 * الحل: أي سجل كُتب محلياً بعد لحظة بدء الجلب يفوز على اللقطة — لأن اللقطة، بحكم
 * التعريف، لا يمكن أن تحتوي على تعديل حدث بعد إصدار القراءة.
 *
 * دوال نقية بلا React أو Firestore.
 */

export interface Identified { id: string }

/** مفتاح موحّد لسجل الكتابات المحلية. */
export function writeKey(col: string, id: string): string {
  return `${col}/${id}`;
}

/**
 * هل عُدِّل هذا السجل محلياً بعد بدء الجلب؟
 * المقارنة بـ >= لأن كتابة وقعت في نفس الميلي ثانية التي بدأ فيها الجلب
 * قد لا تكون مشمولة في اللقطة — نُرجّح الحالة المحلية عند الشك.
 */
export function isLocallyNewer(
  writes: Map<string, number>,
  col: string,
  id: string,
  fetchStartedAt: number,
): boolean {
  const at = writes.get(writeKey(col, id));
  return at !== undefined && at >= fetchStartedAt;
}

/**
 * ادمج اللقطة مع الحالة المحلية:
 *  - سجل عُدِّل محلياً بعد بدء الجلب  → تُعتمد نسخته المحلية (أو يُحذف إن حُذف محلياً).
 *  - أي سجل آخر                      → تُعتمد نسخة اللقطة (قاعدة البيانات هي المرجع).
 *  - سجل أُضيف محلياً بعد بدء الجلب ولم يصل في اللقطة → يُضاف.
 */
export function reconcileSnapshot<T extends Identified>(
  col: string,
  fetched: T[],
  local: T[],
  fetchStartedAt: number,
  writes: Map<string, number>,
): T[] {
  const localById = new Map(local.map(r => [r.id, r]));
  const result: T[] = [];
  const seen = new Set<string>();

  for (const remote of fetched) {
    seen.add(remote.id);
    if (isLocallyNewer(writes, col, remote.id, fetchStartedAt)) {
      const mine = localById.get(remote.id);
      if (mine) result.push(mine);   // عُدِّل محلياً — النسخة المحلية أحدث
      // غير موجود محلياً = حُذف محلياً بعد بدء الجلب ⇒ لا يُعاد
      continue;
    }
    result.push(remote);
  }

  // سجلات أُنشئت محلياً بعد بدء الجلب ولم تكن في اللقطة
  for (const mine of local) {
    if (seen.has(mine.id)) continue;
    if (isLocallyNewer(writes, col, mine.id, fetchStartedAt)) result.push(mine);
  }

  return result;
}

/** تنظيف السجل من الكتابات القديمة حتى لا ينمو بلا حدود (الافتراضي: 10 دقائق). */
export function pruneWrites(writes: Map<string, number>, maxAgeMs = 600_000, now = Date.now()): void {
  for (const [k, at] of writes) {
    if (now - at > maxAgeMs) writes.delete(k);
  }
}
